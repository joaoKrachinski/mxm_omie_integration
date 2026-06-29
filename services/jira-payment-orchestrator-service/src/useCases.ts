import type { Config } from "./config";
import type {
  JiraIssueData,
  ReprocessJiraInput,
  OrchestratorResult,
} from "./types";
import { mapJiraPayload } from "./types";

import {
  buscarIssueJira,
  buscarIssuesPorJQL,
  atualizarCampoJira,
  atualizarStatusJira,
  adicionarComentarioJira,
  alterarContaPagarOmie,
  anexarDocumentoOmie,
  buscarAnexosJira,
  downloadAnexoJira,
  consultarNotaQive,
  enviarAlertaSlack,
  consultarPlanilha,
  buscarEmailUsuarioJira,
  buscarAccountIdPorEmail,
  enviarMensagemSlackParaUsuarioPorEmail,
  OmieAlteracaoInput,
} from "./adapters";
import {
  findDocumentByCnpjNumero,
  findByJiraId,
  updateDocument,
} from "@database";
import { normalizeCpfCnpj, toIsoDate, toOmieDate } from "@shared/utils";
import { createLogger } from "@shared/logger";
import { Pagamento } from "@shared/types";

const logger = createLogger("jira-payment-orchestrator-service");

function extrairDadosFornecedor(fornecedor: string): { cnpj: string; razao_social: string } | null {
  // Usa sempre o ÚLTIMO par de parênteses para o CNPJ
  const ultimoAbre = fornecedor.lastIndexOf("(");
  const ultimoFecha = fornecedor.lastIndexOf(")");
  if (ultimoAbre === -1 || ultimoFecha === -1 || ultimoFecha < ultimoAbre) return null;
  const cnpj = fornecedor.substring(ultimoAbre + 1, ultimoFecha).trim();
  const razao_social = fornecedor.substring(0, ultimoAbre).trim();
  return { cnpj, razao_social };
}

const S = {
  VERIFICANDO_CADASTRO:  () => process.env.JIRA_STATUS_VERIFICANDO_CADASTRO  ?? "Verificando Cadastro De Fornecedor",
  APROVADOR_GESTOR:      () => process.env.JIRA_STATUS_APROVADOR_GESTOR      ?? "Aprovação Gestor",
  ALCADA1:               () => process.env.JIRA_STATUS_ALCADA1               ?? "Aprovador Gestor + Alçada 1",
  ALCADA2:               () => process.env.JIRA_STATUS_ALCADA2               ?? "Aprovador Gestor + Alçada 2",
  ANALISE_FISCAL:        () => process.env.JIRA_STATUS_ANALISE_FISCAL        ?? "Análise Fiscal",
  AGUARDANDO_AGENDAMENTO:() => process.env.JIRA_STATUS_AGUARDANDO_AGENDAMENTO ?? "Aguardando Agendamento MXM",
  AGUARDANDO_PAGAMENTO:  () => process.env.JIRA_STATUS_AGUARDANDO_PAGAMENTO  ?? "Aguardando Pagamento",
  AGENDAMENTO_MANUAL:    () => process.env.JIRA_STATUS_AGENDAMENTO_MANUAL    ?? "Agendamento Manual",
  PAGO:                  () => process.env.JIRA_STATUS_PAGO                  ?? "Pago",
};

export async function approverJira(
  config: Config,
  input: JiraIssueData,
  correlationId: string
): Promise<OrchestratorResult> {
  logger.info("approverJira iniciado", { correlation_id: correlationId, jira_id: input.jira_id, jira_recebido: input });
  
  // 1. Pegar a lista de aprovadores e regras de negócio
  let conjunto_de_aprovadores: Awaited<ReturnType<typeof consultarPlanilha>> = [];
  let regras_de_negocio: Awaited<ReturnType<typeof consultarPlanilha>> = [];

  logger.info(`Atualizando status para ${S.VERIFICANDO_CADASTRO()}`, { jira_id: input.jira_id });
  await atualizarStatusJira({ jira_id: input.jira_id, status_alvo: S.VERIFICANDO_CADASTRO() });

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
  // ── Atualizar CNPJ e Razão Social no Jira (customfield_10180 / 10179) ─────
  const dadosFornecedor = extrairDadosFornecedor(input.fornecedor ?? "");
  if (dadosFornecedor) {
    logger.info("Atualizando CNPJ e razão social no Jira", {
      jira_id: input.jira_id,
      cnpj: dadosFornecedor.cnpj,
      razao_social: dadosFornecedor.razao_social,
    });
    await Promise.allSettled([
      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_10180", valor: dadosFornecedor.cnpj }),
      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_10179", valor: dadosFornecedor.razao_social }),
    ]);
  } else {
    logger.warn("Não foi possível extrair CNPJ/razão social do fornecedor", {
      jira_id: input.jira_id,
      fornecedor: input.fornecedor,
    });
  }

  const squad_responsavel = input.squad;
  logger.info("Squad responsável extraído do Jira", { squad_responsavel });
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
    await atualizarStatusJira({ jira_id: input.jira_id, status_alvo: S.ALCADA2() });

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
    await atualizarStatusJira({ jira_id: input.jira_id, status_alvo: S.ALCADA1() });
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
    await atualizarStatusJira({ jira_id: input.jira_id, status_alvo: S.APROVADOR_GESTOR() });
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

  // 2. Validar prazo de tesouraria (usa regras_de_negocio já carregadas)
  await validarTesouraria(config, input, correlationId, regras_de_negocio).catch((e) =>
    logger.warn("Falha na validação de tesouraria — prosseguindo", { error: String(e) })
  );

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

  const forgeCheck = validarCamposForge(input);
  if (!forgeCheck.valido) {
    logger.warn("verifyInvoiceJira bloqueado — campos Forge/OCR não aprovados", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      motivo: forgeCheck.motivo,
    });
    return {
      jira_id: input.jira_id,
      acao: "verify_invoice",
      status: "bloqueado",
      mensagem: forgeCheck.motivo ?? "Campos de validação pendentes",
    };
  }

  const codigo_ntc = input.codigo_ntc;

  // ── Verificação Qive no BigQuery ──────────────────────────────────────────
  const cnpjQive = normalizeCpfCnpj(input.cnpj_cpf ?? "");
  const numeroQive = input.numero_documento ?? "";

  try {
    const notaQive = await consultarNotaQive(cnpjQive, numeroQive);
    const statusAutorizado = ["autorizada", "autorizado"].includes(
      notaQive?.document_status?.toLowerCase().trim() ?? ""
    );

    logger.info("Resultado da verificação Qive (BigQuery)", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      cnpj: cnpjQive,
      numero_nota: numeroQive,
      nfe_status: notaQive?.document_status ?? "não encontrada",
      autorizado: statusAutorizado,
    });

    await atualizarCampoJira({
      jira_id: input.jira_id,
      campo: "customfield_15143",
      valor: { value: statusAutorizado ? "true" : "false" },
    });
  } catch (bqErr) {
    const mensagemErro = bqErr instanceof Error ? bqErr.message : String(bqErr);
    logger.warn("Falha na verificação Qive — marcando como False e alertando canal", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      error: mensagemErro,
    });

    await atualizarCampoJira({
      jira_id: input.jira_id,
      campo: "customfield_15143",
      valor: { value: "false" },
    }).catch((e) => logger.warn("Falha ao atualizar customfield_15143", { error: String(e) }));

    enviarAlertaSlack({
      type: "channel",
      id: process.env.SLACK_ALERT_CHANNEL || process.env.SLACK_DEVELOPMENT_CHANNEL || "",
      message: [
        `⚠️ Falha na verificação Qive (BigQuery) para o ticket <https://insiderstore.atlassian.net/browse/${input.jira_id}|${input.jira_id}>`,
        `*CNPJ*: ${cnpjQive}`,
        `*Número da nota*: ${numeroQive}`,
        `*Erro*: ${mensagemErro}`,
      ].join("\n"),
    });
  }

  if (!codigo_ntc) {
    // Solicitação direta do SPAG, não produtivo
    const cnpjAjustado = normalizeCpfCnpj(input.cnpj_cpf ?? "desconecido");
    const valor = input.valor ?? 0;
    const valorCentavos = Math.round((valor || 0) * 100);
    const numero_documento = input.numero_documento ?? "desconecido";

    const existente = await findDocumentByCnpjNumero(cnpjAjustado, numero_documento);
    
    if (existente) {
      logger.info("Documento encontrado para verifyInvoiceJira", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        numero_documento,
        cnpj: cnpjAjustado,
        valor: valorCentavos,
      });

      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: { value: "true" } });
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

      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: { value: "false" } });
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
    const numero_documento = input.numero_documento ?? "desconecido";
    const existente = await findDocumentByCnpjNumero(cnpjAjustado, numero_documento);

    if (existente) {
      logger.info("Documento encontrado para verifyInvoiceJira", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        numero_documento,
        cnpj: cnpjAjustado,
        valor: valorCentavos,
      });

      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: { value: "true" } });

      // ── Análise de tesouraria (prazo de pagamento) — apenas NTC ──────────
      try {
        let regrasNtc: Awaited<ReturnType<typeof consultarPlanilha>> = [];
        try {
          regrasNtc = await consultarPlanilha({
            spreadsheetId: "1pcwoO-CXu5HPL-_19my3Vh2oy5BIOrZTr8yGTO_z6Zs",
            tabName: "valoresAlcada",
          });
        } catch { /* segue com default de 3 dias */ }

        const regraRow = regrasNtc.find(
          (r) => r["chave"] === "pagamento_minimo (dias)" || r["Chave"] === "pagamento_minimo (dias)"
        );
        const minimosDias = parseInt(regraRow?.["valor"] ?? regraRow?.["Valor"] ?? "3", 10);

        const vencimentoMs = parseDateToMs(input.vencimento ?? "");
        const hojeMs = new Date();
        hojeMs.setHours(0, 0, 0, 0);
        const diffDias = Math.floor((vencimentoMs - hojeMs.getTime()) / (1000 * 60 * 60 * 24));
        const prazoValido = !isNaN(diffDias) && diffDias >= minimosDias;

        logger.info("Análise de tesouraria (NTC)", {
          correlation_id: correlationId,
          jira_id: input.jira_id,
          vencimento: input.vencimento,
          dias_restantes: diffDias,
          minimos_dias: minimosDias,
          aprovado: prazoValido,
        });

        if (prazoValido) {
          atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15144", valor: { value: "True" } });
        } else {
          const motivo = isNaN(diffDias)
            ? "Data de vencimento não informada ou inválida."
            : `Data de vencimento em ${diffDias} dia(s), abaixo do mínimo de ${minimosDias} dia(s).`;

          await atualizarCampoJira({
            jira_id: input.jira_id,
            campo: "customfield_15144",
            valor: { value: "False" },
          }).catch((e) => logger.warn("Falha ao atualizar customfield_15144", { error: String(e) }));

          await adicionarComentarioJira(
            input.jira_id,
            `⛔ Validação de tesouraria reprovada.\n\n${motivo}\n\nO ticket permanecerá em análise até que a data de vencimento seja corrigida.`,
            true
          ).catch((e) => logger.warn("Falha ao adicionar comentário de tesouraria", { error: String(e) }));
        }
      } catch (tesErr) {
        logger.warn("Falha na análise de tesouraria (NTC) — ignorando", {
          correlation_id: correlationId,
          jira_id: input.jira_id,
          error: String(tesErr),
        });
      }

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

      atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: { value: "false" } });
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

  try {

  const codigo_ntc = input.codigo_ntc ?? "desconecido";
  const valor = input.valor ?? 0;
  const valorCentavos = Math.round((valor || 0) * 100);

  // ── Resolver chave de idempotência conforme tipo de solicitação ───────────
  const fornecedor = input.fornecedor ?? "desconecido";
  const docIdempotencia = input.numero_documento ?? "desconecido";
  const cnpjIdempotencia = normalizeCpfCnpj(input.cnpj_cpf ?? "desconecido");

  // ── Verificar idempotência: pular se já está agendado ────────────────────
  const registroExistente = await findDocumentByCnpjNumero(cnpjIdempotencia, docIdempotencia);
  if (registroExistente?.status === "agendado_pagamento") {
    logger.info("updateOmieJira: documento já agendado — ignorando", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      numero_documento: docIdempotencia,
      status: registroExistente.status,
    });
    return {
      jira_id: input.jira_id,
      acao: "update_omie",
      status: "ignorado",
      mensagem: "Documento já possui status agendado_pagamento — nenhuma ação necessária",
    };
  }

  const numero_documento = input.numero_documento ?? "desconecido";
  const cnpjCpf = normalizeCpfCnpj(input.cnpj_cpf ?? "desconecido");
  const tipo_nota = input.tipo_nota ?? "desconecido";
  const data_emissao = input.data_emissao ? toOmieDate(input.data_emissao) : "desconecido";
  const data_vencimento = input.vencimento ? toOmieDate(input.vencimento) : "desconecido";
  const metodo_de_pagamento = input.metodo_de_pagamento ?? "desconecido";
  const linha_digitavel_boleto = input.linha_digitavel_boleto ?? "desconecido";
  const squad = input.squad ?? "desconecido";
  let observacao = "";
  let nome_fornecedor = input.nome_fornecedor ?? "desconecido";
  let conta_bancaria = input.conta ?? "desconecido";
  let agencia_bancaria = input.agencia ?? "desconecido";
  let banco = input.banco ?? "desconecido";
  const numero_documento_producao = input.numero_documento ?? "desconecido";
  let tipo_de_pagamento = input.tipo_de_pagamento ?? "desconecido";
  const centro_de_custo = input.centro_de_custo ?? "desconecido";
  const jira_key = input.jira_id;
  const alteracaoInput = {} as OmieAlteracaoInput;

  // Preencher omie_id do MongoDB quando disponível
  const omieIdNum = parseInt(registroExistente?.omie_id ?? "0", 10);
  logger.info("omie_id do MongoDB", { correlation_id: correlationId, jira_id: input.jira_id, omie_id: omieIdNum });
  if (omieIdNum > 0) {
    alteracaoInput.codigo_lancamento_omie = omieIdNum;
    logger.info("omie_id encontrado no MongoDB — adicionando ao alteracaoInput", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      codigo_lancamento_omie: omieIdNum,
    });
  }


  if (codigo_ntc === "desconecido") {
    alteracaoInput.numero_pedido = jira_key;
    
    alteracaoInput.valor = valor;

    const dados_bancarios_fornecedor = await consultarPlanilha({ 
      spreadsheetId: "174bEqbbMCE3TQVFT1C6zTt0acgRMyciUwEI5EQZWbEU", 
      tabName: "Cadastro de Fornecedor" 
    });
    
    let dados_bancarios_encontrados = {};
    nome_fornecedor = input.nome_fornecedor || fornecedor.split("(")[0].trim() || nome_fornecedor;
    const cnpjAjustado = normalizeCpfCnpj(input.cnpj_cpf ?? "desconecido");
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
        codigo_forma_pagamento: "BOL",
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
        codigo_forma_pagamento: "TRA",
        finalidade_transferencia: "01.3",
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
        codigo_forma_pagamento: "TRA",
        finalidade_transferencia: "01.4",
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
      spreadsheetId: "174bEqbbMCE3TQVFT1C6zTt0acgRMyciUwEI5EQZWbEU",
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
      spreadsheetId: "174bEqbbMCE3TQVFT1C6zTt0acgRMyciUwEI5EQZWbEU",
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
        codigo_forma_pagamento: "BOL",
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
        codigo_forma_pagamento: "TRA",
        finalidade_transferencia: "01.3",
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
        codigo_forma_pagamento: "TRA",
        finalidade_transferencia: "01.4",
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
    let codigo_centro_custo_omie = "";
    if (tipo_de_pagamento == "Confecção") {
      codigo_grupo_pagamento = "2.01.03"
      codigo_centro_custo_omie = "6917704515"
    } else if (tipo_de_pagamento == "Matéria - Prima Principal") {
      codigo_grupo_pagamento = "2.01.01"
      codigo_centro_custo_omie = "6917704515"

    } else if (tipo_de_pagamento == "Fretes e Carretos (envio para clientes)") {
      codigo_grupo_pagamento = "2.11.97"
      codigo_centro_custo_omie = "6917704501"
    } else if (tipo_de_pagamento == "Fretes Internos de Produção") {
      codigo_grupo_pagamento = "2.01.04"
      codigo_centro_custo_omie = "6917704501"

    } else if (tipo_de_pagamento == "Outros CMV") {
      codigo_grupo_pagamento = "2.01.99"
      codigo_centro_custo_omie = "6917704501"

    } else if (tipo_de_pagamento == "Insumos") {
      codigo_grupo_pagamento = "2.01.02"
      codigo_centro_custo_omie = "6917704501"

    } else {
      codigo_grupo_pagamento = "2.02.02"
      codigo_centro_custo_omie = "6917704981"
    }
    
    
    

    alteracaoInput.codigo_categoria = codigo_grupo_pagamento;
    alteracaoInput.codigo_centro_custo = codigo_centro_custo_omie;

  }

  // ── Chamar Omie e tratar sucesso/erro ────────────────────────────────────
  try {
    logger.info("Chamando alterarContaPagarOmie", { correlation_id: correlationId, jira_id: input.jira_id, alteracaoInput });
    await alterarContaPagarOmie(alteracaoInput);

    logger.info("Omie atualizado com sucesso — atualizando MongoDB e transitando Jira", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      numero_documento: docIdempotencia,
    });

    await updateDocument(docIdempotencia, cnpjIdempotencia, valorCentavos, {
      status: "agendado_pagamento",
      jira_id: input.jira_id,
    }).catch((e) => logger.warn("Falha ao atualizar status no MongoDB", { error: String(e) }));

    // ── Anexar documentos do Jira no Omie ────────────────────────────────────
    try {
      const anexos = await buscarAnexosJira(input.jira_id);
      const anexosFiltrados = anexos.filter(
        (a) => !a.filename.toLowerCase().endsWith(".json")
      );

      logger.info("Anexos encontrados no Jira", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        total: anexos.length,
        a_enviar: anexosFiltrados.length,
      });

      const omieIdNum = parseInt(registroExistente?.omie_id ?? "0", 10);
      for (const anexo of anexosFiltrados) {
        try {
          const buffer = await downloadAnexoJira(anexo.content);
          await anexarDocumentoOmie(omieIdNum, anexo.filename, buffer);
          logger.info("Anexo enviado ao Omie", {
            correlation_id: correlationId,
            filename: anexo.filename,
          });
        } catch (anexoErr) {
          logger.warn("Falha ao enviar anexo ao Omie — ignorando", {
            correlation_id: correlationId,
            filename: anexo.filename,
            error: String(anexoErr),
          });
        }
      }
    } catch (anexosErr) {
      logger.warn("Falha ao buscar anexos do Jira — prosseguindo sem eles", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        error: String(anexosErr),
      });
    }

    await atualizarStatusJira({ jira_id: input.jira_id, status_alvo: S.AGUARDANDO_PAGAMENTO() });

    return {
      jira_id: input.jira_id,
      acao: "update_omie",
      status: "sucesso",
      mensagem: "Omie atualizado, MongoDB atualizado para agendado_pagamento e ticket transitado para Aguardando Pagamento",
    };
  } catch (omieErr) {
    const mensagemErro = omieErr instanceof Error ? omieErr.message : String(omieErr);

    logger.error("Erro ao atualizar Omie — executando fluxo de erro", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      error: mensagemErro,
    });

    // Comentário interno no Jira
    await adicionarComentarioJira(
      input.jira_id,
      `⚠️ Erro ao agendar pagamento no Omie (requer agendamento manual).\n\nDetalhes: ${mensagemErro}`,
      true
    ).catch((e) => logger.warn("Falha ao adicionar comentário no Jira", { error: String(e) }));

    // Alerta no Slack
    enviarAlertaSlack({
      type: "channel",
      id: process.env.SLACK_DEVELOPMENT_CHANNEL || "",
      message: [
        `⚠️ Erro no agendamento Omie — requer intervenção manual`,
        `*Jira*: <https://insiderstore.atlassian.net/browse/${input.jira_id}|${input.jira_id}>`,
        `*Erro*: ${mensagemErro}`,
      ].join("\n"),
    });

    // Transição para Agendamento Manual
    await atualizarStatusJira({ jira_id: input.jira_id, status_alvo: S.AGENDAMENTO_MANUAL() })
      .catch((e) => logger.warn("Falha ao transicionar para Agendamento Manual", { error: String(e) }));

    return {
      jira_id: input.jira_id,
      acao: "update_omie",
      status: "erro",
      mensagem: `Erro ao atualizar Omie: ${mensagemErro}`,
    };
  }

  } catch (unexpectedErr) {
    const mensagem = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr);

    logger.error("Erro inesperado em updateOmieJira", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      error: mensagem,
    });

    await adicionarComentarioJira(
      input.jira_id,
      `🚨 Erro inesperado durante o agendamento no Omie.\n\nDetalhes: ${mensagem}`,
      true
    ).catch((e) => logger.warn("Falha ao adicionar comentário de erro no Jira", { error: String(e) }));

    await atualizarStatusJira({ jira_id: input.jira_id, status_alvo: S.AGENDAMENTO_MANUAL() })
      .catch((e) => logger.warn("Falha ao transicionar para Agendamento Manual", { error: String(e) }));

    return {
      jira_id: input.jira_id,
      acao: "update_omie",
      status: "erro",
      mensagem: `Erro inesperado: ${mensagem}`,
    };
  }
}

function parseDateToMs(dateStr: string): number {
  if (!dateStr) return NaN;
  // ISO: yyyy-mm-dd ou yyyy-mm-ddTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr).getTime();
  // Brasileiro: dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    return new Date(`${y}-${m}-${d}`).getTime();
  }
  return new Date(dateStr).getTime();
}

export async function validarTesouraria(
  config: Config,
  input: JiraIssueData,
  correlationId: string,
  regrasPreCarregadas?: Awaited<ReturnType<typeof consultarPlanilha>>
): Promise<OrchestratorResult> {
  logger.info("validarTesouraria iniciado", {
    correlation_id: correlationId,
    jira_id: input.jira_id,
    vencimento: input.vencimento,
  });

  // ── Buscar regras de negócio (ou usar as já carregadas) ───────────────────
  let regras: Awaited<ReturnType<typeof consultarPlanilha>> = regrasPreCarregadas ?? [];
  if (!regrasPreCarregadas) {
    try {
      regras = await consultarPlanilha({
        spreadsheetId: "1pcwoO-CXu5HPL-_19my3Vh2oy5BIOrZTr8yGTO_z6Zs",
        tabName: "valoresAlcada",
      });
    } catch (err) {
      logger.warn("Não foi possível carregar regras de negócio do Google Sheets", {
        correlation_id: correlationId,
        error: String(err),
      });
    }
  }

  const regraRow = regras.find(
    (r) => r["chave"] === "pagamento_minimo (dias)" || r["Chave"] === "pagamento_minimo (dias)"
  );
  const minimosDias = parseInt(regraRow?.["valor"] ?? regraRow?.["Valor"] ?? "3", 10);

  logger.info("Regra de prazo mínimo carregada", {
    correlation_id: correlationId,
    minimos_dias: minimosDias,
  });

  // ── Verificar prazo ───────────────────────────────────────────────────────
  const vencimentoMs = parseDateToMs(input.vencimento ?? "");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffDias = Math.floor((vencimentoMs - hoje.getTime()) / (1000 * 60 * 60 * 24));

  logger.info("Comparação de prazo", {
    correlation_id: correlationId,
    jira_id: input.jira_id,
    vencimento: input.vencimento,
    dias_restantes: diffDias,
    minimos_dias: minimosDias,
  });

  const prazoValido = !isNaN(diffDias) && diffDias >= minimosDias;

  if (prazoValido) {
    // ── Prazo OK ──────────────────────────────────────────────────────────
    logger.info("Prazo válido — atualizando customfield_15144 para true", {
      correlation_id: correlationId,
      jira_id: input.jira_id,
      dias_restantes: diffDias,
    });

    await atualizarCampoJira({
      jira_id: input.jira_id,
      campo: "customfield_15144",
      valor: { value: "true" },
    });

    return {
      jira_id: input.jira_id,
      acao: "validar_tesouraria",
      status: "aprovado",
      mensagem: `Prazo válido: ${diffDias} dias restantes (mínimo: ${minimosDias})`,
    };
  }

  // ── Prazo inválido ─────────────────────────────────────────────────────
  const motivoMsg = isNaN(diffDias)
    ? `Data de vencimento não informada ou inválida.`
    : `Data de vencimento em ${diffDias} dia(s), abaixo do mínimo exigido de ${minimosDias} dia(s).`;

  logger.warn("Prazo insuficiente — bloqueando em Análise de Tesouraria", {
    correlation_id: correlationId,
    jira_id: input.jira_id,
    dias_restantes: diffDias,
    minimos_dias: minimosDias,
  });

  // Atualizar campo para False
  await atualizarCampoJira({
    jira_id: input.jira_id,
    campo: "customfield_15144",
    valor: { value: "false" },
  }).catch((e) => logger.warn("Falha ao atualizar customfield_15144", { error: String(e) }));

  // Comentário interno no Jira
  await adicionarComentarioJira(
    input.jira_id,
    `⛔ Validação de tesouraria reprovada.\n\n${motivoMsg}\n\nO ticket permanecerá em "Análise de Tesouraria" até que a data de vencimento seja corrigida.`,
    true
  ).catch((e) => logger.warn("Falha ao adicionar comentário de tesouraria", { error: String(e) }));

  // Alertar o criador do ticket
  const criadorEmail = await buscarEmailUsuarioJira(input.criador ?? "").catch(() => null);
  if (criadorEmail) {
    enviarMensagemSlackParaUsuarioPorEmail({
      email: criadorEmail,
      message: [
        `⛔ Seu ticket Jira <https://insiderstore.atlassian.net/browse/${input.jira_id}|${input.jira_id}> foi bloqueado na etapa de Análise de Tesouraria.`,
        `*Motivo*: ${motivoMsg}`,
        `Por favor, entre em contato com o time de tesouraria para regularizar.`,
      ].join("\n"),
    });
  }

  return {
    jira_id: input.jira_id,
    acao: "validar_tesouraria",
    status: "reprovado",
    mensagem: motivoMsg,
  };
}

function validarCamposForge(issueData: JiraIssueData): { valido: boolean; motivo?: string } {
  const isTrue = (v?: string) => v?.toLowerCase().trim() === "true";
  const faltando: string[] = [];
  if (!isTrue(issueData.validacao_forge_app))  faltando.push("Validação Forge APP (customfield_15100)");
  if (!isTrue(issueData.validacao_forge_jira)) faltando.push("Validação Forge x Jira (customfield_15101)");
  if (!isTrue(issueData.validacao_ocr_ia))     faltando.push("Validação OCR/IA (customfield_15145)");
  if (faltando.length === 0) return { valido: true };
  return { valido: false, motivo: `Campos pendentes: ${faltando.join(", ")}` };
}

const REPROCESS_JQL = () =>
  `project = SPAG AND status = "${S.ANALISE_FISCAL()}"`;


export async function reprocessJira(
  config: Config,
  input: ReprocessJiraInput,
  correlationId: string
): Promise<{ processados: number; erros: number }> {
  let processados = 0;
  let erros = 0;

  const jql = input.jql ?? REPROCESS_JQL();

  logger.info("[REPROCESS] Buscando tickets no Jira por JQL", { correlation_id: correlationId, jql });

  const issues = await buscarIssuesPorJQL(jql, [
    "customfield_12112", // numero_do_titulo
    "customfield_10181", // valor
    "customfield_10180", // cnpj_do_fornecedor
    "customfield_12563", "customfield_12562", "customfield_12416",
    "customfield_12425", "customfield_12564", "customfield_12566", "customfield_12565",
    "customfield_15100", "customfield_15101", "customfield_15143", "customfield_15145",
  ]);

  logger.info("[REPROCESS] Tickets encontrados", { correlation_id: correlationId, total: issues.length });

  for (const issue of issues) {
    try {
      const issueData = mapJiraPayload({ issue: { key: issue.key, fields: issue.fields } });

      const numero_documento = issueData.numero_documento;
      const cnpj = normalizeCpfCnpj(issueData.cnpj_cpf ?? "");
      const valorCentavos = Math.round((issueData.valor ?? 0) * 100);

      logger.info("[REPROCESS] Verificando ticket no MongoDB", {
        correlation_id: correlationId,
        jira_id: issue.key,
        numero_documento,
        cnpj,
        valor_centavos: valorCentavos,
      });

      if (!numero_documento || !cnpj || valorCentavos === 0) {
        logger.warn("[REPROCESS] Dados insuficientes para busca — ignorando", {
          correlation_id: correlationId,
          jira_id: issue.key,
          numero_documento,
          cnpj,
          valorCentavos,
        });
        continue;
      }

      const existente = await findDocumentByCnpjNumero(cnpj, numero_documento ?? "");

      const forgeCheck = validarCamposForge(issueData);
      if (!forgeCheck.valido) {
        logger.warn("[REPROCESS] Ticket ignorado — campos Forge/OCR não aprovados", {
          correlation_id: correlationId,
          jira_id: issue.key,
          motivo: forgeCheck.motivo,
        });
        continue;
      }

      // ── Verificação Qive (BigQuery) ───────────────────────────────────────
      try {
        const notaQive = await consultarNotaQive(cnpj, numero_documento ?? "");
        const statusAutorizado = ["autorizada", "autorizado"].includes(
          notaQive?.document_status?.toLowerCase().trim() ?? ""
        );
        logger.info("[REPROCESS] Resultado verificação Qive", {
          correlation_id: correlationId,
          jira_id: issue.key,
          document_status: notaQive?.document_status ?? "não encontrada",
          autorizado: statusAutorizado,
        });
        await atualizarCampoJira({
          jira_id: issue.key,
          campo: "customfield_15143",
          valor: { value: statusAutorizado ? "true" : "false" },
        });
      } catch (bqErr) {
        logger.warn("[REPROCESS] Falha na verificação Qive — customfield_15143 não atualizado", {
          correlation_id: correlationId,
          jira_id: issue.key,
          error: String(bqErr),
        });
      }

      if (existente) {
        logger.info("[REPROCESS] Documento encontrado no MongoDB — atualizando customfield_15098", {
          correlation_id: correlationId,
          jira_id: issue.key,
          numero_documento,
        });

        await atualizarCampoJira({
          jira_id: issue.key,
          campo: "customfield_15098",
          valor: { value: "true" },
        });

        processados++;
      } else {
        logger.info("[REPROCESS] Documento NÃO encontrado no MongoDB — nenhuma ação", {
          correlation_id: correlationId,
          jira_id: issue.key,
          numero_documento,
          cnpj,
          valor_centavos: valorCentavos,
        });
      }
    } catch (err) {
      erros++;
      logger.error("[REPROCESS] Erro ao processar ticket", {
        correlation_id: correlationId,
        jira_id: issue.key,
        error: String(err),
      });
    }
  }

  logger.info("[REPROCESS] Reprocessamento concluído", { correlation_id: correlationId, processados, erros });
  return { processados, erros };
}

const AGENDAMENTO_JQL = () =>
  `project = SPAG AND status = "${S.AGUARDANDO_AGENDAMENTO()}"`;


const AGENDAMENTO_FIELDS = [
  "customfield_12112", "customfield_10181", "customfield_10184",
  "customfield_10183", "customfield_10182", "customfield_10186",
  "customfield_10180", "customfield_10179", "customfield_10178",
  "customfield_10214", "customfield_10195", "customfield_10196",
  "customfield_10189", "customfield_10190", "customfield_12243",
  "customfield_12568", "customfield_11645",
  "customfield_12563", "customfield_12562", "customfield_12416",
  "customfield_12425", "customfield_12564", "customfield_12566", "customfield_12565",
  "customfield_15100", "customfield_15101", "customfield_15143", "customfield_15145",
  "summary", "status",
];

export async function reprocessAguardandoAgendamento(
  config: Config,
  correlationId: string
): Promise<{ processados: number; erros: number }> {
  let processados = 0;
  let erros = 0;

  logger.info("[AGENDAMENTO] Buscando tickets em 'Aguardando Agendamento MXM'", {
    correlation_id: correlationId,
    jql: AGENDAMENTO_JQL(),
  });

  const issues = await buscarIssuesPorJQL(AGENDAMENTO_JQL(), AGENDAMENTO_FIELDS);

  logger.info("[AGENDAMENTO] Tickets encontrados", {
    correlation_id: correlationId,
    total: issues.length,
  });

  for (const issue of issues) {
    const issueData = mapJiraPayload({ issue: { key: issue.key, fields: issue.fields } });
    try {
      logger.info("[AGENDAMENTO] Processando ticket", {
        correlation_id: correlationId,
        jira_id: issue.key,
        numero_documento: issueData.numero_documento,
        fornecedor: issueData.fornecedor,
        valor: issueData.valor,
      });

      await updateOmieJira(config, issueData, correlationId);
      processados++;
    } catch (err) {
      erros++;
      logger.error("[AGENDAMENTO] Erro ao processar ticket", {
        correlation_id: correlationId,
        jira_id: issue.key,
        error: String(err),
      });
      enviarAlertaSlack({
        type: "channel",
        id: process.env.SLACK_DEVELOPMENT_CHANNEL || "",
        message: [
          `🚨 Erro em reprocessAguardandoAgendamento`,
          `*Jira*: <https://insiderstore.atlassian.net/browse/${issue.key}|${issue.key}>`,
          `*Fornecedor*: ${issueData.fornecedor ?? "não informado"}`,
          `*Valor*: R$ ${issueData.valor?.toFixed(2) ?? "não informado"}`,
          `*Erro*: ${err instanceof Error ? err.message : String(err)}`,
        ].join("\n"),
      });
    }
  }

  logger.info("[AGENDAMENTO] Reprocessamento concluído", { correlation_id: correlationId, processados, erros });
  return { processados, erros };
}
