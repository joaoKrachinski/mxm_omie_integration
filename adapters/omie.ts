export type OmieContaPagarInput = {
  numero_documento: string;
  cnpj_cpf: string;
  valor: number;
  data_emissao: string;
  vencimento: string;
  codigo_lancamento_integracao?: string;
};

export type OmieContaPagarResponse = {
  omie_id: string;
  codigo_lancamento_omie: number;
};

export type OmieConsultaInput = {
  numero_documento: string;
  cnpj_cpf: string;
};

export type OmieAlteracaoInput = {
  omie_id: string;
  campos: Record<string, unknown>;
};

export async function criarContaPagarOmie(
  input: OmieContaPagarInput
): Promise<OmieContaPagarResponse> {
  // TODO: implementar chamada real ao Omie
  // POST {OMIE_BASE_URL}/api/v1/financas/contapagar/#IncluirContaPagar
  // Autenticação via OMIE_APP_KEY e OMIE_APP_SECRET
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
): Promise<void> {
  // TODO: implementar atualização no Omie
  // POST {OMIE_BASE_URL}/api/v1/financas/contapagar/#AlterarContaPagar
  throw new Error("TODO: alterarContaPagarOmie não implementado");
}

export async function listarContasPagarOmie(filtros?: Record<string, unknown>): Promise<OmieContaPagarResponse[]> {
  // TODO: implementar listagem no Omie para reconciliação
  throw new Error("TODO: listarContasPagarOmie não implementado");
}
