// ─── Payload raw enviado pela automação do Jira ──────────────────────────────

// Campos de seleção (option/select) do Jira retornam: { id, self, value }
type JiraOptionField = { id: string; self: string; value: string } | null;

export type JiraWebhookPayload = {
  issue: {
    self?: string;
    id?: number;
    key: string;
    fields: {
      // Campos de texto livre
      customfield_12112?: string;        // numero_do_titulo
      customfield_10184?: string;        // data_emissao (ISODate)
      customfield_10181?: string | number; // valor
      customfield_10183?: string;        // vencimento (ISODate)
      customfield_10186?: string;        // linha_digitavel_boleto
      customfield_10180?: string;        // cnpj_do_fornecedor
      customfield_10179?: string;        // nome_do_fornecedor
      customfield_10178?: string;        // numero_do_titulo_producao
      customfield_10214?: string;        // codigo_ntc
      customfield_10189?: string;        // agencia_bancaria
      customfield_10190?: string;        // conta_bancaria
      summary?: string;                  // título da issue
      // Campos de seleção — retornam { id, self, value }
      customfield_12568?: JiraOptionField;  // tipo_do_titulo
      customfield_10182?: JiraOptionField;  // metodo_de_pagamento
      customfield_10195?: JiraOptionField;  // centro_de_custo
      customfield_10196?: JiraOptionField;  // tipo_de_pagamento
      customfield_12243?: JiraOptionField;  // banco
      customfield_11645?: JiraOptionField;  // squad
      customfield_12563?: JiraOptionField;  // fornecedores_finance
      customfield_12562?: JiraOptionField;  // fornecedores_growth
      customfield_12416?: JiraOptionField;  // fornecedores_influ
      customfield_12425?: JiraOptionField;  // fornecedores_legal
      customfield_12564?: JiraOptionField;  // fornecedores_operations
      customfield_12566?: JiraOptionField;  // fornecedores_people
      customfield_12565?: JiraOptionField;  // fornecedores_technology
      customfield_15100?: JiraOptionField;  // validacao_forge_app
      customfield_15101?: JiraOptionField;  // validacao_forge_jira
      customfield_15143?: JiraOptionField;  // validacao_qive
      customfield_15145?: JiraOptionField;  // validacao_ocr_ia
      status?: {
        name?: string;
        id?: number;
        [key: string]: unknown;
      };
      creator?: {
        displayName?: string;
        accountId?: string;
        [key: string]: unknown;
      };
      // Qualquer outro campo desconhecido
      [key: string]: unknown;
    };
  };
};

// ─── Representação interna simplificada (após mapeamento) ────────────────────

export type JiraIssueData = {
  // Campos obrigatórios
  jira_id: string;

  // Campos conhecidos do payload
  tipo_nota?: string;
  numero_documento?: string;   // customfield_12112 ?? customfield_10178
  data_emissao?: string;
  valor?: number;
  vencimento?: string;
  metodo_de_pagamento?: string;
  linha_digitavel_boleto?: string;
  cnpj_cpf?: string;
  nome_fornecedor?: string;
  codigo_ntc?: string;
  centro_de_custo?: string;
  tipo_de_pagamento?: string;
  agencia?: string;
  conta?: string;
  banco?: string;
  status_jira?: string;
  criador?: string;
  summary?: string;
  squad?: string;
  fornecedor?: string;
  validacao_forge_app?: string;
  validacao_forge_jira?: string;
  validacao_qive?: string;
  validacao_ocr_ia?: string;

  // Campos extras não mapeados ficam aqui
  campos_extras: Record<string, unknown>;
};

// ─── Função de mapeamento: raw Jira → interno ────────────────────────────────

function optVal(field: JiraOptionField | undefined): string | undefined {
  if (!field) return undefined;
  return field.value ?? undefined;
}

export function mapJiraPayload(payload: JiraWebhookPayload): JiraIssueData {
  const { key, fields } = payload.issue;

  const valorRaw = fields.customfield_10181;
  const valor = valorRaw != null ? parseFloat(String(valorRaw)) : undefined;

  // Campos conhecidos que já foram extraídos
  const camposConhecidos = new Set([
    "customfield_12568", "customfield_12112", "customfield_10184",
    "customfield_10181", "customfield_10183", "customfield_10182",
    "customfield_10186", "customfield_10180", "customfield_10179",
    "customfield_10178", "customfield_10214", "customfield_10195",
    "customfield_10196", "customfield_10189", "customfield_10190",
    "customfield_12243", "customfield_11645", "summary",
    "customfield_12563", "customfield_12562", "customfield_12416",
    "customfield_12425", "customfield_12564", "customfield_12566", "customfield_12565",
    "customfield_15100", "customfield_15101", "customfield_15143", "customfield_15145",
    "status", "creator", "self",
  ]);

  // Tudo que não foi mapeado vai para campos_extras
  const campos_extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!camposConhecidos.has(k)) {
      campos_extras[k] = v;
    }
  }

  return {
    jira_id:                   key,
    summary:                   fields.summary ?? undefined,
    tipo_nota:                 optVal(fields.customfield_12568),
    numero_documento:          fields.customfield_12112 ?? fields.customfield_10178 ?? undefined,
    data_emissao:              fields.customfield_10184 ?? undefined,
    valor:                     Number.isFinite(valor) ? valor : undefined,
    vencimento:                fields.customfield_10183 ?? undefined,
    metodo_de_pagamento:       optVal(fields.customfield_10182),
    linha_digitavel_boleto:    fields.customfield_10186 ?? undefined,
    cnpj_cpf:                  fields.customfield_10180 ?? undefined,
    nome_fornecedor:           fields.customfield_10179 ?? undefined,
    codigo_ntc:                fields.customfield_10214 ?? undefined,
    centro_de_custo:           optVal(fields.customfield_10195),
    tipo_de_pagamento:         optVal(fields.customfield_10196),
    agencia:                   fields.customfield_10189 ?? undefined,
    conta:                     fields.customfield_10190 ?? undefined,
    banco:                     optVal(fields.customfield_12243),
    status_jira:               fields.status?.name ?? undefined,
    criador:                   fields.creator?.accountId ?? undefined,
    squad:                     optVal(fields.customfield_11645),
    fornecedor:                optVal(fields.customfield_12563)
                            ?? optVal(fields.customfield_12562)
                            ?? optVal(fields.customfield_12416)
                            ?? optVal(fields.customfield_12425)
                            ?? optVal(fields.customfield_12564)
                            ?? optVal(fields.customfield_12566)
                            ?? optVal(fields.customfield_12565)
                            ?? undefined,
    validacao_forge_app:       optVal(fields.customfield_15100),
    validacao_forge_jira:      optVal(fields.customfield_15101),
    validacao_qive:            optVal(fields.customfield_15143),
    validacao_ocr_ia:          optVal(fields.customfield_15145),
    campos_extras,
  };
}

// ─── Tipos de input dos handlers ─────────────────────────────────────────────

export type ApproverJiraInput   = JiraWebhookPayload;
export type VerifyInvoiceJiraInput = JiraWebhookPayload;
export type UpdateOmieJiraInput = JiraWebhookPayload;

export type ReprocessJiraInput = {
  status?: string;
  desde?: string;
  limite?: number;
  jql?: string;
};

export type OrchestratorResult = {
  jira_id: string;
  acao: string;
  status: string;
  mensagem: string;
};
