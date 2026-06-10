"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOmie = syncOmie;
exports.reprocessOmie = reprocessOmie;
exports.getSyncStatus = getSyncStatus;
const repository_1 = require("./repository");
const utils_1 = require("@shared/utils");
const logger_1 = require("@shared/logger");
const logger = (0, logger_1.createLogger)("mxm-omie-sync-service");
async function syncOmie(db, config, correlationId) {
    const result = { processados: 0, criados: 0, ignorados: 0, erros: 0 };
    // TODO: substituir por chamada real ao MXM
    // const titulos = await listarTituloPagar(config.mxm.syncWindowHours);
    const titulos = [];
    for (const titulo of titulos) {
        result.processados++;
        const cnpjCpf = (0, utils_1.normalizeCpfCnpj)(titulo.cnpj_cpf);
        try {
            const existente = await (0, repository_1.findByIdempotencyKey)(db, titulo.numero_documento, cnpjCpf, titulo.valor);
            if (existente) {
                logger.info("Título já existe, ignorando", { correlation_id: correlationId, numero_documento: titulo.numero_documento });
                result.ignorados++;
                continue;
            }
            // TODO: descomentar consulta ao Omie quando adapter estiver implementado
            // const existeOmie = await consultarContaPagarOmie({ numero_documento: titulo.numero_documento, cnpj_cpf: cnpjCpf });
            // if (existeOmie) {
            //   await insertPaymentIntegration(db, { ...base, omie_id: existeOmie.omie_id, status: "criado_omie" });
            //   result.ignorados++;
            //   continue;
            // }
            // TODO: descomentar criação no Omie quando adapter estiver implementado
            // const omieResult = await criarContaPagarOmie({ ... });
            await (0, repository_1.insertPaymentIntegration)(db, {
                mxm_id: titulo.mxm_id,
                numero_documento: titulo.numero_documento,
                cnpj_cpf: cnpjCpf,
                valor: titulo.valor,
                data_criacao: (0, utils_1.toIsoDate)(new Date()),
                data_emissao: (0, utils_1.toIsoDate)(titulo.data_emissao),
                vencimento: (0, utils_1.toIsoDate)(titulo.vencimento),
                status: "criado_omie",
                // omie_id: omieResult.omie_id — TODO: adicionar quando adapter estiver implementado
            });
            logger.info("Título sincronizado com Omie", { correlation_id: correlationId, numero_documento: titulo.numero_documento });
            result.criados++;
        }
        catch (err) {
            result.erros++;
            logger.error("Erro ao processar título", {
                correlation_id: correlationId,
                numero_documento: titulo.numero_documento,
                error: String(err),
            });
            // TODO: descomentar alerta quando adapter Slack estiver implementado
            // await enviarAlertaSlack({ tipo_erro: "sync_omie_error", numero_documento: titulo.numero_documento, acao_esperada: "Verificar integração MXM/Omie", correlation_id: correlationId });
        }
    }
    logger.info("Sync Omie concluído", { correlation_id: correlationId, ...result });
    return result;
}
async function reprocessOmie(db, config, input, correlationId) {
    const result = { processados: 0, criados: 0, ignorados: 0, erros: 0 };
    const pendentes = await (0, repository_1.findPendingReprocess)(db, input.status, input.desde, input.limite);
    for (const registro of pendentes) {
        result.processados++;
        try {
            // TODO: implementar lógica de reprocessamento real
            // Verificar se já existe no Omie, criar se necessário, atualizar status
            logger.info("Reprocessando registro", { correlation_id: correlationId, mxm_id: registro.mxm_id });
            result.ignorados++;
        }
        catch (err) {
            result.erros++;
            logger.error("Erro no reprocessamento", { correlation_id: correlationId, mxm_id: registro.mxm_id, error: String(err) });
        }
    }
    return result;
}
async function getSyncStatus(db) {
    const porStatus = await (0, repository_1.countByStatus)(db);
    const total = Object.values(porStatus).reduce((acc, v) => acc + v, 0);
    return { total, por_status: porStatus };
}
//# sourceMappingURL=useCases.js.map