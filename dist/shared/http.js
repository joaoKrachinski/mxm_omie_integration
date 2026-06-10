"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
const errors_1 = require("./errors");
function sendSuccess(reply, data, correlationId, statusCode = 200) {
    const body = { success: true, data, correlation_id: correlationId };
    reply.status(statusCode).send(body);
}
function sendError(reply, error, correlationId) {
    if (error instanceof errors_1.AppError) {
        const body = {
            success: false,
            error: error.message,
            correlation_id: correlationId,
        };
        reply.status(error.statusCode).send(body);
        return;
    }
    const body = {
        success: false,
        error: "Erro interno do servidor",
        correlation_id: correlationId,
    };
    reply.status(500).send(body);
}
//# sourceMappingURL=http.js.map