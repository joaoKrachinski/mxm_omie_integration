import mongoose, { Schema, InferSchemaType, Model } from "mongoose";
import type { IntegrationStatus } from "@shared/types";

const VALID_STATUSES: IntegrationStatus[] = [
  "criado_omie",
  "criado_jira",
  "aguardando_aprovacao",
  "nota_nao_encontrada",
  "vencido",
  "cancelado",
  "agendado_pagamento",
  "pago_omie",
  "baixado_mxm",
  "erro_baixa_mxm",
];

const PagamentoSchema = new Schema(
  {
    forma_pagamento: { type: String, enum: ["Pix", "Boleto", "Transferência Bancária"], required: true },
    chave:   String,
    codigo:  String,
    agencia: String,
    conta:   String,
    banco:   String,
  },
  { _id: false }
);

const PaymentIntegrationSchema = new Schema(
  {
    mxm_id:             { type: String, required: true },
    omie_id:            String,
    jira_id:            String,
    numero_documento:   { type: String, required: true },
    cnpj_cpf:           { type: String, required: true },
    valor:              { type: Number, required: true },
    data_criacao:       { type: String, required: true },
    status:             { type: String, enum: VALID_STATUSES, required: true },
    jira_creation_date: String,
    data_emissao:       String,
    vencimento:         String,
    tipo_nota:          String,
    pagamento:          PagamentoSchema,
    data_pagamento:     String,
    // Retenções fiscais (MXM)
    ValordoIRRF:              String,
    ValordoINSS:              String,
    ValordoISS:               String,
    ValordoPIS:               String,
    ValordoCOFINS:            String,
    ValordoCIDE:              String,
    ValordaContribuicaoSocial: String,
    INSSI:                    String,
  },
  {
    collection: process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS ?? "payment_integrations",
    versionKey: false,
  }
);

PaymentIntegrationSchema.index({ numero_documento: 1, cnpj_cpf: 1, valor: 1 }, { unique: true });
PaymentIntegrationSchema.index({ omie_id: 1 });
PaymentIntegrationSchema.index({ jira_id: 1 });
PaymentIntegrationSchema.index({ status: 1 });
PaymentIntegrationSchema.index({ vencimento: 1 });

export type PaymentIntegrationDoc = InferSchemaType<typeof PaymentIntegrationSchema>;

export function getPaymentIntegrationModel(): Model<PaymentIntegrationDoc> {
  return (
    (mongoose.models.PaymentIntegration as Model<PaymentIntegrationDoc>) ??
    mongoose.model<PaymentIntegrationDoc>("PaymentIntegration", PaymentIntegrationSchema)
  );
}
