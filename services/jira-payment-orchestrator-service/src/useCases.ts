import { Db } from "mongodb";
import type { Config } from "./config";
import type {
  ApproverJiraInput,
  VerifyInvoiceJiraInput,
  UpdateOmieJiraInput,
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
} from "./adapters";
import {
  findByIdempotencyKey,
  findByJiraId,
  updateJiraInfo,
  updateStatus,
  findStuckByStatus,
} from "./repository";
import { normalizeCpfCnpj, toIsoDate, genCorrelationId } from "@shared/utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("jira-payment-orchestrator-service");

export async function approverJira(
  db: Db,
  config: Config,
  input: ApproverJiraInput,
  correlationId: string
): Promise<OrchestratorResult> {
  logger.info("approverJira iniciado", { correlation_id: correlationId, jira_id: input.jira_id });

  // TODO: implementar lógica real de aprovação no Jira
  // 1. buscarIssueJira(input.jira_id) para obter dados completos da issue
  // 2. Validar tipo do ticket: [SPAG] ou [SPAG-P]
  // 3. Validar regra de X dias antes do vencimento
  // 4. Incluir aprovador na issue via atualizarCampoJira
  // 5. Registrar log estruturado

  return {
    jira_id: input.jira_id,
    acao: "approver_jira",
    status: "pendente",
    mensagem: "TODO: lógica real de aprovação não implementada",
  };
}

export async function verifyInvoiceJira(
  db: Db,
  config: Config,
  input: VerifyInvoiceJiraInput,
  correlationId: string
): Promise<OrchestratorResult> {
  logger.info("verifyInvoiceJira iniciado", { correlation_id: correlationId, jira_id: input.jira_id });

  // Quando dados disponíveis, buscar por idempotência
  if (input.numero_documento && input.cnpj_cpf && input.valor != null) {
    const cnpjCpf = normalizeCpfCnpj(input.cnpj_cpf);
    const registro = await findByIdempotencyKey(db, input.numero_documento, cnpjCpf, input.valor);

    if (registro) {
      await updateJiraInfo(db, input.numero_documento, cnpjCpf, input.valor, input.jira_id, {
        jira_creation_date: toIsoDate(new Date()),
      });

      // TODO: marcar customfield_15098 ([SPAG] Documento Fiscal Integrado) como True
      // await atualizarCampoJira({ jira_id: input.jira_id, campo: "customfield_15098", valor: true });

      logger.info("Título encontrado, jira_id persistido com status criado_jira", {
        correlation_id: correlationId,
        jira_id: input.jira_id,
        mxm_id: registro.mxm_id,
      });

      return {
        jira_id: input.jira_id,
        acao: "verify_invoice",
        status: "criado_jira",
        mensagem: "Título encontrado e jira_id persistido",
      };
    }

    // TODO: alertar Fiscal/Tesouraria quando título não encontrado
    // await enviarAlertaSlack({ tipo_erro: "titulo_nao_encontrado", jira_id: input.jira_id, acao_esperada: "Verificar NF no MXM/Omie", correlation_id: correlationId });
    logger.warn("Título não encontrado na base", { correlation_id: correlationId, jira_id: input.jira_id });

    return {
      jira_id: input.jira_id,
      acao: "verify_invoice",
      status: "nota_nao_encontrada",
      mensagem: "Título não encontrado. TODO: alertar Fiscal/Tesouraria",
    };
  }

  // TODO: buscar dados da issue no Jira para obter numero_documento, cnpj_cpf, valor
  // const issue = await buscarIssueJira(input.jira_id);
  // Extrair campos da issue e repetir lógica acima

  return {
    jira_id: input.jira_id,
    acao: "verify_invoice",
    status: "pendente",
    mensagem: "TODO: dados de número_documento/cnpj_cpf/valor não informados",
  };
}

export async function updateOmieJira(
  db: Db,
  config: Config,
  input: UpdateOmieJiraInput,
  correlationId: string
): Promise<OrchestratorResult> {
  logger.info("updateOmieJira iniciado", { correlation_id: correlationId, jira_id: input.jira_id });

  // TODO: implementar atualização de dados operacionais no Omie quando Jira entrar em Aguardando Agendamento
  // 1. buscarIssueJira para obter dados de pagamento (forma, chave pix, boleto, etc.)
  // 2. alterarContaPagarOmie com os dados de pagamento
  // 3. Atualizar status no MongoDB para agendado_pagamento
  // 4. Consultar planilha via consultarPlanilha se necessário:
  //    config.sheets.spreadsheetId, config.sheets.tabName, config.sheets.range

  return {
    jira_id: input.jira_id,
    acao: "update_omie",
    status: "pendente",
    mensagem: "TODO: atualização real do Omie não implementada",
  };
}

export async function reprocessJira(
  db: Db,
  config: Config,
  input: ReprocessJiraInput,
  correlationId: string
): Promise<{ processados: number; erros: number }> {
  const status = input.status ?? "nota_nao_encontrada";
  const registros = await findStuckByStatus(db, status, input.desde, input.limite);

  let processados = 0;
  let erros = 0;

  for (const registro of registros) {
    try {
      // TODO: implementar reprocessamento real
      // Tentar verificar novamente se título agora existe no Omie
      logger.info("Reprocessando registro Jira", { correlation_id: correlationId, jira_id: registro.jira_id, mxm_id: registro.mxm_id });
      processados++;
    } catch (err) {
      erros++;
      logger.error("Erro no reprocessamento Jira", { correlation_id: correlationId, jira_id: registro.jira_id, error: String(err) });
    }
  }

  return { processados, erros };
}
