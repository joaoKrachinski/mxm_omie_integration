import type { FastifyRequest, FastifyReply } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "./config";
export declare function makeHandlers(db: Db, config: Config): {
    handleApproverJira: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    handleVerifyInvoiceJira: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    handleUpdateOmieJira: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    handleReprocess: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    handleHealth: (_req: FastifyRequest, reply: FastifyReply) => Promise<void>;
};
