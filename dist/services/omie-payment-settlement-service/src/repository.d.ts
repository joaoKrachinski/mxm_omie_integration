import { Db } from "mongodb";
import type { PaymentIntegration, IntegrationStatus } from "@shared/types";
export declare function findByOmieId(db: Db, omieId: string): Promise<PaymentIntegration | null>;
export declare function updateStatus(db: Db, omieId: string, status: IntegrationStatus, extra?: Partial<PaymentIntegration>): Promise<void>;
export declare function countByStatus(db: Db): Promise<Record<string, number>>;
export declare function findPendingSettlement(db: Db, status?: string, desde?: string, limite?: number): Promise<PaymentIntegration[]>;
export declare function countAll(db: Db): Promise<number>;
