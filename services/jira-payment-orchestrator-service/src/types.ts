// ─── Payload raw enviado pela automação do Jira ──────────────────────────────

export type JiraWebhookPayload = {
  issue: {
    self?: string;
    id?: number;
    key: string;
    fields: {
      // Campos conhecidos (mapeados)
      customfield_12568?: string;   // tipo_do_titulo
      customfield_12112?: string;   // numero_do_titulo
      customfield_10184?: string;   // data_emissao (ISODate)
      customfield_10181?: string | number; // valor
      customfield_10183?: string;   // vencimento (ISODate)
      customfield_10182?: string;   // metodo_de_pagamento
      customfield_10186?: string;   // linha_digitavel_boleto
      customfield_10180?: string;   // cnpj_do_fornecedor
      customfield_10179?: string;   // nome_do_fornecedor
      customfield_10178?: string;   // numero_do_titulo_producao
      customfield_10214?: string;   // codigo_ntc
      customfield_10195?: string;   // centro_de_custo
      customfield_10196?: string;   // tipo_de_pagamento
      customfield_10189?: string;   // agencia_bancaria
      customfield_10190?: string;   // conta_bancaria
      customfield_12243?: string;   // banco
      summary?: string;              // título da issue
      customfield_11645?: string;   // squad_foundation
      customfield_12563?: string;   // fornecedores_finance
      customfield_12562?: string;   // fornecedores_growth
      customfield_12416?: string;   // fornecedores_influ
      customfield_12425?: string;   // fornecedores_legal
      customfield_12564?: string;   // fornecedores_operations
      customfield_12566?: string;   // fornecedores_people
      customfield_12565?: string;   // fornecedores_technology
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
  numero_documento?: string;
  data_emissao?: string;
  valor?: number;
  vencimento?: string;
  metodo_de_pagamento?: string;
  linha_digitavel_boleto?: string;
  cnpj_cpf?: string;
  nome_fornecedor?: string;
  numero_documento_producao?: string;
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

  // Campos extras não mapeados ficam aqui
  campos_extras: Record<string, unknown>;
};

// ─── Função de mapeamento: raw Jira → interno ────────────────────────────────

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
    jira_id:                  key,
    summary:                  fields.summary ?? undefined,
    tipo_nota:                fields.customfield_12568 ?? undefined,
    numero_documento:         fields.customfield_12112 ?? undefined,
    data_emissao:             fields.customfield_10184 ?? undefined,
    valor:                    Number.isFinite(valor) ? valor : undefined,
    vencimento:               fields.customfield_10183 ?? undefined,
    metodo_de_pagamento:      fields.customfield_10182 ?? undefined,
    linha_digitavel_boleto:   fields.customfield_10186 ?? undefined,
    cnpj_cpf:                 fields.customfield_10180 ?? undefined,
    nome_fornecedor:          fields.customfield_10179 ?? undefined,
    numero_documento_producao: fields.customfield_10178 ?? undefined,
    codigo_ntc:               fields.customfield_10214 ?? undefined,
    centro_de_custo:          fields.customfield_10195 ?? undefined,
    tipo_de_pagamento:        fields.customfield_10196 ?? undefined,
    agencia:                  fields.customfield_10189 ?? undefined,
    conta:                    fields.customfield_10190 ?? undefined,
    banco:                    fields.customfield_12243 ?? undefined,
    status_jira:              fields.status?.name ?? undefined,
    criador:                  fields.creator?.accountId ?? undefined,
    squad:      fields.customfield_11645 ?? undefined,
    fornecedor: fields.customfield_12563
           ?? fields.customfield_12562
           ?? fields.customfield_12416
           ?? fields.customfield_12425
           ?? fields.customfield_12564
           ?? fields.customfield_12566
           ?? fields.customfield_12565
           ?? undefined,
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
};

export type OrchestratorResult = {
  jira_id: string;
  acao: string;
  status: string;
  mensagem: string;
};
