import type { FastifyRequest, FastifyReply } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "./config";
import type { ApproverJiraInput, VerifyInvoiceJiraInput, UpdateOmieJiraInput, ReprocessJiraInput } from "./types";
import { approverJira, verifyInvoiceJira, updateOmieJira, reprocessJira } from "./useCases";
import { sendSuccess, sendError } from "@shared/http";
import { genCorrelationId } from "@shared/utils";
import { createLogger } from "@shared/logger";
import { ValidationError } from "@shared/errors";

const logger = createLogger("jira-payment-orchestrator-service");

export function makeHandlers(db: Db, config: Config) {
  async function handleApproverJira(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /approverJira recebido", { correlation_id: correlationId, endpoint: "/approverJira" });
    const body = req.body as ApproverJiraInput;
    if (!body?.jira_id) {
      return sendError(reply, new ValidationError("jira_id é obrigatório"), correlationId);
    }
    try {
      const result = await approverJira(db, config, body, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /approverJira", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleVerifyInvoiceJira(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /verifyInvoiceJira recebido", { correlation_id: correlationId, endpoint: "/verifyInvoiceJira" });
    const body = req.body as VerifyInvoiceJiraInput;
    if (!body?.jira_id) {
      return sendError(reply, new ValidationError("jira_id é obrigatório"), correlationId);
    }
    try {
      const result = await verifyInvoiceJira(db, config, body, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /verifyInvoiceJira", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleUpdateOmieJira(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /updateOmieJira recebido", { correlation_id: correlationId, endpoint: "/updateOmieJira" });
    const body = req.body as UpdateOmieJiraInput;
    if (!body?.jira_id) {
      return sendError(reply, new ValidationError("jira_id é obrigatório"), correlationId);
    }
    try {
      const result = await updateOmieJira(db, config, body, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /updateOmieJira", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleReprocess(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    logger.info("POST /jira/reprocess recebido", { correlation_id: correlationId, endpoint: "/jira/reprocess" });
    const body = (req.body ?? {}) as ReprocessJiraInput;
    try {
      const result = await reprocessJira(db, config, body, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /jira/reprocess", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleHealth(_req: FastifyRequest, reply: FastifyReply) {
    reply.status(200).send({ status: "ok", service: "jira-payment-orchestrator-service" });
  }

  return { handleApproverJira, handleVerifyInvoiceJira, handleUpdateOmieJira, handleReprocess, handleHealth };
}
