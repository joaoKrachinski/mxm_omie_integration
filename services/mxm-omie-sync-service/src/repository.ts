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

export async function insertPaymentIntegration(
  db: Db,
  doc: PaymentIntegration
): Promise<void> {
  await db.collection<PaymentIntegration>(COLLECTION).insertOne(doc as any);
}

export async function updateStatus(
  db: Db,
  numeroDocumento: string,
  cnpjCpf: string,
  valor: number,
  status: IntegrationStatus,
  extra?: Partial<PaymentIntegration>
): Promise<void> {
  await db.collection<PaymentIntegration>(COLLECTION).updateOne(
    { numero_documento: numeroDocumento, cnpj_cpf: cnpjCpf, valor },
    { $set: { status, ...extra } }
  );
}

export async function countByStatus(
  db: Db
): Promise<Record<string, number>> {
  const pipeline = [
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ];
  const result = await db.collection(COLLECTION).aggregate(pipeline).toArray();
  return result.reduce((acc, { _id, count }) => {
    acc[_id as string] = count as number;
    return acc;
  }, {} as Record<string, number>);
}

export async function findPendingReprocess(
  db: Db,
  status?: string,
  desde?: string,
  limite = 100
): Promise<PaymentIntegration[]> {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (desde) filter.data_criacao = { $gte: desde };
  return db
    .collection<PaymentIntegration>(COLLECTION)
    .find(filter)
    .limit(limite)
    .toArray() as Promise<PaymentIntegration[]>;
}
