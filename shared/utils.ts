import { v4 as uuidv4 } from "uuid";

export function genCorrelationId(): string {
  return uuidv4();
}

export function normalizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

export function toIsoDate(date: Date | string): string {
  if (typeof date === "string") {
    return date.substring(0, 10);
  }
  return date.toISOString().substring(0, 10);
}

export function buildIdempotencyKey(
  numeroDocumento: string,
  cnpjCpf: string,
  valor: number
): string {
  return `${numeroDocumento}:${normalizeCpfCnpj(cnpjCpf)}:${valor}`;
}

export function toValueCents(value: number): number {
  return Math.round(value);
}
