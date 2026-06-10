import type { FastifyReply } from "fastify";
import type { HttpSuccess, HttpError } from "./types";
import { AppError } from "./errors";

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  correlationId: string,
  statusCode = 200
): void {
  const body: HttpSuccess<T> = { success: true, data, correlation_id: correlationId };
  reply.status(statusCode).send(body);
}

export function sendError(
  reply: FastifyReply,
  error: unknown,
  correlationId: string
): void {
  if (error instanceof AppError) {
    const body: HttpError = {
      success: false,
      error: error.message,
      correlation_id: correlationId,
    };
    reply.status(error.statusCode).send(body);
    return;
  }
  const body: HttpError = {
    success: false,
    error: "Erro interno do servidor",
    correlation_id: correlationId,
  };
  reply.status(500).send(body);
}
