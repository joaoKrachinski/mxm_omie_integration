export type MxmTituloPagar = {
  numero_documento: string;
  cnpj_cpf: string;
  valor: number;
  data_emissao: string;
  vencimento: string;
  mxm_id: string;
};

export type MxmBaixaInput = {
  mxm_id: string;
  numero_documento: string;
  valor: number;
  data_pagamento: string;
};

export type MxmConsultaInput = {
  numero_documento: string;
  cnpj_cpf: string;
};

export async function listarTituloPagar(
  windowHours: number
): Promise<MxmTituloPagar[]> {
  // TODO: implementar chamada real ao MXM
  // POST {MXM_BASE_URL}/webmanager/api/InterfacedoContasPagarReceber/ConsultarAlteracaoTituloPagar
  // Autenticação via MXM_AUTH_TOKEN
  // Filtrar títulos alterados nas últimas {windowHours} horas
  throw new Error("TODO: listarTituloPagar não implementado");
}

export async function consultarTituloMxm(
  input: MxmConsultaInput
): Promise<MxmTituloPagar | null> {
  // TODO: implementar consulta de título específico no MXM
  throw new Error("TODO: consultarTituloMxm não implementado");
}

export async function baixarTituloMxm(input: MxmBaixaInput): Promise<void> {
  // TODO: implementar chamada real de baixa no MXM
  // POST {MXM_BASE_URL}/webmanager/api/InterfacedoContasPagarReceber/Gravar
  // Autenticação via MXM_AUTH_TOKEN
  throw new Error("TODO: baixarTituloMxm não implementado");
}
