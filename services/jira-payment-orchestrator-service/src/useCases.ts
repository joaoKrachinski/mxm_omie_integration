import type { Config } from "./config";
import type {
  JiraIssueData,
  ReprocessJiraInput,
  OrchestratorResult,
} from "./types";

import {
  buscarIssueJira,
  atualizarCampoJira,
  atualizarStatusJira,
  alterarContaPagarOmie,
  enviarAlertaSlack,
  consultarPlanilha,
  buscarEmailUsuarioJira,
  buscarAccountIdPorEmail,
  enviarMensagemSlackParaUsuarioPorEmail,
  OmieAlteracaoInput,
} from "./adapters";
import {
  findDocument,
  findByJiraId,
  updateDocument,
  findPendingReprocess,
} from "@database";
import { normalizeCpfCnpj, toIsoDate } from "@shared/utils";
import { createLogger } from "@shared/logger";
import { Pagamento } from "@shared/types";

const logger = createLogger("jira-payment-orchestrator-service");

export async function approverJira(
  config: Config,
  input: JiraIssueData,
  correlationId: string
): Promise<OrchestratorResult> {
  logger.info("approverJira iniciado", { correlation_id: correlationId, jira_id: input.jira_id });
  
  // 1. Pegar a lista de aprovadores e regras de negócio
  let conjunto_de_aprovadores: Awaited<ReturnType<typeof consultarPlanilha>> = [];
  let regras_de_negocio: Awaited<ReturnType<typeof consultarPlanilha>> = [];

  try {
    [conjunto_de_aprovadores, regras_de_negocio] = await Promise.all([
      consultarPlanilha({ spreadsheetId: "1pcwoO-CXu5HPL-_19my3Vh2oy5BIOrZTr8yGTO_z6Zs", tabName: "aprovadores" }),
      consultarPlanilha({ spreadsheetId: "1pcwoO-CXu5HPL-_19my3Vh2oy5BIOrZTr8yGTO_z6Zs", tabName: "valoresAlcada" }),
    ]);
    logger.info("Planilhas carregadas", { aprovadores: conjunto_de_aprovadores.length, regras: regras_de_negocio.length });
    logger.info("Conjunto de aprovadores", { conjunto_de_aprovadores });
    logger.info("Regras de negócio", { regras_de_negocio });
  } catch (sheetErr) {
    logger.warn("Não foi possível carregar planilhas do Google Sheets — verifique as credenciais no .env", {
      correlation_id: correlationId,
      error: String(sheetErr),
    });
  }
  const squad_responsavel = input.squad;
  let aprovadores_atuais = {};
  for (const squad of conjunto_de_aprovadores) {
    if (squad.OptionValue === squad_responsavel) {
      aprovadores_atuais = squad;
      break;
    }
  }


  //Verifica se o squad foi encontrado
  if (Object.keys(aprovadores_atuais).length === 0) {
    logger.warn("Squad responsável não encontrado no conjunto de aprovadores", {
      squad_responsavel,
    });
    enviarAlertaSlack({
      type: "channel",
      id: process.env.SLACK_DEVELOPMENT_CHANNEL || "",
      message: `⚠️ Squad responsável "${squad_responsavel}" não encontrado para o jira "${input.jira_id}". Verifique a planilha de aprovadores.`,
    });
    return {
      jira_id: input.jira_id,
      acao: "approver_jira",
      status: "pendente",
      mensagem: `Squad responsável "${squad_responsavel}" não encontrado. Verifique a planilha de aprovadores.`,
    };
  }

  const reporter_id = input.criador;
  const reporter_email = (await buscarEmailUsuarioJira(reporter_id ?? "")) ?? "";
  logger.info("Email do criador da issue", { reporter_id, reporter_email });
 
  const alcada1 = regras_de_negocio[0]?.valor;
  const alcada2 = regras_de_negocio[1]?.valor;
  const dias = regras_de_negocio[2]?.valor;

  // ─── Lógica de aprovadores ────────────────────────────────────────────────

  // Converte string de alçada para número (aceita "50000", "50.000" ou "50,000")
  const parseAlcada = (val: string | undefined): number => {
    if (!val) return 0;
    return parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
  };

  // Converte campo de emails separados por vírgula em array limpo
  const parseEmails = (val: string | undefined): string[] =>
    (val || "").split(",").map(e => e.trim()).filter(Boolean);

  const row     = aprovadores_atuais as Record<string, string>;
  const valor   = input.valor ?? 0;
  const limite1 = parseAlcada(String(alcada1 ?? "0"));
  const limite2 = parseAlcada(String(alcada2 ?? "0"));

  let output_aprovadores: string[] = [];

  if (valor > limite2) {
    // ALÇADA 2 → 3 aprovadores, um deles pode ser o reporter
    // Começa pela lista base da alçada 2
    const base = parseEmails(row["aprovador_alcada2"]);

    if (base.includes(reporter_email)) {
      // Reporter está na base → sobe para _relator (que já exclui o reporter)
      const relator = parseEmails(row["aprovador_alcada2_relator"]);

      if (relator.includes(reporter_email)) {
        // Reporter ainda está no _relator → sobe para _relator1
        output_aprovadores = parseEmails(row["aprovador_alcada2_relator1"]);
      } else {
        output_aprovadores = relator;
      }
    } else {
      output_aprovadores = base;
    }

    logger.info("Alçada 2 ativada", { correlation_id: correlationId, valor, limite2, output_aprovadores });

  } else if (valor > limite1) {
    // ALÇADA 1 → 2 aprovadores, NENHUM pode ser o reporter
    // Começa pela lista base da alçada 1
    const base = parseEmails(row["aprovador_alcada1"]);

    if (base.includes(reporter_email)) {
      // Reporter está na base → sobe para _relator
      const relator = parseEmails(row["aprovador_alcada1_relator"]);

      if (relator.includes(reporter_email)) {
        // Reporter ainda está no _relator → sobe para _relator1
        output_aprovadores = parseEmails(row["aprovador_alcada1_relator1"]);
      } else {
        output_aprovadores = relator;
      }
    } else {
      output_aprovadores = base;
    }

    logger.info("Alçada 1 ativada", { correlation_id: correlationId, valor, limite1, output_aprovadores });

  } else {
    // GESTOR → 1 aprovador, reporter não pode ser o aprovador
    const gestor = row["aprovador_gestor"]?.trim() || "";

    if (gestor === reporter_email) {
      // Reporter é o gestor → usa gestor_relator (alçada imediatamente acima)
      output_aprovadores = parseEmails(row["aprovador_gestor_relator"]);
    } else {
      output_aprovadores = gestor ? [gestor] : [];
    }

    logger.info("Gestor ativado", { correlation_id: correlationId, valor, output_aprovadores });
  }

  logger.info("Aprovadores selecionados", { correlation_id: correlationId, jira_id: input.jira_id, output_aprovadores });

  // ─── Fim da lógica de aprovadores ─────────────────────────────────────────

  // Converte a lista de emails em accountIds do Jira em paralelo
  const accountIdResults = await Promise.all(
    output_aprovadores.map(email => buscarAccountIdPorEmail(email))
  );

  // Monta a lista final filtrando emails não encontrados no Jira (null)
  const lista_aprovadores_jira = accountIdResults
    .map((accountId, index) => {
      if (!accountId) {
        logger.warn("AccountId não encontrado para o email do aprovador", {
          correlation_id: correlationId,
          email: output_aprovadores[index],
        });
        return null;
      }
      return { accountId };
    })
    .filter((item): item is { accountId: string } => item !== null);

  logger.info("Lista de aprovadores Jira gerada", {
    correlation_id: correlationId,
    jira_id: input.jira_id,
    lista_aprovadores_jira,
  });

  if (valor <= limite1) {
    // Alçada Gestor
    atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_10191", valor: lista_aprovadores_jira });
  } else if (valor <= limite2 && valor > limite1) {
    // Alçada 1
    atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_10192", valor: lista_aprovadores_jira });
  } else if(valor > limite2) {
    // Alçada 2
    atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_10193", valor: lista_aprovadores_jira });
  }
  // alçada 1

  // 2. Validar regra de X dias antes do vencimento
  // 3. Enviar um Slack para os aprovadores sobre a aprovação pendente
  for (const aprovador of output_aprovadores) {
    enviarMensagemSlackParaUsuarioPorEmail({
      email: aprovador,
      message: [
        `Olá, você tem uma solicitação de pagamento em aberto aguardando sua aprovação!`,
        `Dados da Solicitação:`,
        `*Jira*: <https://insiderstore.atlassian.net/browse/${input.jira_id}|${input.jira_id}>`,
        `*Resumo*: ${input.summary ?? "não informado"}`,
        `*Valor*: R$ ${input.valor?.toFixed(2)}`,
        `*Vencimento*: ${input.vencimento ?? "não informado"}`,
      ].join('\n'),
    });
  }

  return {
    jira_id: input.jira_id,
    acao: "approver_jira",
    status: "pendente",
    mensagem: `Aprovadores: ${lista_aprovadores_jira.map(a => a.accountId).join(", ")}`,
  };
}

export async function verifyInvoiceJira(
  config: Config,
  input: JiraIssueData,
  correlationId: string
): Promise<OrchestratorResult> {
  logger.info("verifyInvoiceJira iniciado", { correlation_id: correlationId, jira_id: input.jira_id });

  const codigo_ntc = input.codigo_ntc;
  
  if (!codigo_ntc) {
    // Solicitação direta do SPAG, não produtivo
    const fornecedor = input.fornecedor ?? "desconecido";
    const cnpj = fornecedor.split("(")[1]?.split(")")[0]
    const cnpjAjustado = cnpj ? normalizeCpfCnpj(cnpj) : "desconecido";
    const valor = input.valor ?? 0;
    const valorCentavos = Math.round((valor || 0) * 100);
    const numero_documento = input.numero_documento ?? "desconecido";

    const existente = await findDocument(numero_documento, cnpjAjustado, valorCentavos);
    
    if (existente) {
      logger.info("Documento encontrado para verifyInvoiceJira", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        numero_documento,
        cnpj: cnpjAjustado,
        valor: valorCentavos,
      });

      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: "TRUE" });
      return {
        jira_id: input.jira_id,
        acao: "verify_invoice",
        status: "encontrada",
        mensagem: `Documento encontrado: numero_documento=${numero_documento}, cnpj_cpf=${cnpjAjustado}, valor=${valorCentavos}`,
      };
    } else {
      logger.info("Documento NÃO encontrado para verifyInvoiceJira", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        numero_documento,
        cnpj: cnpjAjustado,
        valor: valorCentavos,
      });

      enviarAlertaSlack({
        type: "channel",
        id: process.env.SLACK_ALERT_CHANNEL || "",
        message: [
          `⚠️ Documento NÃO encontrado para o Jira <https://insiderstore.atlassian.net/browse/${input.jira_id}|${input.jira_id}>`,
          `Dados do Documento:` ,
          `   Numero_documento: ${numero_documento}`,
          `   Cnpj_cpf: ${cnpjAjustado}`, 
          `   Valor: ${valorCentavos}`
        ].join("\n"),
      });

      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: "FALSE" });
      return {
        jira_id: input.jira_id,
        acao: "verify_invoice",
        status: "nao_encontrada",
        mensagem: `Documento NÃO encontrado: numero_documento=${numero_documento}, cnpj_cpf=${cnpjAjustado}, valor=${valorCentavos}`,
      };
    }
  } else {
    const cnpjCpf = input.cnpj_cpf ?? "desconecido";
    const cnpjAjustado = cnpjCpf ? normalizeCpfCnpj(cnpjCpf) : "desconecido";
    const valor = input.valor ?? 0;
    const valorCentavos = Math.round((valor || 0) * 100);
    const numero_documento = input.numero_documento_producao ?? "desconecido";
    const existente = await findDocument(numero_documento, cnpjAjustado, valorCentavos);
    
    if (existente) {
      logger.info("Documento encontrado para verifyInvoiceJira", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        numero_documento,
        cnpj: cnpjAjustado,
        valor: valorCentavos,
      });

      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: "TRUE" });
      return {
        jira_id: input.jira_id,
        acao: "verify_invoice",
        status: "encontrada",
        mensagem: `Documento encontrado: numero_documento=${numero_documento}, cnpj_cpf=${cnpjAjustado}, valor=${valorCentavos}`,
      };
    } else {
      logger.info("Documento NÃO encontrado para verifyInvoiceJira", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        numero_documento,
        cnpj: cnpjAjustado,
        valor: valorCentavos,
      });

      enviarAlertaSlack({
        type: "channel",
        id: process.env.SLACK_ALERT_CHANNEL || "",
        message: [
          `⚠️ Documento NÃO encontrado para o Jira <https://insiderstore.atlassian.net/browse/${input.jira_id}|${input.jira_id}>`,
          `Dados do Documento:` ,
          `   Numero_documento: ${numero_documento}`,
          `   Cnpj_cpf: ${cnpjAjustado}`, 
          `   Valor: ${valorCentavos}`
        ].join("\n"),
      });

      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: "FALSE" });
      return {
        jira_id: input.jira_id,
        acao: "verify_invoice",
        status: "nao_encontrada",
        mensagem: `Documento NÃO encontrado: numero_documento=${numero_documento}, cnpj_cpf=${cnpjAjustado}, valor=${valorCentavos}`,
      };
    }
  }
}

export async function updateOmieJira(
  config: Config,
  input: JiraIssueData,
  correlationId: string
): Promise<OrchestratorResult> {
  logger.info("updateOmieJira iniciado", { correlation_id: correlationId, jira_id: input.jira_id });

  // TODO: implementar atualização de dados operacionais no Omie (Aguardando Agendamento)
  const numero_documento = input.numero_documento ?? "desconecido";
  const cnpjCpf = normalizeCpfCnpj(input.cnpj_cpf ?? "desconecido");
  const valor = input.valor ?? 0;
  const valorCentavos = Math.round((valor || 0) * 100);
  const codigo_ntc = input.codigo_ntc ?? "desconecido";
  const tipo_nota = input.tipo_nota ?? "desconecido";
  const data_emissao = input.data_emissao ?? "desconecido";
  const data_vencimento = input.vencimento ?? "desconecido";
  const metodo_de_pagamento = input.metodo_de_pagamento ?? "desconecido";
  const linha_digitavel_boleto = input.linha_digitavel_boleto ?? "desconecido";
  const squad = input.squad ?? "desconecido";
  let observacao = "";
  let nome_fornecedor = input.nome_fornecedor ?? "desconecido";
  let conta_bancaria = input.conta ?? "desconecido";
  let agencia_bancaria = input.agencia ?? "desconecido";
  let banco = input.banco ?? "desconecido";
  const numero_documento_producao = input.numero_documento_producao ?? "desconecido";
  let tipo_de_pagamento = input.tipo_de_pagamento ?? "desconecido";
  const centro_de_custo = input.centro_de_custo ?? "desconecido";
  const fornecedor = input.fornecedor ?? "desconecido";
  const jira_key = input.jira_id;
  const alteracaoInput = {} as OmieAlteracaoInput;


  if (codigo_ntc === "desconecido") {
    alteracaoInput.numero_pedido = jira_key;
    
    alteracaoInput.valor = valor;

    const dados_bancarios_fornecedor = await consultarPlanilha({ 
      spreadsheetId: "174bEqbbMCE3TQVFT1C6zTt0acgRMyciUwEI5EQZWbEU", 
      tabName: "Cadastro de Fornecedor" 
    });
    
    let dados_bancarios_encontrados = {};
    nome_fornecedor = fornecedor.split("(")[0].trim() || nome_fornecedor;
    const cnpjAjustado = normalizeCpfCnpj(fornecedor.split("(")[1]?.split(")")[0] ?? "desconecido");
    for (const row of dados_bancarios_fornecedor) {    
      if(normalizeCpfCnpj(row['[SPAG] CNPJ do fornecedor'] ?? "") === cnpjAjustado) {
        dados_bancarios_encontrados = row;
        break;
      }
    }

    if(Object.keys(dados_bancarios_encontrados).length === 0) {
      logger.warn("Dados bancários do fornecedor não encontrados na planilha de Cadastro de Fornecedor", {
        correlation_id: correlationId,
        cnpj: cnpjAjustado,
        fornecedor: nome_fornecedor,
      });
      enviarAlertaSlack({
        type: "channel",
        id: process.env.SLACK_DEVELOPMENT_CHANNEL || "",
        message: `Dados bancários do fornecedor não encontrados para CNPJ ${cnpjAjustado}. Verifique a planilha de Cadastro de Fornecedor. Jira: <https://insiderstore.atlassian.net/browse/${input.jira_id}|${input.jira_id}>`,
      });
      return {
        jira_id: input.jira_id,
        acao: "update_omie",
        status: "falha",
        mensagem: `Dados bancários do fornecedor não encontrados para CNPJ ${cnpjAjustado}. Verifique a planilha de Cadastro de Fornecedor.`,
      };
    }
    
    alteracaoInput.cnpj_cpf = cnpjAjustado;
    conta_bancaria = dados_bancarios_encontrados['[SPAG] N° da Conta bancária'] ?? conta_bancaria;
    agencia_bancaria = dados_bancarios_encontrados['[SPAG] NovoAgenciaBancária'] ?? agencia_bancaria;
    banco = dados_bancarios_encontrados['[SPAG] Novo Banco'] ?? banco;
    const numero_banco = banco.split("(")[1]?.split(")")[0] ?? banco;
    const chave_pix = cnpjAjustado;
    const codigo_integracao = `${numero_documento}_${cnpjAjustado}_${valorCentavos}`;
    alteracaoInput.codigo_integracao = codigo_integracao;

    let cnab_integracao = {};
    if (metodo_de_pagamento === "Boleto") {
      cnab_integracao = {
        codigo_forma_de_pagamento: "BOL",
        codigo_barras_boleto: linha_digitavel_boleto,
      }
      observacao = [
        `Redator: "Automação Jira"`,
        `Area/Centro de custo: ${input.squad ?? ""}`,
        `Request: ${input.tipo_nota ?? ""}`,
        `Formulário: ${input.fornecedor ?? ""}`,
        `Resumo: ${input.summary ?? ""}`,
        `Detalhes: "None"`,
        `Tipo de requisição: ${input.tipo_de_pagamento ?? ""}`,
        `Codigo Forma de Pagamento: BOL`,
        `Finalidade: ${input.codigo_ntc ?? ""}`,
        `linhas_boleto: ${input.linha_digitavel_boleto ?? ""}`,
      ].join("\n");
    } else if (metodo_de_pagamento === "Pix") {
      cnab_integracao = {
        codigo_forma_de_pagamento: "TRA",
        finalidade_transferencia: "01.03",
        banco_transferencia: '341',
        agencia_transferencia: '0845',
        conta_corrente_transferencia: '22961-6',
        pix_qrcode: cnpjAjustado,
      }
      observacao = [
        `Redator: "Automação Jira"`,
        `Area/Centro de custo: ${input.squad ?? ""}`,
        `Request: ${input.tipo_nota ?? ""}`,
        `Formulário: ${input.fornecedor ?? ""}`,
        `Resumo: ${input.summary ?? ""}`,
        `Detalhes: "None"`,
        `Tipo de requisição: ${input.tipo_de_pagamento ?? ""}`,
        `Codigo Forma de Pagamento: TRA - PIX`,
        `Finalidade: ${input.codigo_ntc ?? ""}`,
      ].join("\n");
    } else if (metodo_de_pagamento === "Transferência Bancária") {
      cnab_integracao = {
        codigo_forma_de_pagamento: "TRA",
        finalidade_transferencia: "01.04",
        banco_transferencia: numero_banco,
        agencia_transferencia: agencia_bancaria,
        conta_corrente_transferencia: conta_bancaria,
        cpf_cnpj_transferencia: cnpjAjustado,
        nome_transferencia: nome_fornecedor,
      }
      observacao = [
        `Redator: "Automação Jira"`,
        `Area/Centro de custo: ${input.squad ?? ""}`,
        `Request: ${input.tipo_nota ?? ""}`,
        `Formulário: ${input.fornecedor ?? ""}`,
        `Resumo: ${input.summary ?? ""}`,
        `Detalhes: "None"`,
        `Tipo de requisição: ${input.tipo_de_pagamento ?? ""}`,
        `Codigo Forma de Pagamento: TRA - Transferência Bancária`,
        `Banco: ${banco ?? ""}`,
        `Agência: ${agencia_bancaria ?? ""}`,
        `Conta Corrente: ${conta_bancaria ?? ""}`,
        `CPF/CNPJ: ${cnpjAjustado ?? ""}`,
        `Nome: ${nome_fornecedor ?? ""}`,
        `Finalidade: ${input.codigo_ntc ?? ""}`,
      ].join("\n");
    }
    alteracaoInput.observacao = observacao;
    alteracaoInput.data_emissao = data_emissao;
    alteracaoInput.data_vencimento = data_vencimento;
    alteracaoInput.forma_de_pagamento = cnab_integracao;

    tipo_de_pagamento = fornecedor.split("-")[1]?.trim() || tipo_de_pagamento;
    const tipos_de_pagamento_omie = await consultarPlanilha({
      spreadsheetId: "1pcwoO-CXu5HPL-_19my3Vh2oy5BIOrZTr8yGTO_z6Zs", 
      tabName: "relacaoOmieTipoDePagamento" 
    });
    let codigo_omie = "";
    for (const row of tipos_de_pagamento_omie) {
      if (row["Tipo (Jira)"]?.trim() === tipo_de_pagamento.trim()) {
        codigo_omie = row["Código (Omie)"] ?? "";
        break;
      }
    }

    alteracaoInput.codigo_categoria = codigo_omie;

    const departamentos_omie = await consultarPlanilha({
      spreadsheetId: "1pcwoO-CXu5HPL-_19my3Vh2oy5BIOrZTr8yGTO_z6Zs", 
      tabName: "departamentos_omie" 
    });
    let codigo_centro_custo_omie = "";
    for (const row of departamentos_omie) {
      if (row["Area Insider"]?.trim() === squad.trim()) {
        codigo_centro_custo_omie = row["Código Omie"] ?? "";
        break;
      }
    }

    if (!codigo_centro_custo_omie) {
      codigo_centro_custo_omie = "6917705255"; // Centro de custo default para casos não mapeados
      await enviarAlertaSlack({
        type: "channel",
        id: process.env.SLACK_DEVELOPMENT_CHANNEL || "",
        message: `⚠️ Centro de custo Omie não encontrado para a área/squad "${squad}". Usando centro de custo default. Jira: <https://insiderstore.atlassian.net/browse/${input.jira_id}|${input.jira_id}>`,
      });
    }

    alteracaoInput.codigo_centro_custo = codigo_centro_custo_omie;

    await updateDocument(numero_documento, cnpjAjustado, valorCentavos,
      {
      jira_id: input.jira_id,
      data_emissao,
      vencimento: data_vencimento,
      pagamento: ((): Pagamento => {
        if (metodo_de_pagamento === "Pix")
          return { forma_pagamento: "Pix", chave: cnpjAjustado ?? "" };
        if (metodo_de_pagamento === "Boleto")
          return { forma_pagamento: "Boleto", codigo: linha_digitavel_boleto ?? "" };
        return { forma_pagamento: "Transferência Bancária", agencia: agencia_bancaria ?? "", conta: conta_bancaria ?? "", banco: banco ?? "" };
      })()
    });

  } else {
    alteracaoInput.numero_pedido = jira_key;
    alteracaoInput.numero_documento = codigo_ntc;
    
    alteracaoInput.valor = valor;
    
    alteracaoInput.cnpj_cpf = cnpjCpf;
    const numero_banco = banco.split("(")[1]?.split(")")[0] ?? banco;
    const chave_pix = cnpjCpf;
    const codigo_integracao = `${numero_documento_producao}_${cnpjCpf}_${valorCentavos}`;
    alteracaoInput.codigo_integracao = codigo_integracao;

    let cnab_integracao = {};
    if (metodo_de_pagamento === "Boleto") {
      cnab_integracao = {
        codigo_forma_de_pagamento: "BOL",
        codigo_barras_boleto: linha_digitavel_boleto,
      }
      observacao = [
        `Redator: "Automação Jira"`,
        `Area/Centro de custo: ${input.squad ?? ""}`,
        `Request: ${input.tipo_nota ?? ""}`,
        `Formulário: ${input.fornecedor ?? ""}`,
        `Resumo: ${input.summary ?? ""}`,
        `Detalhes: "None"`,
        `Tipo de requisição: ${input.tipo_de_pagamento ?? ""}`,
        `Codigo Forma de Pagamento: BOL`,
        `Finalidade: ${input.codigo_ntc ?? ""}`,
        `linhas_boleto: ${input.linha_digitavel_boleto ?? ""}`,
      ].join("\n");
    } else if (metodo_de_pagamento === "Pix") {
      cnab_integracao = {
        codigo_forma_de_pagamento: "TRA",
        finalidade_transferencia: "01.03",
        banco_transferencia: '341',
        agencia_transferencia: '0845',
        conta_corrente_transferencia: '22961-6',
        pix_qrcode: cnpjCpf,
      }
      observacao = [
        `Redator: "Automação Jira"`,
        `Area/Centro de custo: ${input.squad ?? ""}`,
        `Request: ${input.tipo_nota ?? ""}`,
        `Formulário: ${input.fornecedor ?? ""}`,
        `Resumo: ${input.summary ?? ""}`,
        `Detalhes: "None"`,
        `Tipo de requisição: ${input.tipo_de_pagamento ?? ""}`,
        `Codigo Forma de Pagamento: TRA - PIX`,
        `Finalidade: ${input.codigo_ntc ?? ""}`,
      ].join("\n");
    } else if (metodo_de_pagamento === "Transferência Bancária") {
      cnab_integracao = {
        codigo_forma_de_pagamento: "TRA",
        finalidade_transferencia: "01.04",
        banco_transferencia: numero_banco,
        agencia_transferencia: agencia_bancaria,
        conta_corrente_transferencia: conta_bancaria,
        cpf_cnpj_transferencia: cnpjCpf,
        nome_transferencia: nome_fornecedor,
      }
      observacao = [
        `Redator: "Automação Jira"`,
        `Area/Centro de custo: ${input.squad ?? ""}`,
        `Request: ${input.tipo_nota ?? ""}`,
        `Formulário: ${input.fornecedor ?? ""}`,
        `Resumo: ${input.summary ?? ""}`,
        `Detalhes: "None"`,
        `Tipo de requisição: ${input.tipo_de_pagamento ?? ""}`,
        `Codigo Forma de Pagamento: TRA - Transferência Bancária`,
        `Banco: ${banco ?? ""}`,
        `Agência: ${agencia_bancaria ?? ""}`,
        `Conta Corrente: ${conta_bancaria ?? ""}`,
        `CPF/CNPJ: ${cnpjCpf ?? ""}`,
        `Nome: ${nome_fornecedor ?? ""}`,
        `Finalidade: ${input.codigo_ntc ?? ""}`,
      ].join("\n");
    }
    alteracaoInput.observacao = observacao;
    alteracaoInput.data_emissao = data_emissao;
    alteracaoInput.data_vencimento = data_vencimento;
    alteracaoInput.forma_de_pagamento = cnab_integracao;

    let codigo_grupo_pagamento = "";
    if (tipo_de_pagamento == "Confecção") {
      codigo_grupo_pagamento = "100001"
    } else if (tipo_de_pagamento == "Matéria - Prima Principal") {
      codigo_grupo_pagamento = "100001"

    } else if (tipo_de_pagamento == "Fretes e Carretos (envio para clientes)") {
      codigo_grupo_pagamento = "100069"

    } else if (tipo_de_pagamento == "Fretes Internos de Produção") {
      codigo_grupo_pagamento = "100069"

    } else if (tipo_de_pagamento == "Outros CMV") {
      codigo_grupo_pagamento = "100125"

    } else if (tipo_de_pagamento == "Insumos") {
      codigo_grupo_pagamento = "100072"

    } else {
      codigo_grupo_pagamento = "100076"
    }
    
    
    

    alteracaoInput.codigo_categoria = codigo_grupo_pagamento;


    let codigo_centro_custo_omie = "";
    if (centro_de_custo === "Produção") {
      codigo_centro_custo_omie = "1205001";
    } else if (centro_de_custo === "Logística") {
      codigo_centro_custo_omie = "1203001";
    } else {
      codigo_centro_custo_omie = "1102001"; //influs
    }
  

    alteracaoInput.codigo_centro_custo = codigo_centro_custo_omie;

  }





  return {
    jira_id: input.jira_id,
    acao: "update_omie",
    status: "pendente",
    mensagem: "Atualização implementada",
  };
}

export async function reprocessJira(
  config: Config,
  input: ReprocessJiraInput,
  correlationId: string
): Promise<{ processados: number; erros: number }> {
  const status = input.status ?? "nota_nao_encontrada";
  const registros = await findPendingReprocess(status, input.desde, input.limite);

  let processados = 0;
  let erros = 0;

  for (const registro of registros) {
    try {
      // TODO: implementar reprocessamento real (verificar novamente se título existe no Omie)
      logger.info("Reprocessando registro Jira", {
        correlation_id: correlationId,
        jira_id: registro.jira_id,
        mxm_id: registro.mxm_id,
      });
      processados++;
    } catch (err) {
      erros++;
      logger.error("Erro no reprocessamento Jira", {
        correlation_id: correlationId,
        jira_id: registro.jira_id,
        error: String(err),
      });
    }
  }

  return { processados, erros };
}
