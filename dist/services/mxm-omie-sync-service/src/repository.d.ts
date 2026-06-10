import { Db } from "mongodb";
import type { PaymentIntegration, IntegrationStatus } from "@shared/types";
export declare function findByIdempotencyKey(db: Db, numeroDocumento: string, cnpjCpf: string, valor: number): Promise<PaymentIntegration | null>;
export declare function insertPaymentIntegration(db: Db, doc: PaymentIntegration): Promise<void>;
export declare function updateStatus(db: Db, numeroDocumento: string, cnpjCpf: string, valor: number, status: IntegrationStatus, extra?: Partial<PaymentIntegration>): Promise<void>;
export declare function countByStatus(db: Db): Promise<Record<string, number>>;
export declare function findPendingReprocess(db: Db, status?: string, desde?: string, limite?: number): Promise<PaymentIntegration[]>;
