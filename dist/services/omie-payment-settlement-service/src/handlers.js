"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeHandlers = makeHandlers;
const useCases_1 = require("./useCases");
const http_1 = require("@shared/http");
const utils_1 = require("@shared/utils");
const logger_1 = require("@shared/logger");
const logger = (0, logger_1.createLogger)("omie-payment-settlement-service");
function makeHandlers(db, config) {
    async function handleWebhookOmiePayment(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /webhookOmiePayment recebido", { correlation_id: correlationId, endpoint: "/webhookOmiePayment" });
        try {
            const result = await (0, useCases_1.processWebhookOmie)(db, config, req.body, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /webhookOmiePayment", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleReconcile(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /reconcileOmiePayments recebido", { correlation_id: correlationId, endpoint: "/reconcileOmiePayments" });
        try {
            const result = await (0, useCases_1.reconcileOmiePayments)(db, config, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /reconcileOmiePayments", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleReprocess(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /settlement/reprocess recebido", { correlation_id: correlationId, endpoint: "/settlement/reprocess" });
        const body = (req.body ?? {});
        try {
            const result = await (0, useCases_1.reprocessSettlement)(db, config, body, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /settlement/reprocess", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleStatus(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        try {
            const result = await (0, useCases_1.getSettlementStatus)(db);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleHealth(_req, reply) {
        reply.status(200).send({ status: "ok", service: "omie-payment-settlement-service" });
    }
    return { handleWebhookOmiePayment, handleReconcile, handleReprocess, handleStatus, handleHealth };
}
//# sourceMappingURL=handlers.js.map