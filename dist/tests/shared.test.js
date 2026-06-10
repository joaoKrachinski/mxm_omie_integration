"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const utils_1 = require("@shared/utils");
const errors_1 = require("@shared/errors");
const logger_1 = require("@shared/logger");
(0, vitest_1.describe)("utils", () => {
    (0, vitest_1.describe)("normalizeCpfCnpj", () => {
        (0, vitest_1.it)("remove pontos, traços e barras de CNPJ", () => {
            (0, vitest_1.expect)((0, utils_1.normalizeCpfCnpj)("12.345.678/0001-99")).toBe("12345678000199");
        });
        (0, vitest_1.it)("remove pontos e traço de CPF", () => {
            (0, vitest_1.expect)((0, utils_1.normalizeCpfCnpj)("123.456.789-09")).toBe("12345678909");
        });
        (0, vitest_1.it)("retorna valor limpo se já estiver normalizado", () => {
            (0, vitest_1.expect)((0, utils_1.normalizeCpfCnpj)("12345678000199")).toBe("12345678000199");
        });
    });
    (0, vitest_1.describe)("toIsoDate", () => {
        (0, vitest_1.it)("extrai AAAA-MM-DD de uma string ISO", () => {
            (0, vitest_1.expect)((0, utils_1.toIsoDate)("2026-05-11T00:00:00-03:00")).toBe("2026-05-11");
        });
        (0, vitest_1.it)("formata Date como AAAA-MM-DD", () => {
            const d = new Date("2026-06-10T12:00:00Z");
            (0, vitest_1.expect)((0, utils_1.toIsoDate)(d)).toBe("2026-06-10");
        });
    });
    (0, vitest_1.describe)("buildIdempotencyKey", () => {
        (0, vitest_1.it)("gera chave composta correta", () => {
            const key = (0, utils_1.buildIdempotencyKey)("374751", "12345678000199", 316250);
            (0, vitest_1.expect)(key).toBe("374751:12345678000199:316250");
        });
        (0, vitest_1.it)("normaliza cnpj_cpf ao montar a chave", () => {
            const key = (0, utils_1.buildIdempotencyKey)("374751", "12.345.678/0001-99", 316250);
            (0, vitest_1.expect)(key).toBe("374751:12345678000199:316250");
        });
    });
    (0, vitest_1.describe)("genCorrelationId", () => {
        (0, vitest_1.it)("gera UUID v4 único", () => {
            const id1 = (0, utils_1.genCorrelationId)();
            const id2 = (0, utils_1.genCorrelationId)();
            (0, vitest_1.expect)(id1).not.toBe(id2);
            (0, vitest_1.expect)(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
    });
    (0, vitest_1.describe)("toValueCents", () => {
        (0, vitest_1.it)("arredonda valor para centavos inteiros", () => {
            (0, vitest_1.expect)((0, utils_1.toValueCents)(316250)).toBe(316250);
            (0, vitest_1.expect)((0, utils_1.toValueCents)(100.9)).toBe(101);
        });
    });
});
(0, vitest_1.describe)("errors", () => {
    (0, vitest_1.it)("AppError tem statusCode e code corretos", () => {
        const err = new errors_1.AppError("Erro interno", 500, "INTERNAL_ERROR");
        (0, vitest_1.expect)(err.statusCode).toBe(500);
        (0, vitest_1.expect)(err.code).toBe("INTERNAL_ERROR");
        (0, vitest_1.expect)(err.message).toBe("Erro interno");
    });
    (0, vitest_1.it)("NotFoundError tem statusCode 404", () => {
        const err = new errors_1.NotFoundError("Não encontrado");
        (0, vitest_1.expect)(err.statusCode).toBe(404);
        (0, vitest_1.expect)(err.code).toBe("NOT_FOUND");
    });
    (0, vitest_1.it)("ValidationError tem statusCode 400", () => {
        const err = new errors_1.ValidationError("Campo obrigatório");
        (0, vitest_1.expect)(err.statusCode).toBe(400);
        (0, vitest_1.expect)(err.code).toBe("VALIDATION_ERROR");
    });
});
(0, vitest_1.describe)("logger", () => {
    (0, vitest_1.it)("cria logger com nome do serviço", () => {
        const logger = (0, logger_1.createLogger)("test-service");
        (0, vitest_1.expect)(typeof logger.info).toBe("function");
        (0, vitest_1.expect)(typeof logger.warn).toBe("function");
        (0, vitest_1.expect)(typeof logger.error).toBe("function");
        (0, vitest_1.expect)(typeof logger.debug).toBe("function");
    });
    (0, vitest_1.it)("emite JSON estruturado no stdout", () => {
        const spy = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        const logger = (0, logger_1.createLogger)("test-service");
        logger.info("mensagem de teste", { correlation_id: "abc-123" });
        (0, vitest_1.expect)(spy).toHaveBeenCalledOnce();
        const output = JSON.parse(spy.mock.calls[0][0]);
        (0, vitest_1.expect)(output.service_name).toBe("test-service");
        (0, vitest_1.expect)(output.message).toBe("mensagem de teste");
        (0, vitest_1.expect)(output.correlation_id).toBe("abc-123");
        spy.mockRestore();
    });
});
//# sourceMappingURL=shared.test.js.map