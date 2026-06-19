import { getPaymentIntegrationModel } from "./schema";
import { createLogger } from "@shared/logger";
import type { PaymentIntegration, IntegrationStatus } from "@shared/types";

const logger = createLogger("database", "repository");

function buildFilter(status?: string, desde?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (desde) filter.data_criacao = { $gte: desde };
  return filter;
}

// ─── Core: as três funções principais ────────────────────────────────────────

export async function insertDocument(doc: PaymentIntegration): Promise<void> {
  const Model = getPaymentIntegrationModel();
  const created = await Model.create(doc);
  logger.info("insertDocument OK", {
    numero_documento: doc.numero_documento,
    cnpj_cpf: doc.cnpj_cpf,
    valor: doc.valor,
    inserted_id: String(created._id),
    status: created.status,
  });
}

export async function findDocument(
  numeroDocumento: string,
  cnpjCpf: string,
  valor: number
): Promise<PaymentIntegration | null> {
  const Model = getPaymentIntegrationModel();
  const doc = await Model.findOne({ numero_documento: numeroDocumento, cnpj_cpf: cnpjCpf, valor }).lean();
  logger.info("findDocument OK", {
    numero_documento: numeroDocumento,
    cnpj_cpf: cnpjCpf,
    valor,
    found: Boolean(doc),
  });
  return doc as PaymentIntegration | null;
}

export async function updateDocument(
  numeroDocumento: string,
  cnpjCpf: string,
  valor: number,
  changes: Partial<PaymentIntegration>
): Promise<void> {
  const Model = getPaymentIntegrationModel();
  const result = await Model.updateOne(
    { numero_documento: numeroDocumento, cnpj_cpf: cnpjCpf, valor },
    { $set: changes },
    { runValidators: true }
  );
  logger.info("updateDocument OK", {
    numero_documento: numeroDocumento,
    cnpj_cpf: cnpjCpf,
    valor,
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
  if (result.matchedCount === 0) {
    throw new Error(
      `Documento não encontrado para update: numero_documento=${numeroDocumento}, cnpj_cpf=${cnpjCpf}, valor=${valor}`
    );
  }
}

export async function findDocumentByCnpjNumero(
  cnpjCpf: string,
  numeroDocumento: string
): Promise<PaymentIntegration | null> {
  const Model = getPaymentIntegrationModel();
  const doc = await Model.findOne({ cnpj_cpf: cnpjCpf, numero_documento: numeroDocumento }).lean();
  logger.info("findDocumentByCnpjNumero OK", {
    cnpj_cpf: cnpjCpf,
    numero_documento: numeroDocumento,
    found: Boolean(doc),
  });
  return doc as PaymentIntegration | null;
}

// ─── Queries auxiliares ───────────────────────────────────────────────────────

export async function findByOmieId(omieId: string): Promise<PaymentIntegration | null> {
  const Model = getPaymentIntegrationModel();
  const doc = await Model.findOne({ omie_id: omieId }).lean();
  return doc as PaymentIntegration | null;
}

export async function findByJiraId(jiraId: string): Promise<PaymentIntegration | null> {
  const Model = getPaymentIntegrationModel();
  const doc = await Model.findOne({ jira_id: jiraId }).lean();
  return doc as PaymentIntegration | null;
}

export async function updateByOmieId(
  omieId: string,
  changes: Partial<PaymentIntegration>
): Promise<void> {
  const Model = getPaymentIntegrationModel();
  await Model.updateOne({ omie_id: omieId }, { $set: changes }, { runValidators: true });
}

export async function updateByJiraId(
  jiraId: string,
  changes: Partial<PaymentIntegration>
): Promise<void> {
  const Model = getPaymentIntegrationModel();
  await Model.updateOne({ jira_id: jiraId }, { $set: changes }, { runValidators: true });
}

export async function countByStatus(): Promise<Record<string, number>> {
  const Model = getPaymentIntegrationModel();
  const result = await Model.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  return result.reduce((acc: Record<string, number>, { _id, count }) => {
    acc[_id as string] = count as number;
    return acc;
  }, {});
}

export async function findPendingReprocess(
  status?: string,
  desde?: string,
  limite = 100
): Promise<PaymentIntegration[]> {
  const Model = getPaymentIntegrationModel();
  const docs = await Model.find(buildFilter(status, desde)).limit(limite).lean();
  return docs as unknown as PaymentIntegration[];
}

export async function listDocuments(
  status?: string,
  desde?: string,
  limite = 200
): Promise<PaymentIntegration[]> {
  const Model = getPaymentIntegrationModel();
  const docs = await Model.find(buildFilter(status, desde))
    .sort({ data_criacao: -1, _id: -1 })
    .limit(limite)
    .lean();
  logger.info("listDocuments OK", {
    status_filter: status ?? "all",
    desde_filter: desde ?? "none",
    limite,
    returned: docs.length,
  });
  return docs as unknown as PaymentIntegration[];
}

export async function countDocuments(status?: string, desde?: string): Promise<number> {
  const Model = getPaymentIntegrationModel();
  return Model.countDocuments(buildFilter(status, desde));
}
