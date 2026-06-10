import type { FastifyReply } from "fastify";
export declare function sendSuccess<T>(reply: FastifyReply, data: T, correlationId: string, statusCode?: number): void;
export declare function sendError(reply: FastifyReply, error: unknown, correlationId: string): void;
