import { Db } from "mongodb";
export declare function connectMongo(uri: string, dbName: string): Promise<Db>;
export declare function disconnectMongo(): Promise<void>;
export declare function getDb(): Db;
export declare function setupIndexes(database: Db, collection: string): Promise<void>;
