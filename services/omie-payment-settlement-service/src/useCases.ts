import type { Config } from "./config";
import type { PagamentoExtraido, ReprocessSettlementInput, SettlementStatusResult } from "./types";
import {
  findByOmieId,
  updateByOmieId,
  countByStatus,
  findPendingReprocess,
  countDocuments,
} from "@database";
import { toIsoDate } from "@shared/utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("omie-payment-settlement-service");

export async function processWebhookOmie(
  _config: Config,
  _rawBody: unknown,
  correlationId: string
): Promise<{ processados: number; erros: number }> {
  let processados = 0;
  let erros = 0;

  logger.info("[WEBHOOK] Evento recebido do Omie", {
    correlation_id: correlationId,
    body_type: typeof _rawBody,
  });

  // TODO: [1] Validar token do webhook via OMIE_WEBHOOK_TOKEN
  logger.info("[1/5] Validação do webhook pendente (TODO)", { correlation_id: correlationId });

  // TODO: [2] Fazer parsing real do payload Omie
  // const payload = rawBody as OmieWebhookPayload;
  // const pagamentos = extrairPagamentosDoPayload(payload);
  logger.info("[2/5] Parsing do payload Omie pendente (TODO)", { correlation_id: correlationId });

  const pagamentos: PagamentoExtraido[] = [];

  logger.info("[3/5] Processando pagamentos extraídos", {
    correlation_id: correlationId,
    total_pagamentos: pagamentos.length,
  });

  for (const pagamento of pagamentos) {
    try {
      // ── [3a] Buscar registro no MongoDB ──────────────────────────────────
      logger.info("[3a] Buscando registro por omie_id", {
        correlation_id: correlationId,
        omie_id: pagamento.omie_id,
      });

      const registro = await findByOmieId(pagamento.omie_id);

      if (!registro) {
        logger.warn("[3a] Registro não encontrado — omie_id sem correspondência na base", {
          correlation_id: correlationId,
          omie_id: pagamento.omie_id,
        });
        continue;
      }

      logger.info("[3a] Registro encontrado", {
        correlation_id: correlationId,
        omie_id: pagamento.omie_id,
        mxm_id: registro.mxm_id,
        status_atual: registro.status,
      });

      // ── [3b] Verificar idempotência ───────────────────────────────────────
      if (registro.status === "baixado_mxm" || registro.status === "pago_omie") {
        logger.info("[3b] Pagamento já processado anteriormente — ignorando", {
          correlation_id: correlationId,
          omie_id: pagamento.omie_id,
          status: registro.status,
        });
        processados++;
        continue;
      }

      // ── [3c] Atualizar status para pago_omie ──────────────────────────────
      logger.info("[3c] Atualizando status para pago_omie...", {
        correlation_id: correlationId,
        omie_id: pagamento.omie_id,
        data_pagamento: pagamento.data_pagamento,
      });

      await updateByOmieId(pagamento.omie_id, {
        status: "pago_omie",
        data_pagamento: toIsoDate(pagamento.data_pagamento),
      });

      logger.info("[3c] Status atualizado para pago_omie", {
        correlation_id: correlationId,
        omie_id: pagamento.omie_id,
      });

      // ── [3d] Atualizar Jira como pago (TODO) ──────────────────────────────
      // if (registro.jira_id) {
      //   logger.info("[3d] Atualizando Jira como pago...", { jira_id: registro.jira_id });
      //   await atualizarJiraComoPago(registro.jira_id, pagamento.data_pagamento);
      //   logger.info("[3d] Jira atualizado como pago", { jira_id: registro.jira_id });
      // }
      logger.info("[3d] Atualização do Jira pendente (TODO)", { correlation_id: correlationId });

      // ── [3e] Executar baixa no MXM ────────────────────────────────────────
      try {
        logger.info("[3e] Executando baixa no MXM... (TODO)", {
          correlation_id: correlationId,
          mxm_id: registro.mxm_id,
          omie_id: pagamento.omie_id,
        });

        // TODO: await baixarTituloMxm({ mxm_id, numero_documento, valor, data_pagamento });

        await updateByOmieId(pagamento.omie_id, { status: "baixado_mxm" });

        logger.info("[3e] Título baixado no MXM com sucesso", {
          correlation_id: correlationId,
          mxm_id: registro.mxm_id,
          omie_id: pagamento.omie_id,
        });
      } catch (baixaErr) {
        logger.error("[3e] Falha na baixa do MXM — marcando como erro_baixa_mxm", {
          correlation_id: correlationId,
          mxm_id: registro.mxm_id,
          omie_id: pagamento.omie_id,
          error: String(baixaErr),
        });
        await updateByOmieId(pagamento.omie_id, { status: "erro_baixa_mxm" });
        erros++;
        continue;
      }

      processados++;
    } catch (err) {
      erros++;
      logger.error("[3/5] Erro ao processar pagamento", {
        correlation_id: correlationId,
        omie_id: pagamento.omie_id,
        error: String(err),
      });
    }
  }

  logger.info("[5/5] Processamento do webhook concluído", {
    correlation_id: correlationId,
    processados,
    erros,
  });

  return { processados, erros };
}

export async function reconcileOmiePayments(
  _config: Config,
  correlationId: string
): Promise<{ encontrados: number; processados: number; erros: number }> {
  logger.info("[RECONCILE] Iniciando reconciliação de pagamentos Omie", {
    correlation_id: correlationId,
  });

  // TODO: [1] Listar pagamentos confirmados no Omie no dia
  logger.info("[RECONCILE 1/3] Listagem no Omie pendente (TODO)", { correlation_id: correlationId });

  // TODO: [2] Comparar com base — encontrar pago_omie sem baixado_mxm
  logger.info("[RECONCILE 2/3] Comparação com base pendente (TODO)", { correlation_id: correlationId });

  // TODO: [3] Processar os pendentes
  logger.info("[RECONCILE 3/3] Reprocessamento pendente (TODO)", { correlation_id: correlationId });

  logger.info("[RECONCILE] Reconciliação concluída", { correlation_id: correlationId, encontrados: 0 });
  return { encontrados: 0, processados: 0, erros: 0 };
}

export async function reprocessSettlement(
  _config: Config,
  input: ReprocessSettlementInput,
  correlationId: string
): Promise<{ processados: number; erros: number }> {
  logger.info("[REPROCESS] Iniciando reprocessamento de liquidações", {
    correlation_id: correlationId,
    status_filtro: input.status ?? "erro_baixa_mxm",
    limite: input.limite ?? 100,
  });

  const status = input.status ?? "erro_baixa_mxm";
  const pendentes = await findPendingReprocess(status, input.desde, input.limite);

  logger.info("[REPROCESS] Registros encontrados para reprocessar", {
    correlation_id: correlationId,
    total: pendentes.length,
  });

  let processados = 0;
  let erros = 0;

  for (const registro of pendentes) {
    logger.info(`[REPROCESS] Reprocessando ${processados + 1}/${pendentes.length}`, {
      correlation_id: correlationId,
      omie_id: registro.omie_id,
      mxm_id: registro.mxm_id,
      status_atual: registro.status,
    });
    try {
      // TODO: baixa real no MXM
      processados++;
    } catch (err) {
      erros++;
      logger.error("[REPROCESS] Erro no reprocessamento", {
        correlation_id: correlationId,
        omie_id: registro.omie_id,
        error: String(err),
      });
    }
  }

  logger.info("[REPROCESS] Reprocessamento finalizado", { correlation_id: correlationId, processados, erros });
  return { processados, erros };
}

export async function getSettlementStatus(): Promise<SettlementStatusResult> {
  logger.info("[STATUS] Consultando status de liquidações...");
  const [total, porStatus] = await Promise.all([countDocuments(), countByStatus()]);
  logger.info("[STATUS] Status consultado", { total, ...porStatus });
  return {
    total,
    pago_omie: porStatus["pago_omie"] ?? 0,
    baixado_mxm: porStatus["baixado_mxm"] ?? 0,
    erro_baixa_mxm: porStatus["erro_baixa_mxm"] ?? 0,
  };
}
