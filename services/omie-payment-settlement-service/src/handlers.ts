import type { FastifyRequest, FastifyReply } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "./config";
import type { ReprocessSettlementInput } from "./types";
import { processWebhookOmie, reconcileOmiePayments, reprocessSettlement, getSettlementStatus } from "./useCases";
import { sendSuccess, sendError } from "@shared/http";
import { genCorrelationId } from "@shared/utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("omie-payment-settlement-service");

export function makeHandlers(db: Db, config: Config) {
  async function handleWebhookOmiePayment(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /webhookOmiePayment recebido", { correlation_id: correlationId, endpoint: "/webhookOmiePayment" });
    try {
      const result = await processWebhookOmie(db, config, req.body, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /webhookOmiePayment", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleReconcile(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /reconcileOmiePayments recebido", { correlation_id: correlationId, endpoint: "/reconcileOmiePayments" });
    try {
      const result = await reconcileOmiePayments(db, config, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /reconcileOmiePayments", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleReprocess(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /settlement/reprocess recebido", { correlation_id: correlationId, endpoint: "/settlement/reprocess" });
    const body = (req.body ?? {}) as ReprocessSettlementInput;
    try {
      const result = await reprocessSettlement(db, config, body, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /settlement/reprocess", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleStatus(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    try {
      const result = await getSettlementStatus(db);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      sendError(reply, err, correlationId);
    }
  }

  async function handleHealth(_req: FastifyRequest, reply: FastifyReply) {
    reply.status(200).send({ status: "ok", service: "omie-payment-settlement-service" });
  }

  return { handleWebhookOmiePayment, handleReconcile, handleReprocess, handleStatus, handleHealth };
}
