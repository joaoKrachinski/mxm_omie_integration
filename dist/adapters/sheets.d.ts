export type SheetRow = Record<string, string>;
export type SheetConsultaInput = {
    spreadsheetId: string;
    tabName: string;
    range: string;
};
export declare function consultarPlanilha(input: SheetConsultaInput): Promise<SheetRow[]>;
