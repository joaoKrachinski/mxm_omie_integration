import type { Config } from "./config";
import type {
  SyncOmieResult,
  SyncOmieInput,
  ReprocessInput,
  StatusResult,
  ListDocumentsInput,
  DocumentsResult,
} from "./types";
import {
  listarTituloPagar,
  consultarTituloMXM,
  criarContaPagarOmie,
  consultarContaPagarOmie,
  enviarAlertaSlack,
  buscarIssueJira,
} from "./adapters";
import {
  findDocumentByCnpjNumero as findByIdempotencyKey,
  insertDocument as insertPaymentIntegration,
  countByStatus,
  findPendingReprocess,
  listDocuments,
  countDocuments,
} from "@database";
import { normalizeCpfCnpj, toIsoDate, toOmieDate } from "@shared/utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("mxm-omie-sync-service");

export async function syncOmie(
  config: Config,
  correlationId: string,
  input: SyncOmieInput = {}
): Promise<SyncOmieResult> {
  const result: SyncOmieResult = { processados: 0, criados: 0, ignorados: 0, erros: 0 };
  const startTime = Date.now();

  logger.info("[SYNC] Iniciando sincronização MXM → Omie", {
    correlation_id: correlationId,
    janela_horas: config.mxm.syncWindowHours,
    mxm_url: config.mxm.baseUrl,
    limite: input.limite ?? "sem limite",
  });

  // ── Etapa 1: Buscar títulos no MXM ────────────────────────────────────────
  logger.info("[1/4] Consultando títulos no MXM...", { correlation_id: correlationId });

  const todosTitulos = await listarTituloPagar();
  const titulos = input.limite ? todosTitulos.slice(0, input.limite) : todosTitulos;

  logger.info("[1/4] Títulos recebidos do MXM", {
    correlation_id: correlationId,
    total_mxm: todosTitulos.length,
    total_a_processar: titulos.length,
  });

  if (titulos.length === 0) {
    logger.info("[SYNC] Nenhum título encontrado na janela configurada — sync encerrado", {
      correlation_id: correlationId,
    });
    return result;
  }

  enviarAlertaSlack({
    type: "channel",
    id: process.env.SLACK_DEVELOPMENT_CHANNEL || "",
    message: [
      `🔄 Sync MXM → Omie iniciado`,
      `Títulos a processar: ${titulos.length}`,
      `Horário: ${new Date().toISOString()}`,
    ].join("\n"),
  });

  // ── Etapa 2: Processar cada título ────────────────────────────────────────
  logger.info("[2/4] Iniciando processamento dos títulos...", { correlation_id: correlationId });

  for (const titulo of titulos) {
    result.processados++;
    const cnpjCpf = normalizeCpfCnpj(titulo.Fornecedor);
    const valorTituloFloat = parseFloat(titulo.ValorDoTitulo);
    const valorTituloInt = Math.round(valorTituloFloat * 100);

    logger.info(`[2/4] Processando título ${result.processados}/${titulos.length}`, {
      correlation_id: correlationId,
      numero_documento: titulo.NumeroTitulo,
      fornecedor: titulo.Fornecedor,
      cnpj_cpf: cnpjCpf,
      valor_reais: valorTituloFloat,
      valor_centavos: valorTituloInt,
      vencimento: titulo.DataVencimento,
    });

    try {
      // ── Etapa 2a: Verificar idempotência ──────────────────────────────────
      logger.info("[2a] Verificando idempotência no MongoDB", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
      });

      const existente = await findByIdempotencyKey(cnpjCpf, titulo.NumeroTitulo);

      if (existente) {
        logger.info("[2a] Título já existe no banco — ignorando", {
          correlation_id: correlationId,
          numero_documento: titulo.NumeroTitulo,
          status_atual: existente.status,
        });
        result.ignorados++;
        continue;
      }

      logger.info("[2a] Título novo — prosseguindo com criação", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
      });

      // ── Etapa 2b: Consultar retenções no MXM ─────────────────────────────────
      logger.info("[2b] Consultando retenções no MXM...", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
      });

      let retencoes: Awaited<ReturnType<typeof consultarTituloMXM>> = null;
      try {
        retencoes = await consultarTituloMXM(titulo.NumeroTitulo, titulo.Fornecedor);
        logger.info("[2b] Retenções recebidas do MXM", {
          correlation_id: correlationId,
          numero_documento: titulo.NumeroTitulo,
          ValordoIRRF: retencoes?.ValordoIRRF,
          ValordoINSS: retencoes?.ValordoINSS,
          ValordoISS: retencoes?.ValordoISS,
        });
      } catch (retErr) {
        logger.warn("[2b] Falha ao consultar retenções no MXM — prosseguindo sem elas", {
          correlation_id: correlationId,
          numero_documento: titulo.NumeroTitulo,
          error: String(retErr),
        });
      }

      // ── Etapa 2d: Criar Conta no Omie ────────────────────────────────────────
      const vencimento = new Date();
      vencimento.setFullYear(vencimento.getFullYear() + 10);
      const dataVencimentoOmie = toOmieDate(vencimento);
      logger.info("[2b] Criando conta a pagar no Omie...", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
        data_vencimento: dataVencimentoOmie,
      });
      const omieResult = await criarContaPagarOmie({
        numero_documento: titulo.NumeroTitulo,
        cnpj_cpf: cnpjCpf,
        valor: valorTituloFloat,
        data_vencimento: dataVencimentoOmie,
        valor_centavos: valorTituloInt,
      });
      logger.info("[2b] Conta criada no Omie", { omie_id: omieResult.omie_id });

      // ── Etapa 2c: Persistir no MongoDB ────────────────────────────────────
      logger.info("[2c] Persistindo no MongoDB...", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
        omieResult,
      });

      await insertPaymentIntegration({
        mxm_id: titulo.NumeroTitulo,
        numero_documento: titulo.NumeroTitulo,
        cnpj_cpf: cnpjCpf,
        valor: valorTituloInt,
        omie_id: omieResult.omie_id,
        data_criacao: toIsoDate(new Date()),
        status: "criado_omie",
        ...(retencoes && {
          ValordoIRRF:               retencoes.ValordoIRRF  || "null",
          ValordoINSS:               retencoes.ValordoINSS  || "null",
          ValordoISS:                retencoes.ValordoISS   || "null",
          ValordoPIS:                retencoes.ValordoPIS   || "null",
          ValordoCOFINS:             retencoes.ValordoCOFINS || "null",
          ValordoCIDE:               retencoes.ValordoCIDE  || "null",
          ValordaContribuicaoSocial: retencoes.ValordaContribuicaoSocial || "null",
          INSSI:                     retencoes.INSSI || "null",
        }),
      });

      logger.info("[2c] Título persistido com sucesso", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
        status: "criado_omie",
      });

      result.criados++;
    } catch (err) {
      result.erros++;
      logger.error("[2/4] Erro ao processar título", {
        correlation_id: correlationId,
        numero_documento: titulo.NumeroTitulo,
        error: String(err),
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // ── Etapa 3: Resumo ───────────────────────────────────────────────────────
  const duracao = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info("[3/4] Processamento concluído", {
    correlation_id: correlationId,
    ...result,
    duracao_segundos: duracao,
  });

  // ── Etapa 4: Alerta final ─────────────────────────────────────────────────
  logger.info("[4/4] Enviando resumo ao Slack...", { correlation_id: correlationId });
  enviarAlertaSlack({
    type: "channel",
    id: process.env.SLACK_DEVELOPMENT_CHANNEL || "",
    message: [
      `✅ Sync MXM → Omie concluído em ${duracao}s`,
      `Processados: ${result.processados}`,
      `Criados: ${result.criados}`,
      `Ignorados (já existiam): ${result.ignorados}`,
      `Erros: ${result.erros}`,
    ].join("\n"),
  });

  logger.info("[SYNC] Sincronização finalizada", { correlation_id: correlationId, ...result });
  return result;
}

export async function reprocessOmie(
  config: Config,
  input: ReprocessInput,
  correlationId: string
): Promise<SyncOmieResult> {
  const result: SyncOmieResult = { processados: 0, criados: 0, ignorados: 0, erros: 0 };

  logger.info("[REPROCESS] Iniciando reprocessamento", {
    correlation_id: correlationId,
    status_filtro: input.status ?? "todos",
    desde: input.desde ?? "sem filtro",
    limite: input.limite ?? 100,
  });

  const pendentes = await findPendingReprocess(input.status, input.desde, input.limite);

  logger.info("[REPROCESS] Registros encontrados para reprocessar", {
    correlation_id: correlationId,
    total: pendentes.length,
  });

  for (const registro of pendentes) {
    result.processados++;
    logger.info(`[REPROCESS] Reprocessando ${result.processados}/${pendentes.length}`, {
      correlation_id: correlationId,
      mxm_id: registro.mxm_id,
      status_atual: registro.status,
    });
    try {
      // TODO: verificar Omie, criar se necessário, atualizar status
      result.ignorados++;
    } catch (err) {
      result.erros++;
      logger.error("[REPROCESS] Erro no reprocessamento", {
        correlation_id: correlationId,
        mxm_id: registro.mxm_id,
        error: String(err),
      });
    }
  }

  logger.info("[REPROCESS] Reprocessamento finalizado", { correlation_id: correlationId, ...result });
  return result;
}

export async function getSyncStatus(): Promise<StatusResult> {
  const porStatus = await countByStatus();
  const total = (Object.values(porStatus) as number[]).reduce((acc, v) => acc + v, 0);
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

  logger.info("[DOCUMENTS] Listando documentos", {
    correlation_id: correlationId,
    status_filtro: input.status ?? "todos",
    desde: input.desde ?? "sem filtro",
    limite,
  });

  const [documentos, total] = await Promise.all([
    listDocuments(input.status, input.desde, limite),
    countDocuments(input.status, input.desde),
  ]);

  logger.info("[DOCUMENTS] Listagem concluída", {
    correlation_id: correlationId,
    total_na_base: total,
    retornados: documentos.length,
  });

  return { total, limite, documentos };
}
