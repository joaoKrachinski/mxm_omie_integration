export type JiraIssue = {
    jira_id: string;
    summary: string;
    status: string;
    fields: Record<string, unknown>;
};
export type JiraCampoUpdate = {
    jira_id: string;
    campo: string;
    valor: unknown;
};
export type JiraStatusUpdate = {
    jira_id: string;
    transition_id: string;
};
export declare function getJiraCredentials(email: String, apiToken: String): Promise<string>;
export declare function buscarIssueJira(jiraId: string): Promise<JiraIssue | null>;
export declare function buscarIssueJiraPorOmieId(omieId: string): Promise<JiraIssue | null>;
export declare function atualizarCampoJira(input: JiraCampoUpdate): Promise<void>;
export declare function atualizarStatusJira(input: JiraStatusUpdate): Promise<void>;
export declare function atualizarJiraComoPago(jiraId: string, dataPagamento: string): Promise<void>;
