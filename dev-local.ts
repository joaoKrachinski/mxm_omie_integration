import "dotenv/config";
import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "child_process";
import { resolve } from "path";

const SERVICE_MAP: Record<string, { entry: string; port: string }> = {
  sync: {
    entry: "services/mxm-omie-sync-service/src/server.ts",
    port: process.env.PORT_SYNC ?? "3001",
  },
  jira: {
    entry: "services/jira-payment-orchestrator-service/src/server.ts",
    port: process.env.PORT_JIRA ?? "3002",
  },
  settlement: {
    entry: "services/omie-payment-settlement-service/src/server.ts",
    port: process.env.PORT_SETTLEMENT ?? "3003",
  },
};

async function main() {
  const serviceName = process.argv[2];

  if (!serviceName || !SERVICE_MAP[serviceName]) {
    console.error(`Uso: tsx dev-local.ts <sync|jira|settlement>`);
    process.exit(1);
  }

  const { entry, port } = SERVICE_MAP[serviceName];

  console.log(`[dev-local] Iniciando MongoDB em memória...`);
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  console.log(`[dev-local] MongoDB pronto: ${uri}`);
  console.log(`[dev-local] Subindo ${serviceName} na porta ${port}...`);

  const env = { ...process.env, MONGODB_URI: uri, PORT: port };

  const child = spawn("npx", ["tsx", resolve(entry)], { env, stdio: "inherit" });

  const shutdown = async () => {
    child.kill();
    await mongod.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", async (code) => {
    await mongod.stop();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[dev-local] Erro:", err);
  process.exit(1);
});
