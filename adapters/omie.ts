export type OmieContaPagarInput = {
  numero_documento: string;
  cnpj_cpf: string;
  valor: number;
  data_vencimento: string;
};

export type OmieContaPagarResponse = {
  omie_id: string;
  codigo_lancamento_omie: number;
  status: string;
};

export type OmieConsultaInput = {
  numero_documento: string;
  cnpj_cpf: string;
  valor: number;
};

export type OmieAlteracaoInput = {
  codigo_integracao: string;
  data_emissao?: string;
  data_vencimento?: string;
  codigo_categoria?: string;
  codigo_centro_custo?: string;
  numero_documento?: string;
  numero_pedido?: string;
  forma_de_pagamento?: Record<string, unknown>;
  valor?: number;
  cnpj_cpf?: string;
  observacao?: string;
};

async function formatarCPFCNPJ(cnpjCpf: string): Promise<string> {
  return cnpjCpf.replace(/\D/g, "");
}

export async function criarContaPagarOmie(
  input: OmieContaPagarInput
): Promise<OmieContaPagarResponse> {
  // TODO: implementar chamada real ao Omie
  // POST {OMIE_BASE_URL}/api/v1/financas/contapagar/#IncluirContaPagar
  // Autenticação via OMIE_APP_KEY e OMIE_APP_SECRET

  // Regra de negócio -> codigo_lancamento_integracao = numero_documento + cnpj_cpf + valor
  const numero_documento = input.numero_documento;
  const cnpj_cpf = await formatarCPFCNPJ(input.cnpj_cpf);
  const valor = input.valor;
  const data_vencimento = input.data_vencimento;
  
  const urlBase = process.env.OMIE_BASE_URL;
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;


  const url = `${urlBase}/api/v1/financas/contapagar/`;
  const body = {
    call: "IncluirContaPagar",
    app_key: appKey,
    app_secret: appSecret,
    param: [
      {
        numero_documento: numero_documento,
        cnpj_cpf: cnpj_cpf,
        valor: valor,
        data_vencimento: data_vencimento,
        data_previsao: data_vencimento,
        codigo_lancamento_integracao: `${numero_documento}_${cnpj_cpf}_${valor}`,
      },
    ],
  };
  const headers = {
    "Content-Type": "application/json",
  };

  throw new Error("TODO: criarContaPagarOmie não implementado");
}

export async function consultarContaPagarOmie(
  input: OmieConsultaInput
): Promise<OmieContaPagarResponse | null> {
  // TODO: implementar consulta ao Omie
  // POST {OMIE_BASE_URL}/api/v1/financas/contapagar/#ConsultarContaPagar
  // Autenticação via OMIE_APP_KEY e OMIE_APP_SECRET
  throw new Error("TODO: consultarContaPagarOmie não implementado");
}

export async function alterarContaPagarOmie(
  input: OmieAlteracaoInput
): Promise<unknown> {
  const urlBase = process.env.OMIE_BASE_URL;
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  const url = `${urlBase}/api/v1/financas/contapagar/`;
  const body = {
    call: "AlterarContaPagar",
    app_key: appKey,
    app_secret: appSecret,
    param: [
      {
        codigo_lancamento_integracao: input.codigo_integracao,
        data_vencimento: input.data_vencimento,
        data_previsao: input.data_vencimento,
        numero_pedido: input.numero_pedido,
        numero_documento: input.numero_documento ?? undefined,
        cnab_integracao_bancaria: input.forma_de_pagamento,
        data_emissao: input.data_emissao,
        codigo_categoria: input.codigo_categoria,
        distribuicao: [
          {
            cCodDep: input.codigo_centro_custo ?? "desconhecido",
            nPerDep: 100,
          },
        ],
        observacao: input.observacao,
      },
    ],
  };
  const headers = {
    "Content-Type": "application/json",
  };

  const request = fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  //Faça as métricas de sucessido/falha e latência aqui

  const response = await request;

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro ao alterar conta a pagar no Omie. Status: ${response.status}. Body: ${errorBody}`);
  }
  return "Título alterado com sucesso no Omie";
}

export async function listarContasPagarOmie(filtros?: Record<string, unknown>): Promise<OmieContaPagarResponse[]> {
  // TODO: implementar listagem no Omie para reconciliação
  throw new Error("TODO: listarContasPagarOmie não implementado");
}
