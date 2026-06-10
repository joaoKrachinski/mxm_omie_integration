export type SyncOmieResult = {
    processados: number;
    criados: number;
    ignorados: number;
    erros: number;
};
export type ReprocessInput = {
    status?: string;
    desde?: string;
    limite?: number;
};
export type StatusResult = {
    total: number;
    por_status: Record<string, number>;
};
