export type OmieContaPagarInput = {
    numero_documento: string;
    cnpj_cpf: string;
    valor: number;
    data_emissao: string;
    vencimento: string;
    codigo_lancamento_integracao?: string;
};
export type OmieContaPagarResponse = {
    omie_id: string;
    codigo_lancamento_omie: number;
};
export type OmieConsultaInput = {
    numero_documento: string;
    cnpj_cpf: string;
};
export type OmieAlteracaoInput = {
    omie_id: string;
    campos: Record<string, unknown>;
};
export declare function criarContaPagarOmie(input: OmieContaPagarInput): Promise<OmieContaPagarResponse>;
export declare function consultarContaPagarOmie(input: OmieConsultaInput): Promise<OmieContaPagarResponse | null>;
export declare function alterarContaPagarOmie(input: OmieAlteracaoInput): Promise<void>;
export declare function listarContasPagarOmie(filtros?: Record<string, unknown>): Promise<OmieContaPagarResponse[]>;
