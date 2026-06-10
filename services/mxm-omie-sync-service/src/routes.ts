import type { FastifyInstance } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "./config";
import { makeHandlers } from "./handlers";

export function registerRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const { handleSyncOmie, handleReprocess, handleStatus, handleHealth } = makeHandlers(db, config);

  app.post("/syncOmie", handleSyncOmie);
  app.post("/syncOmie/reprocess", handleReprocess);
  app.get("/syncOmie/status", handleStatus);
  app.get("/health", handleHealth);
}
