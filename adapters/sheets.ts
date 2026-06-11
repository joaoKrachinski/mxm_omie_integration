// packages/adapters/src/google-sheets/sheets.adapter.ts

import { google, sheets_v4 } from "googleapis";

export type SheetRow = Record<string, string>;

export type SheetConsultaInput = {
  spreadsheetId: string;
  tabName: string;
  range?: string;
};

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

const GOOGLE_SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

export function getSheetConsultaInputFromEnv(): SheetConsultaInput {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME;
  const range = process.env.GOOGLE_SHEETS_RANGE;

  if (!spreadsheetId) {
    throw new Error("Variável GOOGLE_SHEETS_SPREADSHEET_ID é obrigatória");
  }

  if (!tabName) {
    throw new Error("Variável GOOGLE_SHEETS_TAB_NAME é obrigatória");
  }

  return {
    spreadsheetId,
    tabName,
    range,
  };
}

export async function criarGoogleSheetsClient(): Promise<sheets_v4.Sheets> {
  const credentials = getServiceAccountCredentialsFromEnv();

  const auth = new google.auth.GoogleAuth({
    scopes: [GOOGLE_SHEETS_READONLY_SCOPE],

    /**
     * Opção 1:
     * Usa credenciais vindas de GOOGLE_SERVICE_ACCOUNT_JSON
     * ou GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
     */
    credentials,

    /**
     * Opção 2:
     * Se credentials for undefined, o GoogleAuth tenta usar ADC.
     *
     * Em local:
     * GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json
     *
     * Em Cloud Run:
     * usa a service account anexada ao serviço.
     */
    keyFile: credentials
      ? undefined
      : process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  const authClient = await auth.getClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return google.sheets({ version: "v4", auth: authClient as any });
}

export async function consultarPlanilha(
  input: SheetConsultaInput,
): Promise<SheetRow[]> {
  const sheetsClient = await criarGoogleSheetsClient();

  const range = buildA1Range(input);

  const response = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: input.spreadsheetId,
    range,
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const values = response.data.values ?? [];

  return mapSheetValuesToRows(values);
}

export async function consultarPlanilhaFromEnv(): Promise<SheetRow[]> {
  return consultarPlanilha(getSheetConsultaInputFromEnv());
}

function getServiceAccountCredentialsFromEnv():
  | ServiceAccountCredentials
  | undefined {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    let parsed: ServiceAccountCredentials;
    try {
      parsed = JSON.parse(serviceAccountJson) as ServiceAccountCredentials;
    } catch {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON contém JSON inválido. " +
        "Certifique-se de que o valor é um JSON válido em uma única linha no .env."
      );
    }

    return {
      ...parsed,
      private_key: normalizePrivateKey(parsed.private_key),
    };
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    return {
      client_email: clientEmail,
      private_key: normalizePrivateKey(privateKey),
      project_id: process.env.GOOGLE_CLOUD_PROJECT,
    };
  }

  return undefined;
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n");
}

function buildA1Range(input: SheetConsultaInput): string {
  const range = input.range?.trim() || "A:Z";

  /**
   * Caso o range já venha completo:
   * Exemplo: "Minha Aba!A1:Z100"
   */
  if (range.includes("!")) {
    return range;
  }

  const escapedTabName = escapeSheetName(input.tabName);

  return `${escapedTabName}!${range}`;
}

function escapeSheetName(tabName: string): string {
  const escaped = tabName.replace(/'/g, "''");

  return `'${escaped}'`;
}

function mapSheetValuesToRows(values: unknown[][]): SheetRow[] {
  if (!values.length) {
    return [];
  }

  const [headerRow, ...dataRows] = values;

  const headers = headerRow.map((header) => String(header ?? "").trim());

  return dataRows
    .filter((row) => hasAnyValue(row))
    .map((row) => {
      const item: SheetRow = {};

      headers.forEach((header, index) => {
        if (!header) {
          return;
        }

        item[header] = String(row[index] ?? "").trim();
      });

      return item;
    });
}

function hasAnyValue(row: unknown[]): boolean {
  return row.some((cell) => String(cell ?? "").trim() !== "");
}