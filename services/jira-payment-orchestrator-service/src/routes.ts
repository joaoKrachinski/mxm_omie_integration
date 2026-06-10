import type { FastifyInstance } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "./config";
import { makeHandlers } from "./handlers";

export function registerRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const { handleApproverJira, handleVerifyInvoiceJira, handleUpdateOmieJira, handleReprocess, handleHealth } =
    makeHandlers(db, config);

  app.post("/approverJira", handleApproverJira);
  app.post("/verifyInvoiceJira", handleVerifyInvoiceJira);
  app.post("/updateOmieJira", handleUpdateOmieJira);
  app.post("/jira/reprocess", handleReprocess);
  app.get("/health", handleHealth);
}
