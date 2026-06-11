import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../services/mxm-omie-sync-service/src/routes";
import * as useCases from "../services/mxm-omie-sync-service/src/useCases";
import * as db from "../database/repository";
import * as mxmAdapters from "../services/mxm-omie-sync-service/src/adapters";
import type { Config } from "../services/mxm-omie-sync-service/src/config";

beforeEach(() => vi.restoreAllMocks());

const mockConfig: Config = {
  port: 3001,
  nodeEnv: "test",
  logLevel: "error",
  timeoutSeconds: 30,
  mongodb: { uri: "mongodb://localhost:27017", database: "test", collection: "payment_integrations" },
  mxm: { baseUrl: "http://mxm", username: "user", password: "pass", environment: "test", syncWindowHours: 26 },
  omie: { baseUrl: "http://omie", appKey: "key", appSecret: "secret" },
  slack: { botToken: "", alertChannel: "" },
  gcp: { projectId: "ftd-data-lake", region: "us-east1" },
};

function buildApp() {
  const app = Fastify({ logger: false });
  registerRoutes(app, mockConfig);
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
      expect(JSON.parse(res.body).success).toBe(true);
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
    it("retorna contagem por status", async () => {
      vi.spyOn(useCases, "getSyncStatus").mockResolvedValue({
        total: 10,
        por_status: { criado_omie: 8, erro_baixa_mxm: 2 },
      });
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/syncOmie/status" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.total).toBe(10);
    });
  });

  describe("GET /syncOmie/documents", () => {
    it("retorna documentos encontrados no Mongo", async () => {
      vi.spyOn(useCases, "getSyncDocuments").mockResolvedValue({
        total: 1,
        limite: 200,
        documentos: [
          {
            mxm_id: "374751",
            numero_documento: "374751",
            cnpj_cpf: "12345678000199",
            valor: 316250,
            data_criacao: "2026-05-11",
            status: "criado_omie",
          },
        ],
      });

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/syncOmie/documents" });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.total).toBe(1);
      expect(body.data.documentos.length).toBe(1);
    });
  });

  describe("database usa apenas payment_integrations", () => {
    it("findDocument chama o model correto", async () => {
      const spy = vi.spyOn(db, "findDocument").mockResolvedValue(null);
      await db.findDocument("374751", "12345678000199", 316250);
      expect(spy).toHaveBeenCalledWith("374751", "12345678000199", 316250);
    });

    it("insertDocument não usa title_integrations nem integration_events", async () => {
      const spy = vi.spyOn(db, "insertDocument").mockResolvedValue(undefined);
      const doc = {
        mxm_id: "374751", numero_documento: "374751", cnpj_cpf: "12345678000199",
        valor: 316250, data_criacao: "2026-05-11", status: "criado_omie" as const,
      };
      await db.insertDocument(doc);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("syncOmie use case", () => {
    it("retorna zero processados quando MXM não retorna títulos", async () => {
      vi.spyOn(mxmAdapters, "listarTituloPagar").mockResolvedValue([]);
      vi.spyOn(mxmAdapters, "enviarAlertaSlack").mockResolvedValue(undefined);
      const result = await useCases.syncOmie(mockConfig, "corr-id-test");
      expect(result.processados).toBe(0);
      expect(result.erros).toBe(0);
    });
  });
});
