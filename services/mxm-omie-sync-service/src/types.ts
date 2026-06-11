import type { PaymentIntegration } from "@shared/types";

export type SyncOmieResult = {
  processados: number;
  criados: number;
  ignorados: number;
  erros: number;
};

export type ReprocessInput = {
  status?: string;
  desde?: string;
  limite?: number;
};

export type StatusResult = {
  total: number;
  por_status: Record<string, number>;
};

export type ListDocumentsInput = {
  status?: string;
  desde?: string;
  limite?: number | string;
};

export type DocumentsResult = {
  total: number;
  limite: number;
  documentos: PaymentIntegration[];
};
