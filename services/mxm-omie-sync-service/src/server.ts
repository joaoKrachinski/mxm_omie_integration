import "dotenv/config";
import Fastify from "fastify";
import { loadConfig } from "./config";
import { registerRoutes } from "./routes";
import { connectDatabase, disconnectDatabase } from "@database";
import { createLogger } from "@shared/logger";

const logger = createLogger("mxm-omie-sync-service");

async function bootstrap() {
  const config = loadConfig();

  await connectDatabase(config.mongodb.uri, config.mongodb.database);

  const app = Fastify({ logger: false });

  app.addHook("onRequest", (req, _reply, done) => {
    logger.info("incoming request", { endpoint: req.url, method: req.method });
    done();
  });

  registerRoutes(app, config);

  const address = await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`mxm-omie-sync-service rodando em ${address}`);

  const shutdown = async () => {
    logger.info("Encerrando servidor...");
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((err) => {
  console.error(JSON.stringify({
    level: "error",
    service_name: "mxm-omie-sync-service",
    message: "Falha ao iniciar",
    error: String(err),
  }));
  process.exit(1);
});
