import type { FastifyInstance } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "./config";
import { makeHandlers } from "./handlers";

export function registerRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const { handleWebhookOmiePayment, handleReconcile, handleReprocess, handleStatus, handleHealth } =
    makeHandlers(db, config);

  app.post("/webhookOmiePayment", handleWebhookOmiePayment);
  app.post("/reconcileOmiePayments", handleReconcile);
  app.post("/settlement/reprocess", handleReprocess);
  app.get("/settlement/status", handleStatus);
  app.get("/health", handleHealth);
}
