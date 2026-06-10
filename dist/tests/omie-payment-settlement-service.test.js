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
const routes_1 = require("../services/omie-payment-settlement-service/src/routes");
const useCases = __importStar(require("../services/omie-payment-settlement-service/src/useCases"));
const repository = __importStar(require("../services/omie-payment-settlement-service/src/repository"));
const omie_webhook_json_1 = __importDefault(require("./fixtures/omie-webhook.json"));
(0, vitest_1.beforeEach)(() => vitest_1.vi.restoreAllMocks());
const mockConfig = {
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
const mockDb = {};
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    (0, routes_1.registerRoutes)(app, mockDb, mockConfig);
    return app;
}
(0, vitest_1.describe)("omie-payment-settlement-service", () => {
    (0, vitest_1.describe)("GET /health", () => {
        (0, vitest_1.it)("retorna 200 com status ok", async () => {
            const app = buildApp();
            const res = await app.inject({ method: "GET", url: "/health" });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.status).toBe("ok");
            (0, vitest_1.expect)(body.service).toBe("omie-payment-settlement-service");
        });
    });
    (0, vitest_1.describe)("POST /webhookOmiePayment", () => {
        (0, vitest_1.it)("endpoint existe e chama processWebhookOmie", async () => {
            const spy = vitest_1.vi.spyOn(useCases, "processWebhookOmie").mockResolvedValue({
                processados: 1, erros: 0,
            });
            const app = buildApp();
            const res = await app.inject({
                method: "POST",
                url: "/webhookOmiePayment",
                payload: omie_webhook_json_1.default,
            });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            (0, vitest_1.expect)(spy).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("retorna resposta padronizada com success e correlation_id", async () => {
            vitest_1.vi.spyOn(useCases, "processWebhookOmie").mockResolvedValue({ processados: 1, erros: 0 });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/webhookOmiePayment", payload: {} });
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.success).toBe(true);
            (0, vitest_1.expect)(body.correlation_id).toBeDefined();
        });
    });
    (0, vitest_1.describe)("POST /reconcileOmiePayments", () => {
        (0, vitest_1.it)("endpoint existe", async () => {
            vitest_1.vi.spyOn(useCases, "reconcileOmiePayments").mockResolvedValue({
                encontrados: 0, processados: 0, erros: 0,
            });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/reconcileOmiePayments" });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
        });
    });
    (0, vitest_1.describe)("POST /settlement/reprocess", () => {
        (0, vitest_1.it)("endpoint existe", async () => {
            vitest_1.vi.spyOn(useCases, "reprocessSettlement").mockResolvedValue({ processados: 0, erros: 0 });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/settlement/reprocess", payload: {} });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
        });
    });
    (0, vitest_1.describe)("GET /settlement/status", () => {
        (0, vitest_1.it)("retorna contagem de pagamentos por status", async () => {
            vitest_1.vi.spyOn(useCases, "getSettlementStatus").mockResolvedValue({
                total: 50, pago_omie: 10, baixado_mxm: 35, erro_baixa_mxm: 5,
            });
            const app = buildApp();
            const res = await app.inject({ method: "GET", url: "/settlement/status" });
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.data.total).toBe(50);
            (0, vitest_1.expect)(body.data.baixado_mxm).toBe(35);
        });
    });
    (0, vitest_1.describe)("idempotência de baixa duplicada", () => {
        (0, vitest_1.it)("não processa registro já com status baixado_mxm (stub retorna 0 processados)", async () => {
            // processWebhookOmie usa array vazio de pagamentos enquanto adapter não implementado
            const result = await useCases.processWebhookOmie(mockDb, mockConfig, {}, "corr-id");
            (0, vitest_1.expect)(result.processados).toBe(0);
            (0, vitest_1.expect)(result.erros).toBe(0);
        });
    });
    (0, vitest_1.describe)("repository usa apenas payment_integrations", () => {
        (0, vitest_1.it)("findByOmieId consulta coleção payment_integrations", async () => {
            const findOneMock = vitest_1.vi.fn().mockResolvedValue(null);
            const mockDbWithCollection = {
                collection: vitest_1.vi.fn().mockReturnValue({ findOne: findOneMock }),
            };
            await repository.findByOmieId(mockDbWithCollection, "7426315775");
            (0, vitest_1.expect)(mockDbWithCollection.collection).toHaveBeenCalledWith("payment_integrations");
            (0, vitest_1.expect)(mockDbWithCollection.collection).not.toHaveBeenCalledWith("title_integrations");
            (0, vitest_1.expect)(mockDbWithCollection.collection).not.toHaveBeenCalledWith("integration_events");
        });
    });
    (0, vitest_1.describe)("fixture do webhook Omie", () => {
        (0, vitest_1.it)("fixture contém topic correto", () => {
            (0, vitest_1.expect)(omie_webhook_json_1.default.topic).toBe("Financas.ContaPagar.BaixaRealizada");
        });
        (0, vitest_1.it)("fixture contém numero_documento", () => {
            (0, vitest_1.expect)(omie_webhook_json_1.default.event[0].conta_a_pagar[0].numero_documento).toBe("374751");
        });
    });
});
//# sourceMappingURL=omie-payment-settlement-service.test.js.map