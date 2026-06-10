export type IntegrationStatus =
  | "criado_omie"
  | "criado_jira"
  | "aguardando_aprovacao"
  | "nota_nao_encontrada"
  | "vencido"
  | "cancelado"
  | "agendado_pagamento"
  | "pago_omie"
  | "baixado_mxm"
  | "erro_baixa_mxm";

export type Pagamento =
  | { forma_pagamento: "pix"; chave: string }
  | { forma_pagamento: "boleto"; codigo: string }
  | { forma_pagamento: "transferencia"; agencia: string; conta: string; banco: string };

export type PaymentIntegration = {
  mxm_id: string;
  omie_id?: string;
  jira_id?: string;
  numero_documento: string;
  cnpj_cpf: string;
  valor: number;
  data_criacao: string;
  status: IntegrationStatus;
  jira_creation_date?: string;
  data_emissao?: string;
  vencimento?: string;
  pagamento?: Pagamento;
  data_pagamento?: string;
};

export type HttpSuccess<T = unknown> = {
  success: true;
  data: T;
  correlation_id: string;
};

export type HttpError = {
  success: false;
  error: string;
  correlation_id: string;
};
