import { Db } from "mongodb";
import type { PaymentIntegration, IntegrationStatus } from "@shared/types";

const COLLECTION = process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS ?? "payment_integrations";

export async function findByIdempotencyKey(
  db: Db,
  numeroDocumento: string,
  cnpjCpf: string,
  valor: number
): Promise<PaymentIntegration | null> {
  return db.collection<PaymentIntegration>(COLLECTION).findOne({
    numero_documento: numeroDocumento,
    cnpj_cpf: cnpjCpf,
    valor,
  });
}

export async function findByJiraId(
  db: Db,
  jiraId: string
): Promise<PaymentIntegration | null> {
  return db.collection<PaymentIntegration>(COLLECTION).findOne({ jira_id: jiraId });
}

export async function updateJiraInfo(
  db: Db,
  numeroDocumento: string,
  cnpjCpf: string,
  valor: number,
  jiraId: string,
  extra?: Partial<PaymentIntegration>
): Promise<void> {
  await db.collection<PaymentIntegration>(COLLECTION).updateOne(
    { numero_documento: numeroDocumento, cnpj_cpf: cnpjCpf, valor },
    { $set: { jira_id: jiraId, status: "criado_jira" as IntegrationStatus, ...extra } }
  );
}

export async function updateStatus(
  db: Db,
  jiraId: string,
  status: IntegrationStatus,
  extra?: Partial<PaymentIntegration>
): Promise<void> {
  await db.collection<PaymentIntegration>(COLLECTION).updateOne(
    { jira_id: jiraId },
    { $set: { status, ...extra } }
  );
}

export async function findStuckByStatus(
  db: Db,
  status: string,
  desde?: string,
  limite = 100
): Promise<PaymentIntegration[]> {
  const filter: Record<string, unknown> = { status };
  if (desde) filter.data_criacao = { $lte: desde };
  return db
    .collection<PaymentIntegration>(COLLECTION)
    .find(filter)
    .limit(limite)
    .toArray() as Promise<PaymentIntegration[]>;
}
