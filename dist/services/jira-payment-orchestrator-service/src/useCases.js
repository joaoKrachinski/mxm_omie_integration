"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approverJira = approverJira;
exports.verifyInvoiceJira = verifyInvoiceJira;
exports.updateOmieJira = updateOmieJira;
exports.reprocessJira = reprocessJira;
const repository_1 = require("./repository");
const utils_1 = require("@shared/utils");
const logger_1 = require("@shared/logger");
const logger = (0, logger_1.createLogger)("jira-payment-orchestrator-service");
async function approverJira(db, config, input, correlationId) {
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
async function verifyInvoiceJira(db, config, input, correlationId) {
    logger.info("verifyInvoiceJira iniciado", { correlation_id: correlationId, jira_id: input.jira_id });
    // Quando dados disponíveis, buscar por idempotência
    if (input.numero_documento && input.cnpj_cpf && input.valor != null) {
        const cnpjCpf = (0, utils_1.normalizeCpfCnpj)(input.cnpj_cpf);
        const registro = await (0, repository_1.findByIdempotencyKey)(db, input.numero_documento, cnpjCpf, input.valor);
        if (registro) {
            await (0, repository_1.updateJiraInfo)(db, input.numero_documento, cnpjCpf, input.valor, input.jira_id, {
                jira_creation_date: (0, utils_1.toIsoDate)(new Date()),
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
async function updateOmieJira(db, config, input, correlationId) {
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
async function reprocessJira(db, config, input, correlationId) {
    const status = input.status ?? "nota_nao_encontrada";
    const registros = await (0, repository_1.findStuckByStatus)(db, status, input.desde, input.limite);
    let processados = 0;
    let erros = 0;
    for (const registro of registros) {
        try {
            // TODO: implementar reprocessamento real
            // Tentar verificar novamente se título agora existe no Omie
            logger.info("Reprocessando registro Jira", { correlation_id: correlationId, jira_id: registro.jira_id, mxm_id: registro.mxm_id });
            processados++;
        }
        catch (err) {
            erros++;
            logger.error("Erro no reprocessamento Jira", { correlation_id: correlationId, jira_id: registro.jira_id, error: String(err) });
        }
    }
    return { processados, erros };
}
//# sourceMappingURL=useCases.js.map