export type MxmTituloPagar = {
    numero_documento: string;
    cnpj_cpf: string;
    valor: number;
    data_emissao: string;
    vencimento: string;
    mxm_id: string;
};
export type MxmBaixaInput = {
    mxm_id: string;
    numero_documento: string;
    valor: number;
    data_pagamento: string;
};
export type MxmConsultaInput = {
    numero_documento: string;
    cnpj_cpf: string;
};
export declare function listarTituloPagar(windowHours: number): Promise<MxmTituloPagar[]>;
export declare function consultarTituloMxm(input: MxmConsultaInput): Promise<MxmTituloPagar | null>;
export declare function baixarTituloMxm(input: MxmBaixaInput): Promise<void>;
