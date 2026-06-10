export type JiraPayload = {
  jira_id: string;
  numero_documento?: string;
  cnpj_cpf?: string;
  valor?: number;
  [key: string]: unknown;
};

export type ApproverJiraInput = JiraPayload;
export type VerifyInvoiceJiraInput = JiraPayload;
export type UpdateOmieJiraInput = JiraPayload;

export type ReprocessJiraInput = {
  status?: string;
  desde?: string;
  limite?: number;
};

export type OrchestratorResult = {
  jira_id: string;
  acao: string;
  status: string;
  mensagem: string;
};
