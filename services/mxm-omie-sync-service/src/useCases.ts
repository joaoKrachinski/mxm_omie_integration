import type { Config } from "./config";
import type {
  SyncOmieResult,
  ReprocessInput,
  StatusResult,
  ListDocumentsInput,
  DocumentsResult,
} from "./types";
import {
  listarTituloPagar,
  criarContaPagarOmie,
  consultarContaPagarOmie,
  enviarAlertaSlack,
  buscarIssueJira,
} from "./adapters";
import {
  findDocument as findByIdempotencyKey,
  insertDocument as insertPaymentIntegration,
  countByStatus,
  findPendingReprocess,
  listDocuments,
  countDocuments,
} from "@database";
import { normalizeCpfCnpj, toIsoDate } from "@shared/utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("mxm-omie-sync-service");

export async function syncOmie(
  config: Config,
  correlationId: string
): Promise<SyncOmieResult> {
  const result: SyncOmieResult = { processados: 0, criados: 0, ignorados: 0, erros: 0 };

  const titulos = await listarTituloPagar();

  const mensagemInicio = [
    `🔄`,
    `Iniciando sync MXM -> Omie. Títulos a processar: ${titulos.length}`,
    `Horário de Início: ${new Date().toISOString()}`,
  ].join("\n");

  enviarAlertaSlack({
    type: "channel",
    id: process.env.SLACK_DEVELOPMENT_CHANNEL || "",
    message: mensagemInicio,
  });

  for (const titulo of titulos) {
    result.processados++;
    const cnpjCpf = normalizeCpfCnpj(titulo.Fornecedor);
    const valorTituloFloat = parseFloat(titulo.ValorDoTitulo);
    const valorTituloInt = Math.round(valorTituloFloat * 100);

    logger.info("Processando título", {
      correlation_id: correlationId,
      numero_documento: titulo.NumeroTitulo,
      cnpj_cpf: cnpjCpf,
      valor: valorTituloInt,
    });

    try {
      const existente = await findByIdempotencyKey(titulo.NumeroTitulo, cnpjCpf, valorTituloInt);

      if (existente) {
        logger.info("Título já existe, ignorando", {
          correlation_id: correlationId,
          numero_documento: titulo.NumeroTitulo,
        });
        result.ignorados++;
        continue;
      }

      // TODO: descomentar quando criarContaPagarOmie estiver implementado
      // const omieResult = await criarContaPagarOmie({ ... });

      await insertPaymentIntegration({
        mxm_id: titulo.NumeroTitulo,
        numero_documento: titulo.NumeroTitulo,
        cnpj_cpf: cnpjCpf,
        valor: valorTituloInt,
        data_criacao: toIsoDate(new Date()),
        status: "criado_omie",
        // omie_id: omieResult.omie_id — TODO: adicionar quando omie estiver implementado
      });

      logger.info("Título sincronizado", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
      });
      result.criados++;
    } catch (err) {
      result.erros++;
      logger.error("Erro ao processar título", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
        error: String(err),
      });
    }

    // Aguarda para evitar rate limit do MXM
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info("Sync Omie concluído", { correlation_id: correlationId, ...result });
  return result;
}

export async function reprocessOmie(
  config: Config,
  input: ReprocessInput,
  correlationId: string
): Promise<SyncOmieResult> {
  const result: SyncOmieResult = { processados: 0, criados: 0, ignorados: 0, erros: 0 };

  const pendentes = await findPendingReprocess(input.status, input.desde, input.limite);

  for (const registro of pendentes) {
    result.processados++;
    try {
      // TODO: implementar reprocessamento real (verificar Omie, criar se necessário)
      logger.info("Reprocessando registro", {
        correlation_id: correlationId,
        mxm_id: registro.mxm_id,
      });
      result.ignorados++;
    } catch (err) {
      result.erros++;
      logger.error("Erro no reprocessamento", {
        correlation_id: correlationId,
        mxm_id: registro.mxm_id,
        error: String(err),
      });
    }
  }

  return result;
}

export async function getSyncStatus(): Promise<StatusResult> {
  const porStatus = await countByStatus();
  const total = Object.values(porStatus).reduce((acc: number, v: number) => acc + v, 0);
  return { total, por_status: porStatus };
}

export async function getSyncDocuments(
  input: ListDocumentsInput,
  correlationId: string
): Promise<DocumentsResult> {
  const parsedLimit = Number(input.limite);
  const limite = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), 5000)
    : 200;

  const [documentos, total] = await Promise.all([
    listDocuments(input.status, input.desde, limite),
    countDocuments(input.status, input.desde),
  ]);

  logger.info("Listagem de documentos do sync executada", {
    correlation_id: correlationId,
    status_filter: input.status ?? "all",
    desde_filter: input.desde ?? "none",
    limite,
    total,
    retornados: documentos.length,
  });

  return {
    total,
    limite,
    documentos,
  };
}
