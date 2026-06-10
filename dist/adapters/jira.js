"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJiraCredentials = getJiraCredentials;
exports.buscarIssueJira = buscarIssueJira;
exports.buscarIssueJiraPorOmieId = buscarIssueJiraPorOmieId;
exports.atualizarCampoJira = atualizarCampoJira;
exports.atualizarStatusJira = atualizarStatusJira;
exports.atualizarJiraComoPago = atualizarJiraComoPago;
const logger_1 = require("@shared/logger");
const logger = (0, logger_1.createLogger)("jira-adapter");
function getJiraConfig() {
    const baseUrl = process.env.JIRA_BASE_URL;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;
    if (!baseUrl || !email || !apiToken) {
        throw new Error("Variáveis JIRA_BASE_URL, JIRA_EMAIL e JIRA_API_TOKEN são obrigatórias");
    }
    return {
        baseUrl,
        email,
        apiToken,
    };
}
async function getJiraCredentials(email, apiToken) {
    const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
    return `Basic ${token}`;
}
async function buscarIssueJira(jiraId) {
    logger.info('Iniciando busca de issue no Jira', { jiraId });
    const { email, apiToken, baseUrl } = getJiraConfig();
    const authHeader = await getJiraCredentials(email, apiToken);
    const url = `${baseUrl}/rest/api/3/issue/${jiraId}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
            }
        });
        if (response.status === 404) {
            logger.warn('Issue não encontrada no Jira', { jiraId });
            return null;
        }
        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Erro ao buscar issue no Jira', { jiraId, status: response.status, error: errorText });
            throw new Error(`Erro ao buscar issue no Jira: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        logger.info('Issue encontrada no Jira', { jiraId, summary: data.fields.summary, status: data.fields.status.name });
        return {
            jira_id: data.id,
            summary: data.fields.summary,
            status: data.fields.status.name,
            fields: data.fields,
        };
    }
    catch (error) {
        logger.error('Exceção ao buscar issue no Jira', { jiraId, error: String(error) });
        throw error;
    }
}
async function buscarIssueJiraPorOmieId(omieId) {
    // TODO: implementar busca de issue no Jira
    // GET {JIRA_BASE_URL}/rest/api/3/issue/{jiraId}
    // Autenticação Basic via JIRA_EMAIL:JIRA_API_TOKEN
    throw new Error("TODO: buscarIssueJira não implementado");
}
async function atualizarCampoJira(input) {
    // TODO: implementar atualização de campo no Jira
    // PUT {JIRA_BASE_URL}/rest/api/3/issue/{jira_id}
    // Atualiza campos como customfield_15098 ([SPAG] Documento Fiscal Integrado)
    throw new Error("TODO: atualizarCampoJira não implementado");
}
async function atualizarStatusJira(input) {
    // TODO: implementar transição de status no Jira
    // POST {JIRA_BASE_URL}/rest/api/3/issue/{jira_id}/transitions
    throw new Error("TODO: atualizarStatusJira não implementado");
}
async function atualizarJiraComoPago(jiraId, dataPagamento) {
    // TODO: implementar atualização do Jira refletindo pagamento confirmado no Omie
    throw new Error("TODO: atualizarJiraComoPago não implementado");
}
//# sourceMappingURL=jira.js.map