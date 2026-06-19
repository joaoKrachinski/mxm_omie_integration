export type OmieContaPagarInput = {
  numero_documento: string;
  cnpj_cpf: string;
  valor: number;
  data_vencimento: string;
  razao_social?: string;
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

import { consultarFornecedorMxm } from "./mxm";
import { findFornecedor, upsertFornecedor } from "@database";
import { createLogger } from "@shared/logger";

const logger = createLogger("omie-adapter");

async function formatarCPFCNPJ(cnpjCpf: string): Promise<string> {
  return cnpjCpf.replace(/\D/g, "");
}

export async function criarContaPagarOmie(
  input: OmieContaPagarInput
): Promise<OmieContaPagarResponse> {
  const numero_documento = input.numero_documento;
  const cnpj_cpf = await formatarCPFCNPJ(input.cnpj_cpf);
  const valor = input.valor;
  const data_vencimento = input.data_vencimento;

  logger.info("Iniciando criação de conta a pagar no Omie", {
    numero_documento,
    cnpj_cpf,
    valor,
    data_vencimento,
  });

  const urlBase = process.env.OMIE_BASE_URL;
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  // ── Resolver codigo_cliente_omie ─────────────────────────────────────────

  let codigo_cliente_omie: string | null = null;

  // [1] Verificar cache no MongoDB
  const fornecedorCached = await findFornecedor(cnpj_cpf);

  if (fornecedorCached) {
    logger.info("[1/3] Fornecedor encontrado no cache", { cnpj_cpf, codigo_cliente_omie: fornecedorCached.codigo_cliente_omie });
    codigo_cliente_omie = fornecedorCached.codigo_cliente_omie;
  } else {
    // [2] Consultar no Omie
    logger.info("[2/3] Fornecedor não está no cache — consultando Omie", { cnpj_cpf });
    try {
      const omieResult = await codigoCLienteFornecedorOmie(cnpj_cpf);
      if (omieResult.codigo_fornecedor_omie) {
        codigo_cliente_omie = omieResult.codigo_fornecedor_omie;
        logger.info("[2/3] Fornecedor encontrado no Omie", { cnpj_cpf, codigo_cliente_omie });
        await upsertFornecedor(cnpj_cpf, codigo_cliente_omie);
      } else {
        throw new Error("codigo_fornecedor_omie vazio");
      }
    } catch (omieErr) {
      // [3] Não encontrado no Omie → criar
      logger.warn("[3/3] Fornecedor não encontrado no Omie — criando", { cnpj_cpf, erro: String(omieErr) });

      // Buscar nome no MXM (ou usar razao_social passada no input)
      let nomeFornecedor = input.razao_social ?? "";
      if (!nomeFornecedor) {
        const mxmFornecedor = await consultarFornecedorMxm(cnpj_cpf);
        nomeFornecedor = mxmFornecedor?.nome ?? cnpj_cpf;
        logger.info("[3/3] Nome do fornecedor obtido do MXM", { cnpj_cpf, nome: nomeFornecedor });
      }

      const criado = await criarClienteFornecedorOmie(cnpj_cpf, nomeFornecedor);
      codigo_cliente_omie = criado.codigo_fornecedor_omie;
      logger.info("[3/3] Fornecedor criado no Omie", { cnpj_cpf, codigo_cliente_omie });
      await upsertFornecedor(cnpj_cpf, codigo_cliente_omie);
    }
  }

  if (!codigo_cliente_omie) {
    throw new Error(`Não foi possível resolver codigo_cliente_omie para CNPJ ${cnpj_cpf}`);
  }

  // ── Criar conta a pagar ──────────────────────────────────────────────────

  logger.info("Criando conta a pagar no Omie", { numero_documento, cnpj_cpf, valor, codigo_cliente_omie });

  const url = `${urlBase}/api/v1/financas/contapagar/`;
  const body = {
    call: "IncluirContaPagar",
    app_key: appKey,
    app_secret: appSecret,
    param: [
      {
        numero_documento_fiscal: numero_documento,
        codigo_cliente_fornecedor: Number(codigo_cliente_omie),
        valor_documento: valor,
        data_vencimento: data_vencimento,
        data_previsao: data_vencimento,
        codigo_lancamento_integracao: `${numero_documento}_${cnpj_cpf}_${valor}`,
        id_conta_corrente: 6917718230,
        observacao: "Criação automática via integração MXM-OMIE, a ser atualizado pelo Jira posteriormente.",
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Erro ao criar conta a pagar no Omie. Status: ${response.status}. Body: ${errorBody}`);
    }

    const responseData = await response.json();
    logger.info("Conta a pagar criada no Omie", { data: responseData });

    return {
      omie_id: responseData?.[0]?.codigo_lancamento_omie?.toString() ?? "",
      codigo_lancamento_omie: responseData?.[0]?.codigo_lancamento_omie ?? 0,
      status: responseData?.[0]?.descricao_status ?? "desconhecido",
    };
  } catch (error) {
    logger.error("Erro ao criar conta a pagar no Omie", { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Erro ao criar conta a pagar no Omie: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function codigoCLienteFornecedorOmie(cnpjCpf: string): Promise<{codigo_fornecedor_omie: string}> {
  const urlBase = process.env.OMIE_BASE_URL;
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;


  const url = `${urlBase}/api/v1/geral/clientes/#ListarClientes`;
  const body = {
    call: "ListarClientes",
    app_key: appKey,
    app_secret: appSecret,
    param: [
      {
        "pagina": 1,
          "registros_por_pagina": 1,
          "clientesFiltro": {
                "cnpj_cpf": cnpjCpf
            }
      },
    ],
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
      const errorBody = await response.text();
      throw new Error(`Erro ao listar clientes no Omie. Status: ${response.status}. Body: ${errorBody}`);
    }

    const responseData = await response.json();
    logger.info("Resposta recebida do Omie", { data: responseData });
    
    return {
      codigo_fornecedor_omie: responseData?.clientes_cadastro[0]?.codigo_cliente_omie ?? "",
    };
    
  } catch (error) {
    logger.error("Erro ao conectar com Omie", { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Erro ao conectar com Omie: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function criarClienteFornecedorOmie(cnpjCpf: string, nomeFornecedor: string): Promise<{codigo_fornecedor_omie: string}> {
  const urlBase = process.env.OMIE_BASE_URL;
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  logger.info("Criando fornecedor no Omie", { cnpj_cpf: cnpjCpf, nome: nomeFornecedor });

  const url = `${urlBase}/api/v1/geral/clientes/`;
  const body = {
    call: "IncluirCliente",
    app_key: appKey,
    app_secret: appSecret,
    param: [
      {
        razao_social: String(nomeFornecedor).substring(0, 50),
        nome_fantasia: String(nomeFornecedor).substring(0, 50),
        cnpj_cpf: cnpjCpf,
        codigo_cliente_integracao: cnpjCpf,
        email: "",
        cep: "01310-300",
        endereco_numero: "2644",
        pesquisar_cep: "S",
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Erro ao criar fornecedor no Omie. Status: ${response.status}. Body: ${errorBody}`);
    }

    const responseData = await response.json();
    logger.info("Fornecedor criado no Omie", { cnpj_cpf: cnpjCpf, data: responseData });

    return {
      codigo_fornecedor_omie: responseData?.codigo_cliente_omie?.toString() ?? "",
    };
  } catch (error) {
    logger.error("Erro ao criar fornecedor no Omie", { cnpj_cpf: cnpjCpf, error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Erro ao criar fornecedor no Omie: ${error instanceof Error ? error.message : String(error)}`);
  }
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
