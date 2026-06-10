import { Db } from "mongodb";
import type { PaymentIntegration, IntegrationStatus } from "@shared/types";

const COLLECTION = process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS ?? "payment_integrations";

export async function findByOmieId(
  db: Db,
  omieId: string
): Promise<PaymentIntegration | null> {
  return db.collection<PaymentIntegration>(COLLECTION).findOne({ omie_id: omieId });
}

export async function updateStatus(
  db: Db,
  omieId: string,
  status: IntegrationStatus,
  extra?: Partial<PaymentIntegration>
): Promise<void> {
  await db.collection<PaymentIntegration>(COLLECTION).updateOne(
    { omie_id: omieId },
    { $set: { status, ...extra } }
  );
}

export async function countByStatus(
  db: Db
): Promise<Record<string, number>> {
  const pipeline = [
    {
      $match: {
        status: { $in: ["pago_omie", "baixado_mxm", "erro_baixa_mxm"] },
      },
    },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ];
  const result = await db.collection(COLLECTION).aggregate(pipeline).toArray();
  return result.reduce((acc, { _id, count }) => {
    acc[_id as string] = count as number;
    return acc;
  }, {} as Record<string, number>);
}

export async function findPendingSettlement(
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

export async function countAll(db: Db): Promise<number> {
  return db.collection(COLLECTION).countDocuments();
}
