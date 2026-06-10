import { Db } from "mongodb";
import type { PaymentIntegration, IntegrationStatus } from "@shared/types";
export declare function findByIdempotencyKey(db: Db, numeroDocumento: string, cnpjCpf: string, valor: number): Promise<PaymentIntegration | null>;
export declare function findByJiraId(db: Db, jiraId: string): Promise<PaymentIntegration | null>;
export declare function updateJiraInfo(db: Db, numeroDocumento: string, cnpjCpf: string, valor: number, jiraId: string, extra?: Partial<PaymentIntegration>): Promise<void>;
export declare function updateStatus(db: Db, jiraId: string, status: IntegrationStatus, extra?: Partial<PaymentIntegration>): Promise<void>;
export declare function findStuckByStatus(db: Db, status: string, desde?: string, limite?: number): Promise<PaymentIntegration[]>;
