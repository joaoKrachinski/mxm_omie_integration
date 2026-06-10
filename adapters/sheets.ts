export type SheetRow = Record<string, string>;

export type SheetConsultaInput = {
  spreadsheetId: string;
  tabName: string;
  range: string;
};

export async function consultarPlanilha(
  input: SheetConsultaInput
): Promise<SheetRow[]> {
  // TODO: implementar leitura do Google Sheets
  // Usar Google Sheets API v4
  // Autenticação via Service Account ou OAuth2
  // Spreadsheet ID, tab e range vêm das variáveis de ambiente:
  //   GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_TAB_NAME, GOOGLE_SHEETS_RANGE
  throw new Error("TODO: consultarPlanilha não implementado");
}
