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

export async function enviarAlertaSlack(input: SlackAlertInput): Promise<void> {
  // TODO: implementar envio de alerta ao Slack
  // POST https://slack.com/api/chat.postMessage
  // Autenticação via SLACK_BOT_TOKEN
  // Canal padrão via SLACK_ALERT_CHANNEL, pode ser sobrescrito por input.channel
  throw new Error("TODO: enviarAlertaSlack não implementado");
}
