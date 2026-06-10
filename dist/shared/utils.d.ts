export declare function genCorrelationId(): string;
export declare function normalizeCpfCnpj(value: string): string;
export declare function toIsoDate(date: Date | string): string;
export declare function buildIdempotencyKey(numeroDocumento: string, cnpjCpf: string, valor: number): string;
export declare function toValueCents(value: number): number;
