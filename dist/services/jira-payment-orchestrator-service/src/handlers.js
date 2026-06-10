"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeHandlers = makeHandlers;
const useCases_1 = require("./useCases");
const http_1 = require("@shared/http");
const utils_1 = require("@shared/utils");
const logger_1 = require("@shared/logger");
const errors_1 = require("@shared/errors");
const logger = (0, logger_1.createLogger)("jira-payment-orchestrator-service");
function makeHandlers(db, config) {
    async function handleApproverJira(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /approverJira recebido", { correlation_id: correlationId, endpoint: "/approverJira" });
        const body = req.body;
        if (!body?.jira_id) {
            return (0, http_1.sendError)(reply, new errors_1.ValidationError("jira_id é obrigatório"), correlationId);
        }
        try {
            const result = await (0, useCases_1.approverJira)(db, config, body, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /approverJira", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleVerifyInvoiceJira(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /verifyInvoiceJira recebido", { correlation_id: correlationId, endpoint: "/verifyInvoiceJira" });
        const body = req.body;
        if (!body?.jira_id) {
            return (0, http_1.sendError)(reply, new errors_1.ValidationError("jira_id é obrigatório"), correlationId);
        }
        try {
            const result = await (0, useCases_1.verifyInvoiceJira)(db, config, body, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /verifyInvoiceJira", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleUpdateOmieJira(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /updateOmieJira recebido", { correlation_id: correlationId, endpoint: "/updateOmieJira" });
        const body = req.body;
        if (!body?.jira_id) {
            return (0, http_1.sendError)(reply, new errors_1.ValidationError("jira_id é obrigatório"), correlationId);
        }
        try {
            const result = await (0, useCases_1.updateOmieJira)(db, config, body, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /updateOmieJira", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleReprocess(req, reply) {
        const correlationId = req.headers["x-correlation-id"] ?? (0, utils_1.genCorrelationId)();
        logger.info("POST /jira/reprocess recebido", { correlation_id: correlationId, endpoint: "/jira/reprocess" });
        const body = (req.body ?? {});
        try {
            const result = await (0, useCases_1.reprocessJira)(db, config, body, correlationId);
            (0, http_1.sendSuccess)(reply, result, correlationId);
        }
        catch (err) {
            logger.error("Erro em /jira/reprocess", { correlation_id: correlationId, error: String(err) });
            (0, http_1.sendError)(reply, err, correlationId);
        }
    }
    async function handleHealth(_req, reply) {
        reply.status(200).send({ status: "ok", service: "jira-payment-orchestrator-service" });
    }
    return { handleApproverJira, handleVerifyInvoiceJira, handleUpdateOmieJira, handleReprocess, handleHealth };
}
//# sourceMappingURL=handlers.js.map