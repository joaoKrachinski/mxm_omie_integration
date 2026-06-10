import { Db } from "mongodb";
import type { Config } from "./config";
import type { ApproverJiraInput, VerifyInvoiceJiraInput, UpdateOmieJiraInput, ReprocessJiraInput, OrchestratorResult } from "./types";
export declare function approverJira(db: Db, config: Config, input: ApproverJiraInput, correlationId: string): Promise<OrchestratorResult>;
export declare function verifyInvoiceJira(db: Db, config: Config, input: VerifyInvoiceJiraInput, correlationId: string): Promise<OrchestratorResult>;
export declare function updateOmieJira(db: Db, config: Config, input: UpdateOmieJiraInput, correlationId: string): Promise<OrchestratorResult>;
export declare function reprocessJira(db: Db, config: Config, input: ReprocessJiraInput, correlationId: string): Promise<{
    processados: number;
    erros: number;
}>;
