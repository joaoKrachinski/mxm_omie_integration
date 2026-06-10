import "dotenv/config";
import Fastify from "fastify";
import { loadConfig } from "./config";
import { registerRoutes } from "./routes";
import { connectMongo, disconnectMongo } from "@shared/mongo";
import { createLogger } from "@shared/logger";

const logger = createLogger("omie-payment-settlement-service");

async function bootstrap() {
  const config = loadConfig();

  const app = Fastify({ logger: false });

  app.addHook("onRequest", (req, _reply, done) => {
    logger.info("incoming request", { endpoint: req.url, method: req.method });
    done();
  });

  const db = await connectMongo(config.mongodb.uri, config.mongodb.database);
  logger.info("MongoDB conectado");

  registerRoutes(app, db, config);

  const address = await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`omie-payment-settlement-service rodando em ${address}`);

  const shutdown = async () => {
    logger.info("Encerrando servidor...");
    await app.close();
    await disconnectMongo();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((err) => {
  console.error(JSON.stringify({ level: "error", service_name: "omie-payment-settlement-service", message: "Falha ao iniciar", error: String(err) }));
  process.exit(1);
});
