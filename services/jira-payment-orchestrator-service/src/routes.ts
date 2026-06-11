import type { FastifyInstance } from "fastify";
import type { Config } from "./config";
import { makeHandlers } from "./handlers";

export function registerRoutes(app: FastifyInstance, config: Config): void {
  const { handleApproverJira, handleVerifyInvoiceJira, handleUpdateOmieJira, handleReprocess, handleHealth } =
    makeHandlers(config);

  app.post("/approverJira", handleApproverJira);
  app.post("/verifyInvoiceJira", handleVerifyInvoiceJira);
  app.post("/updateOmieJira", handleUpdateOmieJira);
  app.post("/jira/reprocess", handleReprocess);
  app.get("/health", handleHealth);
}
