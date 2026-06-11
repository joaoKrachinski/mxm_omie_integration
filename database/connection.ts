import mongoose from "mongoose";
import { createLogger } from "@shared/logger";

const logger = createLogger("database");

let hasListeners = false;

function registerListeners(): void {
  if (hasListeners) return;
  hasListeners = true;

  mongoose.connection.on("connected", () =>
    logger.info("MongoDB conectado", { state: "connected" })
  );
  mongoose.connection.on("disconnected", () =>
    logger.warn("MongoDB desconectado", { state: "disconnected" })
  );
  mongoose.connection.on("error", (err) =>
    logger.error("Erro na conexão MongoDB", { error: String(err) })
  );
}

export async function connectDatabase(uri: string, dbName: string): Promise<void> {
  registerListeners();

  if (mongoose.connection.readyState === 1) {
    logger.info("Conexão MongoDB já ativa", { database: dbName });
    return;
  }

  const maskedUri = uri.replace(/:\/\/[^@]+@/, "://<credentials>@");
  logger.info("Conectando ao MongoDB", { host: maskedUri, database: dbName });

  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  const db = mongoose.connection.db;
  if (!db) throw new Error("Conexão estabelecida mas db handle indisponível.");

  await db.admin().command({ ping: 1 });
  logger.info("MongoDB ping OK — serviço pronto", { database: dbName });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info("MongoDB desconectado com sucesso");
}
