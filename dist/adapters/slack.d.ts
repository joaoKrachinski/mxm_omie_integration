export type SlackAlertInput = {
    channel?: string;
    tipo_erro: string;
    jira_id?: string;
    mxm_id?: string;
    omie_id?: string;
    numero_documento?: string;
    cnpj_cpf?: string;
    valor?: number;
    status_atual?: string;
    acao_esperada: string;
    link?: string;
    correlation_id?: string;
};
export declare function enviarAlertaSlack(input: SlackAlertInput): Promise<void>;
