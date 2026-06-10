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
const routes_1 = require("../services/mxm-omie-sync-service/src/routes");
const useCases = __importStar(require("../services/mxm-omie-sync-service/src/useCases"));
const repository = __importStar(require("../services/mxm-omie-sync-service/src/repository"));
(0, vitest_1.beforeEach)(() => vitest_1.vi.restoreAllMocks());
const mockConfig = {
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
const mockDb = {};
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    (0, routes_1.registerRoutes)(app, mockDb, mockConfig);
    return app;
}
(0, vitest_1.describe)("mxm-omie-sync-service", () => {
    (0, vitest_1.describe)("GET /health", () => {
        (0, vitest_1.it)("retorna 200 com status ok", async () => {
            const app = buildApp();
            const res = await app.inject({ method: "GET", url: "/health" });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.status).toBe("ok");
            (0, vitest_1.expect)(body.service).toBe("mxm-omie-sync-service");
        });
    });
    (0, vitest_1.describe)("POST /syncOmie", () => {
        (0, vitest_1.it)("endpoint existe e chama syncOmie use case", async () => {
            const spy = vitest_1.vi.spyOn(useCases, "syncOmie").mockResolvedValue({
                processados: 0, criados: 0, ignorados: 0, erros: 0,
            });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/syncOmie" });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.success).toBe(true);
            (0, vitest_1.expect)(spy).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("retorna resposta HTTP padronizada com success e correlation_id", async () => {
            vitest_1.vi.spyOn(useCases, "syncOmie").mockResolvedValue({
                processados: 2, criados: 1, ignorados: 1, erros: 0,
            });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/syncOmie" });
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.success).toBe(true);
            (0, vitest_1.expect)(body.correlation_id).toBeDefined();
            (0, vitest_1.expect)(body.data.processados).toBe(2);
        });
    });
    (0, vitest_1.describe)("POST /syncOmie/reprocess", () => {
        (0, vitest_1.it)("endpoint existe e chama reprocessOmie", async () => {
            const spy = vitest_1.vi.spyOn(useCases, "reprocessOmie").mockResolvedValue({
                processados: 0, criados: 0, ignorados: 0, erros: 0,
            });
            const app = buildApp();
            const res = await app.inject({ method: "POST", url: "/syncOmie/reprocess", payload: {} });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            (0, vitest_1.expect)(spy).toHaveBeenCalledOnce();
        });
    });
    (0, vitest_1.describe)("GET /syncOmie/status", () => {
        (0, vitest_1.it)("endpoint existe e retorna contagem por status", async () => {
            vitest_1.vi.spyOn(useCases, "getSyncStatus").mockResolvedValue({
                total: 10,
                por_status: { criado_omie: 8, erro_baixa_mxm: 2 },
            });
            const app = buildApp();
            const res = await app.inject({ method: "GET", url: "/syncOmie/status" });
            (0, vitest_1.expect)(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            (0, vitest_1.expect)(body.data.total).toBe(10);
        });
    });
    (0, vitest_1.describe)("repository usa apenas payment_integrations", () => {
        (0, vitest_1.it)("findByIdempotencyKey consulta coleção payment_integrations", async () => {
            const findOneMock = vitest_1.vi.fn().mockResolvedValue(null);
            const mockDbWithCollection = {
                collection: vitest_1.vi.fn().mockReturnValue({ findOne: findOneMock }),
            };
            process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS = "payment_integrations";
            await repository.findByIdempotencyKey(mockDbWithCollection, "374751", "12345678000199", 316250);
            (0, vitest_1.expect)(mockDbWithCollection.collection).toHaveBeenCalledWith("payment_integrations");
            (0, vitest_1.expect)(mockDbWithCollection.collection).not.toHaveBeenCalledWith("title_integrations");
            (0, vitest_1.expect)(mockDbWithCollection.collection).not.toHaveBeenCalledWith("integration_events");
        });
    });
    (0, vitest_1.describe)("syncOmie use case", () => {
        (0, vitest_1.it)("retorna zero processados quando lista do MXM está vazia (stub)", async () => {
            // listarTituloPagar é stub: use case usa array vazio enquanto não implementado
            const result = await useCases.syncOmie(mockDb, mockConfig, "corr-id-test");
            (0, vitest_1.expect)(result.processados).toBe(0);
            (0, vitest_1.expect)(result.erros).toBe(0);
        });
    });
});
//# sourceMappingURL=mxm-omie-sync-service.test.js.map