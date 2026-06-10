"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const routes_1 = require("../services/jira-payment-orchestrator-service/src/routes");
const useCases = __importStar(require("../services/jira-payment-orchestrator-service/src/useCases"));
const repository = __importStar(require("../services/jira-payment-orchestrator-service/src/repository"));
(0, vitest_1.beforeEach)(() => vitest_1.vi.restoreAllMocks());
const mockConfig = {
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
const mockDb = {};
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    (0, routes_1.registerRoutes)(app, mockDb, mockConfig);
    return app;
}
(0, vitest_1.describe)("jira-payment-orchestrator-service", () => {
    (0, vitest_1.describe)("GET /health", () => {
        (0, vitest_1.it)("retorna 200 com status ok", async () => {
            const app = buildApp();
            const res = await app.inject({ method: "GET", url: "/health" });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.status).toBe("ok");
            (0, vitest_1.expect)(body.service).toBe("jira-payment-orchestrator-service");
        });
    });
    (0, vitest_1.describe)("POST /approverJira", () => {
        (0, vitest_1.it)("retorna 400 se jira_id não informado", async () => {
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/approverJira", payload: {} });
            (0, vitest_1.expect)(res.statusCode).toBe(400);
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.success).toBe(false);
        });
        (0, vitest_1.it)("chama approverJira use case quando jira_id presente", async () => {
            const spy = vitest_1.vi.spyOn(useCases, "approverJira").mockResolvedValue({
                jira_id: "SPAG-123", acao: "approver_jira", status: "pendente", mensagem: "ok",
            });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/approverJira", payload: { jira_id: "SPAG-123" } });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            (0, vitest_1.expect)(spy).toHaveBeenCalledOnce();
        });
    });
    (0, vitest_1.describe)("POST /verifyInvoiceJira", () => {
        (0, vitest_1.it)("endpoint existe e retorna resposta padronizada", async () => {
            vitest_1.vi.spyOn(useCases, "verifyInvoiceJira").mockResolvedValue({
                jira_id: "SPAG-123", acao: "verify_invoice", status: "criado_jira", mensagem: "ok",
            });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/verifyInvoiceJira", payload: { jira_id: "SPAG-123" } });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.success).toBe(true);
            (0, vitest_1.expect)(body.correlation_id).toBeDefined();
        });
        (0, vitest_1.it)("retorna status criado_jira (não jira_criado) ao encontrar título", async () => {
            // Testa que o use case retorna criado_jira quando título existe no MongoDB
            vitest_1.vi.spyOn(repository, "findByIdempotencyKey").mockResolvedValue({
                mxm_id: "374751",
                numero_documento: "374751",
                cnpj_cpf: "12345678000199",
                valor: 316250,
                data_criacao: "2026-05-11",
                status: "criado_omie",
            });
            vitest_1.vi.spyOn(repository, "updateJiraInfo").mockResolvedValue(undefined);
            const app = buildApp();
            const res = await app.inject({
                method: "POST",
                url: "/verifyInvoiceJira",
                payload: { jira_id: "SPAG-123", numero_documento: "374751", cnpj_cpf: "12.345.678/0001-99", valor: 316250 },
            });
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.success).toBe(true);
            (0, vitest_1.expect)(body.data.status).toBe("criado_jira");
            (0, vitest_1.expect)(body.data.status).not.toBe("jira_criado");
        });
    });
    (0, vitest_1.describe)("POST /updateOmieJira", () => {
        (0, vitest_1.it)("endpoint existe", async () => {
            vitest_1.vi.spyOn(useCases, "updateOmieJira").mockResolvedValue({
                jira_id: "SPAG-123", acao: "update_omie", status: "pendente", mensagem: "ok",
            });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/updateOmieJira", payload: { jira_id: "SPAG-123" } });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
        });
    });
    (0, vitest_1.describe)("POST /jira/reprocess", () => {
        (0, vitest_1.it)("endpoint existe", async () => {
            vitest_1.vi.spyOn(useCases, "reprocessJira").mockResolvedValue({ processados: 0, erros: 0 });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/jira/reprocess", payload: {} });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
        });
    });
    (0, vitest_1.describe)("repository usa apenas payment_integrations", () => {
        (0, vitest_1.it)("findByJiraId consulta coleção payment_integrations", async () => {
            const findOneMock = vitest_1.vi.fn().mockResolvedValue(null);
            const mockDbWithCollection = {
                collection: vitest_1.vi.fn().mockReturnValue({ findOne: findOneMock }),
            };
            await repository.findByJiraId(mockDbWithCollection, "SPAG-123");
            (0, vitest_1.expect)(mockDbWithCollection.collection).toHaveBeenCalledWith("payment_integrations");
            (0, vitest_1.expect)(mockDbWithCollection.collection).not.toHaveBeenCalledWith("title_integrations");
            (0, vitest_1.expect)(mockDbWithCollection.collection).not.toHaveBeenCalledWith("integration_events");
        });
    });
});
//# sourceMappingURL=jira-payment-orchestrator-service.test.js.map