import type { FastifyRequest, FastifyReply } from "fastify";
import type { Config } from "./config";
import type { ReprocessInput, ListDocumentsInput } from "./types";
import { syncOmie, reprocessOmie, getSyncStatus, getSyncDocuments } from "./useCases";
import { sendSuccess, sendError } from "@shared/http";
import { genCorrelationId } from "@shared/utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("mxm-omie-sync-service");

export function makeHandlers(config: Config) {
  async function handleSyncOmie(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /syncOmie recebido", { correlation_id: correlationId, endpoint: "/syncOmie" });
    try {
      const result = await syncOmie(config, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /syncOmie", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleReprocess(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /syncOmie/reprocess recebido", { correlation_id: correlationId, endpoint: "/syncOmie/reprocess" });
    const body = (req.body ?? {}) as ReprocessInput;
    try {
      const result = await reprocessOmie(config, body, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /syncOmie/reprocess", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleStatus(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    try {
      const result = await getSyncStatus();
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      sendError(reply, err, correlationId);
    }
  }

  async function handleDocuments(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    const query = (req.query ?? {}) as ListDocumentsInput;

    try {
      const result = await getSyncDocuments(query, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /syncOmie/documents", {
        correlation_id: correlationId,
        error: String(err),
      });
      sendError(reply, err, correlationId);
    }
  }

  async function handleHealth(_req: FastifyRequest, reply: FastifyReply) {
    reply.status(200).send({ status: "ok", service: "mxm-omie-sync-service" });
  }

  return { handleSyncOmie, handleReprocess, handleStatus, handleDocuments, handleHealth };
}
