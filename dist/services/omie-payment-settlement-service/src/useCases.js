"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processWebhookOmie = processWebhookOmie;
exports.reconcileOmiePayments = reconcileOmiePayments;
exports.reprocessSettlement = reprocessSettlement;
exports.getSettlementStatus = getSettlementStatus;
const repository_1 = require("./repository");
const utils_1 = require("@shared/utils");
const logger_1 = require("@shared/logger");
const logger = (0, logger_1.createLogger)("omie-payment-settlement-service");
async function processWebhookOmie(db, config, rawBody, correlationId) {
    let processados = 0;
    let erros = 0;
    // TODO: validar autenticidade do webhook via OMIE_WEBHOOK_TOKEN
    // if (config.omie.webhookToken && token !== config.omie.webhookToken) throw new AppError("Token inválido", 401);
    // TODO: implementar parsing real do payload do Omie
    // O payload segue o formato OmieWebhookPayload (veja types.ts e exemplo do PDF)
    // const payload = rawBody as OmieWebhookPayload;
    // const pagamentos = extrairPagamentosDoPayload(payload);
    const pagamentos = [];
    for (const pagamento of pagamentos) {
        try {
            const registro = await (0, repository_1.findByOmieId)(db, pagamento.omie_id);
            if (!registro) {
                logger.warn("Registro não encontrado para omie_id", { correlation_id: correlationId, omie_id: pagamento.omie_id });
                continue;
            }
            if (registro.status === "baixado_mxm" || registro.status === "pago_omie") {
                logger.info("Evento já processado, ignorando", { correlation_id: correlationId, omie_id: pagamento.omie_id, status: registro.status });
                processados++;
                continue;
            }
            await (0, repository_1.updateStatus)(db, pagamento.omie_id, "pago_omie", {
                data_pagamento: (0, utils_1.toIsoDate)(pagamento.data_pagamento),
            });
            logger.info("Status atualizado para pago_omie", { correlation_id: correlationId, omie_id: pagamento.omie_id });
            // TODO: atualizar Jira como pago
            // if (registro.jira_id) await atualizarJiraComoPago(registro.jira_id, pagamento.data_pagamento);
            try {
                // TODO: implementar chamada real de baixa no MXM
                // await baixarTituloMxm({ mxm_id: registro.mxm_id, numero_documento: registro.numero_documento, valor: registro.valor, data_pagamento: pagamento.data_pagamento });
                await (0, repository_1.updateStatus)(db, pagamento.omie_id, "baixado_mxm");
                logger.info("Título baixado no MXM", { correlation_id: correlationId, omie_id: pagamento.omie_id, mxm_id: registro.mxm_id });
            }
            catch (baixaErr) {
                await (0, repository_1.updateStatus)(db, pagamento.omie_id, "erro_baixa_mxm");
                logger.error("Falha na baixa do MXM", { correlation_id: correlationId, omie_id: pagamento.omie_id, mxm_id: registro.mxm_id, error: String(baixaErr) });
                // TODO: enviar alerta Slack quando baixa falhar
                // await enviarAlertaSlack({ tipo_erro: "erro_baixa_mxm", omie_id: pagamento.omie_id, mxm_id: registro.mxm_id, acao_esperada: "Executar baixa manual no MXM", correlation_id: correlationId });
                erros++;
                continue;
            }
            processados++;
        }
        catch (err) {
            erros++;
            logger.error("Erro ao processar pagamento do webhook", { correlation_id: correlationId, omie_id: pagamento.omie_id, error: String(err) });
        }
    }
    return { processados, erros };
}
async function reconcileOmiePayments(db, config, correlationId) {
    // TODO: implementar reconciliação real
    // 1. listarContasPagarOmie com filtro de pagamentos do dia
    // 2. Para cada pagamento confirmado, verificar se já está baixado_mxm na base
    // 3. Processar os que não estão (capturar eventos perdidos pelo webhook)
    logger.info("reconcileOmiePayments iniciado", { correlation_id: correlationId });
    return { encontrados: 0, processados: 0, erros: 0 };
}
async function reprocessSettlement(db, config, input, correlationId) {
    const status = input.status ?? "erro_baixa_mxm";
    const pendentes = await (0, repository_1.findPendingSettlement)(db, status, input.desde, input.limite);
    let processados = 0;
    let erros = 0;
    for (const registro of pendentes) {
        try {
            // TODO: implementar reprocessamento real da baixa no MXM
            logger.info("Reprocessando baixa", { correlation_id: correlationId, omie_id: registro.omie_id, mxm_id: registro.mxm_id });
            processados++;
        }
        catch (err) {
            erros++;
            logger.error("Erro no reprocessamento", { correlation_id: correlationId, omie_id: registro.omie_id, error: String(err) });
        }
    }
    return { processados, erros };
}
async function getSettlementStatus(db) {
    const [total, porStatus] = await Promise.all([(0, repository_1.countAll)(db), (0, repository_1.countByStatus)(db)]);
    return {
        total,
        pago_omie: porStatus["pago_omie"] ?? 0,
        baixado_mxm: porStatus["baixado_mxm"] ?? 0,
        erro_baixa_mxm: porStatus["erro_baixa_mxm"] ?? 0,
    };
}
//# sourceMappingURL=useCases.js.map