"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const config_1 = require("./config");
const routes_1 = require("./routes");
const mongo_1 = require("@shared/mongo");
const logger_1 = require("@shared/logger");
const logger = (0, logger_1.createLogger)("jira-payment-orchestrator-service");
async function bootstrap() {
    const config = (0, config_1.loadConfig)();
    const app = (0, fastify_1.default)({ logger: false });
    app.addHook("onRequest", (req, _reply, done) => {
        logger.info("incoming request", { endpoint: req.url, method: req.method });
        done();
    });
    const db = await (0, mongo_1.connectMongo)(config.mongodb.uri, config.mongodb.database);
    logger.info("MongoDB conectado");
    (0, routes_1.registerRoutes)(app, db, config);
    const address = await app.listen({ port: config.port, host: "0.0.0.0" });
    logger.info(`jira-payment-orchestrator-service rodando em ${address}`);
    const shutdown = async () => {
        logger.info("Encerrando servidor...");
        await app.close();
        await (0, mongo_1.disconnectMongo)();
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}
bootstrap().catch((err) => {
    console.error(JSON.stringify({ level: "error", service_name: "jira-payment-orchestrator-service", message: "Falha ao iniciar", error: String(err) }));
    process.exit(1);
});
//# sourceMappingURL=server.js.map