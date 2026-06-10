import type { FastifyInstance } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "./config";
export declare function registerRoutes(app: FastifyInstance, db: Db, config: Config): void;
