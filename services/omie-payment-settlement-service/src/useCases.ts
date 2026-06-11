import type { Config } from "./config";
import type { OmieWebhookPayload, PagamentoExtraido, ReprocessSettlementInput, SettlementStatusResult } from "./types";
import { baixarTituloMxm, atualizarJiraComoPago, enviarAlertaSlack, listarContasPagarOmie } from "./adapters";
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
  config: Config,
  rawBody: unknown,
  correlationId: string
): Promise<{ processados: number; erros: number }> {
  let processados = 0;
  let erros = 0;

  // TODO: validar autenticidade do webhook via OMIE_WEBHOOK_TOKEN
  // if (config.omie.webhookToken && token !== config.omie.webhookToken) throw new AppError("Token inválido", 401);

  // TODO: implementar parsing real do payload do Omie (ver types.ts e fixture em tests/fixtures/omie-webhook.json)
  // const payload = rawBody as OmieWebhookPayload;
  // const pagamentos = extrairPagamentosDoPayload(payload);
  const pagamentos: PagamentoExtraido[] = [];

  for (const pagamento of pagamentos) {
    try {
      const registro = await findByOmieId(pagamento.omie_id);

      if (!registro) {
        logger.warn("Registro não encontrado para omie_id", { correlation_id: correlationId, omie_id: pagamento.omie_id });
        continue;
      }

      if (registro.status === "baixado_mxm" || registro.status === "pago_omie") {
        logger.info("Evento já processado, ignorando", { correlation_id: correlationId, omie_id: pagamento.omie_id, status: registro.status });
        processados++;
        continue;
      }

      await updateByOmieId(pagamento.omie_id, {
        status: "pago_omie",
        data_pagamento: toIsoDate(pagamento.data_pagamento),
      });
      logger.info("Status atualizado para pago_omie", { correlation_id: correlationId, omie_id: pagamento.omie_id });

      // TODO: atualizar Jira como pago
      // if (registro.jira_id) await atualizarJiraComoPago(registro.jira_id, pagamento.data_pagamento);

      try {
        // TODO: implementar chamada real de baixa no MXM
        // await baixarTituloMxm({ mxm_id: registro.mxm_id, numero_documento: registro.numero_documento, valor: registro.valor, data_pagamento: pagamento.data_pagamento });

        await updateByOmieId(pagamento.omie_id, { status: "baixado_mxm" });
        logger.info("Título baixado no MXM", { correlation_id: correlationId, omie_id: pagamento.omie_id, mxm_id: registro.mxm_id });
      } catch (baixaErr) {
        await updateByOmieId(pagamento.omie_id, { status: "erro_baixa_mxm" });
        logger.error("Falha na baixa do MXM", { correlation_id: correlationId, omie_id: pagamento.omie_id, error: String(baixaErr) });
        // TODO: enviar alerta Slack
        erros++;
        continue;
      }

      processados++;
    } catch (err) {
      erros++;
      logger.error("Erro ao processar pagamento do webhook", { correlation_id: correlationId, omie_id: pagamento.omie_id, error: String(err) });
    }
  }

  return { processados, erros };
}

export async function reconcileOmiePayments(
  config: Config,
  correlationId: string
): Promise<{ encontrados: number; processados: number; erros: number }> {
  // TODO: listarContasPagarOmie → comparar com base → processar pendentes
  logger.info("reconcileOmiePayments iniciado", { correlation_id: correlationId });
  return { encontrados: 0, processados: 0, erros: 0 };
}

export async function reprocessSettlement(
  config: Config,
  input: ReprocessSettlementInput,
  correlationId: string
): Promise<{ processados: number; erros: number }> {
  const status = input.status ?? "erro_baixa_mxm";
  const pendentes = await findPendingReprocess(status, input.desde, input.limite);

  let processados = 0;
  let erros = 0;

  for (const registro of pendentes) {
    try {
      // TODO: implementar reprocessamento real da baixa no MXM
      logger.info("Reprocessando baixa", { correlation_id: correlationId, omie_id: registro.omie_id, mxm_id: registro.mxm_id });
      processados++;
    } catch (err) {
      erros++;
      logger.error("Erro no reprocessamento", { correlation_id: correlationId, omie_id: registro.omie_id, error: String(err) });
    }
  }

  return { processados, erros };
}

export async function getSettlementStatus(): Promise<SettlementStatusResult> {
  const [total, porStatus] = await Promise.all([
    countDocuments(),
    countByStatus(),
  ]);
  return {
    total,
    pago_omie: porStatus["pago_omie"] ?? 0,
    baixado_mxm: porStatus["baixado_mxm"] ?? 0,
    erro_baixa_mxm: porStatus["erro_baixa_mxm"] ?? 0,
  };
}
