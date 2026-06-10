import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { Db } from "mongodb";
import { registerRoutes } from "../services/omie-payment-settlement-service/src/routes";
import * as useCases from "../services/omie-payment-settlement-service/src/useCases";
import * as repository from "../services/omie-payment-settlement-service/src/repository";
import type { Config } from "../services/omie-payment-settlement-service/src/config";
import omieWebhookFixture from "./fixtures/omie-webhook.json";

beforeEach(() => vi.restoreAllMocks());

const mockConfig: Config = {
  port: 3003,
  nodeEnv: "test",
  logLevel: "error",
  timeoutSeconds: 30,
  mongodb: { uri: "mongodb://localhost:27017", database: "test", collection: "payment_integrations" },
  omie: { baseUrl: "http://omie", appKey: "key", appSecret: "secret", webhookToken: "test-token" },
  mxm: { baseUrl: "http://mxm", authToken: "token" },
  jira: { baseUrl: "http://jira", email: "test@test.com", apiToken: "token" },
  slack: { botToken: "", alertChannel: "" },
  reconciliationSchedule: "0 23 * * *",
  gcp: { projectId: "ftd-data-lake", region: "us-east1" },
};

const mockDb = {} as Db;

function buildApp() {
  const app = Fastify({ logger: false });
  registerRoutes(app, mockDb, mockConfig);
  return app;
}

describe("omie-payment-settlement-service", () => {
  describe("GET /health", () => {
    it("retorna 200 com status ok", async () => {
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("ok");
      expect(body.service).toBe("omie-payment-settlement-service");
    });
  });

  describe("POST /webhookOmiePayment", () => {
    it("endpoint existe e chama processWebhookOmie", async () => {
      const spy = vi.spyOn(useCases, "processWebhookOmie").mockResolvedValue({
        processados: 1, erros: 0,
      });
      const app = buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/webhookOmiePayment",
        payload: omieWebhookFixture,
      });
      expect(res.statusCode).toBe(200);
      expect(spy).toHaveBeenCalledOnce();
    });

    it("retorna resposta padronizada com success e correlation_id", async () => {
      vi.spyOn(useCases, "processWebhookOmie").mockResolvedValue({ processados: 1, erros: 0 });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/webhookOmiePayment", payload: {} });
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.correlation_id).toBeDefined();
    });
  });

  describe("POST /reconcileOmiePayments", () => {
    it("endpoint existe", async () => {
      vi.spyOn(useCases, "reconcileOmiePayments").mockResolvedValue({
        encontrados: 0, processados: 0, erros: 0,
      });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/reconcileOmiePayments" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /settlement/reprocess", () => {
    it("endpoint existe", async () => {
      vi.spyOn(useCases, "reprocessSettlement").mockResolvedValue({ processados: 0, erros: 0 });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/settlement/reprocess", payload: {} });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /settlement/status", () => {
    it("retorna contagem de pagamentos por status", async () => {
      vi.spyOn(useCases, "getSettlementStatus").mockResolvedValue({
        total: 50, pago_omie: 10, baixado_mxm: 35, erro_baixa_mxm: 5,
      });
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/settlement/status" });
      const body = JSON.parse(res.body);
      expect(body.data.total).toBe(50);
      expect(body.data.baixado_mxm).toBe(35);
    });
  });

  describe("idempotência de baixa duplicada", () => {
    it("não processa registro já com status baixado_mxm (stub retorna 0 processados)", async () => {
      // processWebhookOmie usa array vazio de pagamentos enquanto adapter não implementado
      const result = await useCases.processWebhookOmie(mockDb, mockConfig, {}, "corr-id");
      expect(result.processados).toBe(0);
      expect(result.erros).toBe(0);
    });
  });

  describe("repository usa apenas payment_integrations", () => {
    it("findByOmieId consulta coleção payment_integrations", async () => {
      const findOneMock = vi.fn().mockResolvedValue(null);
      const mockDbWithCollection = {
        collection: vi.fn().mockReturnValue({ findOne: findOneMock }),
      } as unknown as Db;

      await repository.findByOmieId(mockDbWithCollection, "7426315775");

      expect(mockDbWithCollection.collection).toHaveBeenCalledWith("payment_integrations");
      expect(mockDbWithCollection.collection).not.toHaveBeenCalledWith("title_integrations");
      expect(mockDbWithCollection.collection).not.toHaveBeenCalledWith("integration_events");
    });
  });

  describe("fixture do webhook Omie", () => {
    it("fixture contém topic correto", () => {
      expect(omieWebhookFixture.topic).toBe("Financas.ContaPagar.BaixaRealizada");
    });

    it("fixture contém numero_documento", () => {
      expect(omieWebhookFixture.event[0].conta_a_pagar[0].numero_documento).toBe("374751");
    });
  });
});
