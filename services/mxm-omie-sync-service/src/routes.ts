import type { FastifyInstance } from "fastify";
import type { Config } from "./config";
import { makeHandlers } from "./handlers";

export function registerRoutes(app: FastifyInstance, config: Config): void {
  const { handleSyncOmie, handleReprocess, handleStatus, handleDocuments, handleHealth } = makeHandlers(config);

  app.post("/syncOmie", handleSyncOmie);
  app.post("/syncOmie/reprocess", handleReprocess);
  app.get("/syncOmie/status", handleStatus);
  app.get("/syncOmie/documents", handleDocuments);
  app.get("/health", handleHealth);
}
