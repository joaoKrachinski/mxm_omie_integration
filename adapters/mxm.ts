import { createLogger } from "@shared/logger";

const logger = createLogger("mxm-adapter");

export type MxmTituloPagar = {
  Fornecedor: string;
  NumeroTitulo: string;
  EmpresaOrigem: string;
  ValorDoTitulo: string;
  DataVencimento: string;
  Status: string;
  DescStatus: string;
  UsuarioAlteracao: string;
  DataMovimentacao: string;
  DataDigitacaoBaixa: string;
  Filial: string;
  ContaPagamento: string;
  DocumentoPagamento: string;
  Bordero: string;
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

function getMxmConfig() {
  const baseUrl     = process.env.MXM_BASE_URL;
  const username    = process.env.MXM_USERNAME;
  const password    = process.env.MXM_PASSWORD;
  const environment = process.env.MXM_ENVIRONMENT;

  if (!baseUrl || !username || !password || !environment) {
    throw new Error(
      "Variáveis MXM_BASE_URL, MXM_USERNAME, MXM_PASSWORD e MXM_ENVIRONMENT são obrigatórias",
    );
  }

  return { baseUrl, username, password, environment };
}

export async function listarTituloPagar(): Promise<MxmTituloPagar[]> {
  const windowHours = Number(process.env.SYNC_WINDOW_HOURS || 24);
  logger.info(`Consultando títulos em aberto no MXM das últimas ${windowHours} horas`);

  const { baseUrl, username, password, environment } = getMxmConfig();

  const startDate = new Date();
  startDate.setHours(startDate.getHours() - windowHours);
  const dataHoraAlteracaoInicial = startDate.toISOString();
  const dataHoraAlteracaoFinal = new Date().toISOString();

  const url = `${baseUrl}/webmanager/api/InterfacedoContasPagarReceber/ConsultarAlteracaoTituloPagar`;
  const body = {
    "AutheticationToken": {
      "Username": username,
      "Password": password,
      "EnvironmentName": environment
    },
    "Data": {
      "DataeHoradeAlteracaoInicial": dataHoraAlteracaoInicial,
      "DataeHoradeAlteracaoFinal": dataHoraAlteracaoFinal,
      "SomenteTitulosAberto": ""
    }
  };
  const headers = {
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Erro ao consultar títulos no MXM", { status: response.status, statusText: response.statusText, errorText });
      throw new Error(`Erro ao consultar títulos no MXM: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    logger.info("Resposta recebida do MXM", { data: responseData }); 

    return responseData?.Data
  } catch (error) {
    logger.error("Erro ao conectar com MXM", { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Erro ao conectar com MXM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function consultarTituloMxm(
  input: MxmConsultaInput
): Promise<MxmTituloPagar | null> {
  const { baseUrl, username, password, environment } = getMxmConfig();

  // TODO: implementar consulta de título específico no MXM
  throw new Error("TODO: consultarTituloMxm não implementado");
}

export async function baixarTituloMxm(input: MxmBaixaInput): Promise<void> {
  const { baseUrl, username, password, environment } = getMxmConfig();

  // TODO: implementar chamada real de baixa no MXM
  // POST {baseUrl}/webmanager/api/InterfacedoContasPagarReceber/Gravar
  // Autenticação: { username, password, environment }
  throw new Error("TODO: baixarTituloMxm não implementado");
}
