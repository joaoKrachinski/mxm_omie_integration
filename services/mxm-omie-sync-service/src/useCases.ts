import { Db } from "mongodb";
import type { Config } from "./config";
import type { SyncOmieResult, ReprocessInput, StatusResult } from "./types";
import {
  listarTituloPagar,
  criarContaPagarOmie,
  consultarContaPagarOmie,
  enviarAlertaSlack,
  buscarIssueJira,
} from "./adapters";
import {
  findByIdempotencyKey,
  insertPaymentIntegration,
  updateStatus,
  countByStatus,
  findPendingReprocess,
} from "./repository";
import { normalizeCpfCnpj, toIsoDate, genCorrelationId } from "@shared/utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("mxm-omie-sync-service");

export async function syncOmie(
  db: Db,
  config: Config,
  correlationId: string
): Promise<SyncOmieResult> {
  const result: SyncOmieResult = { processados: 0, criados: 0, ignorados: 0, erros: 0 };

  // TODO: substituir por chamada real ao MXM
  // const titulos = await listarTituloPagar(config.mxm.syncWindowHours);
  buscarIssueJira(`SPAG-49988`)
  const titulos: Awaited<ReturnType<typeof listarTituloPagar>> = [];

  for (const titulo of titulos) {
    result.processados++;
    const cnpjCpf = normalizeCpfCnpj(titulo.cnpj_cpf);
    buscarIssueJira(`SPAG-49988`)

    try {
      const existente = await findByIdempotencyKey(db, titulo.numero_documento, cnpjCpf, titulo.valor);

      buscarIssueJira(`SPAG-49988`)

      if (existente) {
        logger.info("Título já existe, ignorando", { correlation_id: correlationId, numero_documento: titulo.numero_documento });
        result.ignorados++;
        continue;
      }

      // TODO: descomentar consulta ao Omie quando adapter estiver implementado
      // const existeOmie = await consultarContaPagarOmie({ numero_documento: titulo.numero_documento, cnpj_cpf: cnpjCpf });
      // if (existeOmie) {
      //   await insertPaymentIntegration(db, { ...base, omie_id: existeOmie.omie_id, status: "criado_omie" });
      //   result.ignorados++;
      //   continue;
      // }

      // TODO: descomentar criação no Omie quando adapter estiver implementado
      // const omieResult = await criarContaPagarOmie({ ... });

      await insertPaymentIntegration(db, {
        mxm_id: titulo.mxm_id,
        numero_documento: titulo.numero_documento,
        cnpj_cpf: cnpjCpf,
        valor: titulo.valor,
        data_criacao: toIsoDate(new Date()),
        data_emissao: toIsoDate(titulo.data_emissao),
        vencimento: toIsoDate(titulo.vencimento),
        status: "criado_omie",
        // omie_id: omieResult.omie_id — TODO: adicionar quando adapter estiver implementado
      });

      logger.info("Título sincronizado com Omie", { correlation_id: correlationId, numero_documento: titulo.numero_documento });
      result.criados++;
    } catch (err) {
      result.erros++;
      logger.error("Erro ao processar título", {
        correlation_id: correlationId,
        numero_documento: titulo.numero_documento,
        error: String(err),
      });

      // TODO: descomentar alerta quando adapter Slack estiver implementado
      // await enviarAlertaSlack({ tipo_erro: "sync_omie_error", numero_documento: titulo.numero_documento, acao_esperada: "Verificar integração MXM/Omie", correlation_id: correlationId });
    }
  }

  logger.info("Sync Omie concluído", { correlation_id: correlationId, ...result });
  return result;
}

export async function reprocessOmie(
  db: Db,
  config: Config,
  input: ReprocessInput,
  correlationId: string
): Promise<SyncOmieResult> {
  const result: SyncOmieResult = { processados: 0, criados: 0, ignorados: 0, erros: 0 };

  const pendentes = await findPendingReprocess(db, input.status, input.desde, input.limite);

  for (const registro of pendentes) {
    result.processados++;

    try {
      // TODO: implementar lógica de reprocessamento real
      // Verificar se já existe no Omie, criar se necessário, atualizar status
      logger.info("Reprocessando registro", { correlation_id: correlationId, mxm_id: registro.mxm_id });
      result.ignorados++;
    } catch (err) {
      result.erros++;
      logger.error("Erro no reprocessamento", { correlation_id: correlationId, mxm_id: registro.mxm_id, error: String(err) });
    }
  }

  return result;
}

export async function getSyncStatus(db: Db): Promise<StatusResult> {
  const porStatus = await countByStatus(db);
  const total = Object.values(porStatus).reduce((acc, v) => acc + v, 0);
  return { total, por_status: porStatus };
}
