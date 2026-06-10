import { describe, it, expect, vi } from "vitest";
import { normalizeCpfCnpj, toIsoDate, buildIdempotencyKey, genCorrelationId, toValueCents } from "@shared/utils";
import { AppError, NotFoundError, ValidationError } from "@shared/errors";
import { createLogger } from "@shared/logger";

describe("utils", () => {
  describe("normalizeCpfCnpj", () => {
    it("remove pontos, traços e barras de CNPJ", () => {
      expect(normalizeCpfCnpj("12.345.678/0001-99")).toBe("12345678000199");
    });

    it("remove pontos e traço de CPF", () => {
      expect(normalizeCpfCnpj("123.456.789-09")).toBe("12345678909");
    });

    it("retorna valor limpo se já estiver normalizado", () => {
      expect(normalizeCpfCnpj("12345678000199")).toBe("12345678000199");
    });
  });

  describe("toIsoDate", () => {
    it("extrai AAAA-MM-DD de uma string ISO", () => {
      expect(toIsoDate("2026-05-11T00:00:00-03:00")).toBe("2026-05-11");
    });

    it("formata Date como AAAA-MM-DD", () => {
      const d = new Date("2026-06-10T12:00:00Z");
      expect(toIsoDate(d)).toBe("2026-06-10");
    });
  });

  describe("buildIdempotencyKey", () => {
    it("gera chave composta correta", () => {
      const key = buildIdempotencyKey("374751", "12345678000199", 316250);
      expect(key).toBe("374751:12345678000199:316250");
    });

    it("normaliza cnpj_cpf ao montar a chave", () => {
      const key = buildIdempotencyKey("374751", "12.345.678/0001-99", 316250);
      expect(key).toBe("374751:12345678000199:316250");
    });
  });

  describe("genCorrelationId", () => {
    it("gera UUID v4 único", () => {
      const id1 = genCorrelationId();
      const id2 = genCorrelationId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe("toValueCents", () => {
    it("arredonda valor para centavos inteiros", () => {
      expect(toValueCents(316250)).toBe(316250);
      expect(toValueCents(100.9)).toBe(101);
    });
  });
});

describe("errors", () => {
  it("AppError tem statusCode e code corretos", () => {
    const err = new AppError("Erro interno", 500, "INTERNAL_ERROR");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).toBe("Erro interno");
  });

  it("NotFoundError tem statusCode 404", () => {
    const err = new NotFoundError("Não encontrado");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("ValidationError tem statusCode 400", () => {
    const err = new ValidationError("Campo obrigatório");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });
});

describe("logger", () => {
  it("cria logger com nome do serviço", () => {
    const logger = createLogger("test-service");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("emite JSON estruturado no stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createLogger("test-service");
    logger.info("mensagem de teste", { correlation_id: "abc-123" });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.service_name).toBe("test-service");
    expect(output.message).toBe("mensagem de teste");
    expect(output.correlation_id).toBe("abc-123");
    spy.mockRestore();
  });
});
