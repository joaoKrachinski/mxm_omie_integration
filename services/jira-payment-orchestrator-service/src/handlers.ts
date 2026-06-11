import type { FastifyRequest, FastifyReply } from "fastify";
import type { Config } from "./config";
import type { ReprocessJiraInput, JiraWebhookPayload } from "./types";
import { mapJiraPayload } from "./types";
import { approverJira, verifyInvoiceJira, updateOmieJira, reprocessJira } from "./useCases";
import { sendSuccess, sendError } from "@shared/http";
import { genCorrelationId } from "@shared/utils";
import { createLogger } from "@shared/logger";
import { ValidationError } from "@shared/errors";

const logger = createLogger("jira-payment-orchestrator-service");

export function makeHandlers(config: Config) {
  async function handleApproverJira(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    const raw = req.body as JiraWebhookPayload;
    logger.info("POST /approverJira recebido", { correlation_id: correlationId, endpoint: "/approverJira" });

    if (!raw?.issue?.key) {
      return sendError(reply, new ValidationError("issue.key é obrigatório"), correlationId);
    }

    const issue = mapJiraPayload(raw);
    logger.info("Payload mapeado", { correlation_id: correlationId, jira_id: issue.jira_id, numero_documento: issue.numero_documento });

    try {
      const result = await approverJira(config, issue, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /approverJira", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleVerifyInvoiceJira(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    const raw = req.body as JiraWebhookPayload;
    logger.info("POST /verifyInvoiceJira recebido", { correlation_id: correlationId, endpoint: "/verifyInvoiceJira" });

    if (!raw?.issue?.key) {
      return sendError(reply, new ValidationError("issue.key é obrigatório"), correlationId);
    }

    const issue = mapJiraPayload(raw);
    logger.info("Payload mapeado", { correlation_id: correlationId, jira_id: issue.jira_id, numero_documento: issue.numero_documento, cnpj_cpf: issue.cnpj_cpf, valor: issue.valor });

    try {
      const result = await verifyInvoiceJira(config, issue, correlationId);
      sendSuccess(reply, result, correlationId);
    } catch (err) {
      logger.error("Erro em /verifyInvoiceJira", { correlation_id: correlationId, error: String(err) });
      sendError(reply, err, correlationId);
    }
  }

  async function handleUpdateOmieJira(req: FastifyRequest, reply: FastifyReply) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? genCorrelationId();
    const raw = req.body as JiraWebhookPayload;
    logger.info("POST /updateOmieJira recebido", { correlation_id: correlationId, endpoint: "/updateOmieJira" });

    if (!raw?.issue?.key) {
      return sendError(reply, new ValidationError("issue.key é obrigatório"), correlationId);
    }

    const issue = mapJiraPayload(raw);

    try {
      const result = await updateOmieJira(config, issue, correlationId);
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
      const result = await reprocessJira(config, body, correlationId);
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
