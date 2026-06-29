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

// Converte qualquer formato de data para dd/mm/yyyy (exigido pelo Omie)
export function toOmieDate(date: Date | string | number): string {
  if (date instanceof Date) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }
  // Unix timestamp em milissegundos (número)
  if (typeof date === "number") return toOmieDate(new Date(date));
  // Unix timestamp como string numérica (ex: "1750291200000")
  if (/^\d{10,13}$/.test(date.trim())) return toOmieDate(new Date(Number(date)));
  // já está no formato dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
  // formato yyyy-mm-dd ou ISO completo (2026-06-25T00:00:00.000+0000)
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [y, m, d] = date.substring(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  // fallback: tenta parsear como Date
  const parsed = new Date(date);
  if (!isNaN(parsed.getTime())) return toOmieDate(parsed);
  return date; // retorna como está se não conseguir converter
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
