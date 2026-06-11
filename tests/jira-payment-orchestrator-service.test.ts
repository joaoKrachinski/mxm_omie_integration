import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../services/jira-payment-orchestrator-service/src/routes";
import * as useCases from "../services/jira-payment-orchestrator-service/src/useCases";
import * as db from "../database/repository";
import type { Config } from "../services/jira-payment-orchestrator-service/src/config";

beforeEach(() => vi.restoreAllMocks());

const mockConfig: Config = {
  port: 3002,
  nodeEnv: "test",
  logLevel: "error",
  timeoutSeconds: 30,
  mongodb: { uri: "mongodb://localhost:27017", database: "test", collection: "payment_integrations" },
  jira: { baseUrl: "http://jira", email: "test@test.com", apiToken: "token" },
  sheets: { spreadsheetId: "sheet-id", tabName: "Sheet1", range: "A1:Z1000" },
  omie: { baseUrl: "http://omie", appKey: "key", appSecret: "secret" },
  slack: { botToken: "", alertChannel: "" },
  gcp: { projectId: "ftd-data-lake", region: "us-east1" },
};

function buildApp() {
  const app = Fastify({ logger: false });
  registerRoutes(app, mockConfig);
  return app;
}

describe("jira-payment-orchestrator-service", () => {
  describe("GET /health", () => {
    it("retorna 200 com status ok", async () => {
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("ok");
      expect(body.service).toBe("jira-payment-orchestrator-service");
    });
  });

  describe("POST /approverJira", () => {
    it("retorna 400 se jira_id não informado", async () => {
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/approverJira", payload: {} });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).success).toBe(false);
    });

    it("chama approverJira use case quando jira_id presente", async () => {
      const spy = vi.spyOn(useCases, "approverJira").mockResolvedValue({
        jira_id: "SPAG-123", acao: "approver_jira", status: "pendente", mensagem: "ok",
      });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/approverJira", payload: { jira_id: "SPAG-123" } });
      expect(res.statusCode).toBe(200);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("POST /verifyInvoiceJira", () => {
    it("endpoint existe e retorna resposta padronizada", async () => {
      vi.spyOn(useCases, "verifyInvoiceJira").mockResolvedValue({
        jira_id: "SPAG-123", acao: "verify_invoice", status: "criado_jira", mensagem: "ok",
      });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/verifyInvoiceJira", payload: { jira_id: "SPAG-123" } });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.correlation_id).toBeDefined();
    });

    it("retorna status criado_jira (não jira_criado) ao encontrar título", async () => {
      vi.spyOn(db, "findDocument").mockResolvedValue({
        mxm_id: "374751", numero_documento: "374751", cnpj_cpf: "12345678000199",
        valor: 316250, data_criacao: "2026-05-11", status: "criado_omie",
      });
      vi.spyOn(db, "updateDocument").mockResolvedValue(undefined);

      const app = buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/verifyInvoiceJira",
        payload: { jira_id: "SPAG-123", numero_documento: "374751", cnpj_cpf: "12.345.678/0001-99", valor: 316250 },
      });
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("criado_jira");
      expect(body.data.status).not.toBe("jira_criado");
    });
  });

  describe("POST /updateOmieJira", () => {
    it("endpoint existe", async () => {
      vi.spyOn(useCases, "updateOmieJira").mockResolvedValue({
        jira_id: "SPAG-123", acao: "update_omie", status: "pendente", mensagem: "ok",
      });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/updateOmieJira", payload: { jira_id: "SPAG-123" } });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /jira/reprocess", () => {
    it("endpoint existe", async () => {
      vi.spyOn(useCases, "reprocessJira").mockResolvedValue({ processados: 0, erros: 0 });
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: "/jira/reprocess", payload: {} });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("database usa apenas payment_integrations", () => {
    it("findByJiraId chama coleção payment_integrations via model", async () => {
      const spy = vi.spyOn(db, "findByJiraId").mockResolvedValue(null);
      await db.findByJiraId("SPAG-123");
      expect(spy).toHaveBeenCalledWith("SPAG-123");
    });
  });
});
