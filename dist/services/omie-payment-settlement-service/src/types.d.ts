export type OmieWebhookPayload = {
    messageId: string;
    topic: string;
    event: OmieWebhookEvent[];
    author?: Record<string, unknown>;
    appKey?: string;
    origin?: string;
};
export type OmieWebhookEvent = {
    codigo_baixa: number;
    codigo_cliente_fornecedor: number;
    codigo_conta_corrente: number;
    conta_a_pagar: OmieContaAPagar[];
    data: string;
    data_cred: string;
    valor: number;
};
export type OmieContaAPagar = {
    codigo_lancamento_omie: number;
    codigo_lancamento_integracao: string;
    data_emissao: string;
    data_vencimento: string;
    numero_documento: string;
    valor_documento: number;
};
export type PagamentoExtraido = {
    omie_id: string;
    numero_documento: string;
    valor: number;
    data_pagamento: string;
};
export type ReprocessSettlementInput = {
    status?: string;
    desde?: string;
    limite?: number;
};
export type SettlementStatusResult = {
    total: number;
    pago_omie: number;
    baixado_mxm: number;
    erro_baixa_mxm: number;
};
