import { Db } from "mongodb";
import type { Config } from "./config";
import type { SyncOmieResult, ReprocessInput, StatusResult } from "./types";
export declare function syncOmie(db: Db, config: Config, correlationId: string): Promise<SyncOmieResult>;
export declare function reprocessOmie(db: Db, config: Config, input: ReprocessInput, correlationId: string): Promise<SyncOmieResult>;
export declare function getSyncStatus(db: Db): Promise<StatusResult>;
