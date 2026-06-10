"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeHandlers = makeHandlers;
const useCases_1 = require("./useCases");
const http_1 = require("@shared/http");
const utils_1 = require("@shared/utils");
const logger_1 = require("@shared/logger");
const logger = (0, logger_1.createLogger)("mxm-omie-sync-service");
function makeHandlers(db, config) {
    async function handleSyncOmie(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /syncOmie recebido", { correlation_id: correlationId, endpoint: "/syncOmie" });
        try {
            const result = await (0, useCases_1.syncOmie)(db, config, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /syncOmie", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleReprocess(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /syncOmie/reprocess recebido", { correlation_id: correlationId, endpoint: "/syncOmie/reprocess" });
        const body = (req.body ?? {});
        try {
            const result = await (0, useCases_1.reprocessOmie)(db, config, body, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /syncOmie/reprocess", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleStatus(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        try {
            const result = await (0, useCases_1.getSyncStatus)(db);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleHealth(_req, reply) {
        reply.status(200).send({ status: "ok", service: "mxm-omie-sync-service" });
    }
    return { handleSyncOmie, handleReprocess, handleStatus, handleHealth };
}
//# sourceMappingURL=handlers.js.map