import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { Db } from "mongodb";
import { registerRoutes } from "../services/mxm-omie-sync-service/src/routes";
import * as useCases from "../services/mxm-omie-sync-service/src/useCases";
import * as repository from "../services/mxm-omie-sync-service/src/repository";
import type { Config } from "../services/mxm-omie-sync-service/src/config";

beforeEach(() => vi.restoreAllMocks());

const mockConfig: Config = {
  port: 3001,
  nodeEnv: "test",
  logLevel: "error",
  timeoutSeconds: 30,
  mongodb: { uri: "mongodb://localhost:27017", database: "test", collection: "payment_integrations" },
  mxm: { baseUrl: "http://mxm", authToken: "token", syncWindowHours: 26 },
  omie: { baseUrl: "http://omie", appKey: "key", appSecret: "secret" },
  slack: { botToken: "", alertChannel: "" },
  gcp: { projectId: "ftd-data-lake", region: "us-east1" },
};

const mockDb = {} as Db;

function buildApp() {
  const app = Fastify({ logger: false });
  registerRoutes(app, mockDb, mockConfig);
  return app;
}

describe("mxm-omie-sync-service", () => {
  describe("GET /health", () => {
    it("retorna 200 com status ok", async () => {
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("ok");
      expect(body.service).toBe("mxm-omie-sync-service");
    });
  });

  describe("POST /syncOmie", () => {
    it("endpoint existe e chama syncOmie use case", async () => {
      const spy = vi.spyOn(useCases, "syncOmie").mockResolvedValue({
        processados: 0, criados: 0, ignorados: 0, erros: 0,
      });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/syncOmie" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(spy).toHaveBeenCalledOnce();
    });

    it("retorna resposta HTTP padronizada com success e correlation_id", async () => {
      vi.spyOn(useCases, "syncOmie").mockResolvedValue({
        processados: 2, criados: 1, ignorados: 1, erros: 0,
      });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/syncOmie" });
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.correlation_id).toBeDefined();
      expect(body.data.processados).toBe(2);
    });
  });

  describe("POST /syncOmie/reprocess", () => {
    it("endpoint existe e chama reprocessOmie", async () => {
      const spy = vi.spyOn(useCases, "reprocessOmie").mockResolvedValue({
        processados: 0, criados: 0, ignorados: 0, erros: 0,
      });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/syncOmie/reprocess", payload: {} });
      expect(res.statusCode).toBe(200);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("GET /syncOmie/status", () => {
    it("endpoint existe e retorna contagem por status", async () => {
      vi.spyOn(useCases, "getSyncStatus").mockResolvedValue({
        total: 10,
        por_status: { criado_omie: 8, erro_baixa_mxm: 2 },
      });
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/syncOmie/status" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.total).toBe(10);
    });
  });

  describe("repository usa apenas payment_integrations", () => {
    it("findByIdempotencyKey consulta coleção payment_integrations", async () => {
      const findOneMock = vi.fn().mockResolvedValue(null);
      const mockDbWithCollection = {
        collection: vi.fn().mockReturnValue({ findOne: findOneMock }),
      } as unknown as Db;

      process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS = "payment_integrations";
      await repository.findByIdempotencyKey(mockDbWithCollection, "374751", "12345678000199", 316250);

      expect(mockDbWithCollection.collection).toHaveBeenCalledWith("payment_integrations");
      expect(mockDbWithCollection.collection).not.toHaveBeenCalledWith("title_integrations");
      expect(mockDbWithCollection.collection).not.toHaveBeenCalledWith("integration_events");
    });
  });

  describe("syncOmie use case", () => {
    it("retorna zero processados quando lista do MXM está vazia (stub)", async () => {
      // listarTituloPagar é stub: use case usa array vazio enquanto não implementado
      const result = await useCases.syncOmie(mockDb, mockConfig, "corr-id-test");
      expect(result.processados).toBe(0);
      expect(result.erros).toBe(0);
    });
  });
});
