import type { FastifyInstance } from "fastify";
import type { Config } from "./config";
import { makeHandlers } from "./handlers";

export function registerRoutes(app: FastifyInstance, config: Config): void {
  const { handleWebhookOmiePayment, handleReconcile, handleReprocess, handleStatus, handleHealth } =
    makeHandlers(config);

  app.post("/webhookOmiePayment", handleWebhookOmiePayment);
  app.post("/reconcileOmiePayments", handleReconcile);
  app.post("/settlement/reprocess", handleReprocess);
  app.get("/settlement/status", handleStatus);
  app.get("/health", handleHealth);
}
