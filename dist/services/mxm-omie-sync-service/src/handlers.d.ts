import type { FastifyRequest, FastifyReply } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "./config";
export declare function makeHandlers(db: Db, config: Config): {
    handleSyncOmie: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    handleReprocess: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    handleStatus: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    handleHealth: (_req: FastifyRequest, reply: FastifyReply) => Promise<void>;
};
