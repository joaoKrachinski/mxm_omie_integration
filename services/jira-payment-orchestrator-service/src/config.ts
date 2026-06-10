function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function loadConfig() {
  return {
    port: parseInt(optional("PORT_JIRA", optional("PORT", "3002")), 10),
    nodeEnv: optional("NODE_ENV", "development"),
    logLevel: optional("LOG_LEVEL", "info"),
    timeoutSeconds: parseInt(optional("SERVICE_TIMEOUT_SECONDS", "30"), 10),

    mongodb: {
      uri: required("MONGODB_URI"),
      database: required("MONGODB_DATABASE"),
      collection: optional("MONGODB_COLLECTION_PAYMENT_INTEGRATIONS", "payment_integrations"),
    },

    jira: {
      baseUrl: required("JIRA_BASE_URL"),
      email: required("JIRA_EMAIL"),
      apiToken: required("JIRA_API_TOKEN"),
    },

    sheets: {
      spreadsheetId: optional("GOOGLE_SHEETS_SPREADSHEET_ID", ""),
      tabName: optional("GOOGLE_SHEETS_TAB_NAME", ""),
      range: optional("GOOGLE_SHEETS_RANGE", ""),
    },

    omie: {
      baseUrl: required("OMIE_BASE_URL"),
      appKey: required("OMIE_APP_KEY"),
      appSecret: required("OMIE_APP_SECRET"),
    },

    slack: {
      botToken: optional("SLACK_BOT_TOKEN", ""),
      alertChannel: optional("SLACK_ALERT_CHANNEL", ""),
    },

    gcp: {
      projectId: optional("GCP_PROJECT_ID", "ftd-data-lake"),
      region: optional("GCP_REGION", "us-east1"),
    },
  };
}

export type Config = ReturnType<typeof loadConfig>;
