import { Db } from "mongodb";
import type { Config } from "./config";
import type { ReprocessSettlementInput, SettlementStatusResult } from "./types";
export declare function processWebhookOmie(db: Db, config: Config, rawBody: unknown, correlationId: string): Promise<{
    processados: number;
    erros: number;
}>;
export declare function reconcileOmiePayments(db: Db, config: Config, correlationId: string): Promise<{
    encontrados: number;
    processados: number;
    erros: number;
}>;
export declare function reprocessSettlement(db: Db, config: Config, input: ReprocessSettlementInput, correlationId: string): Promise<{
    processados: number;
    erros: number;
}>;
export declare function getSettlementStatus(db: Db): Promise<SettlementStatusResult>;
