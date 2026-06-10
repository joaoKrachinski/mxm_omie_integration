"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarTituloPagar = listarTituloPagar;
exports.consultarTituloMxm = consultarTituloMxm;
exports.baixarTituloMxm = baixarTituloMxm;
async function listarTituloPagar(windowHours) {
    // TODO: implementar chamada real ao MXM
    // POST {MXM_BASE_URL}/webmanager/api/InterfacedoContasPagarReceber/ConsultarAlteracaoTituloPagar
    // Autenticação via MXM_AUTH_TOKEN
    // Filtrar títulos alterados nas últimas {windowHours} horas
    throw new Error("TODO: listarTituloPagar não implementado");
}
async function consultarTituloMxm(input) {
    // TODO: implementar consulta de título específico no MXM
    throw new Error("TODO: consultarTituloMxm não implementado");
}
async function baixarTituloMxm(input) {
    // TODO: implementar chamada real de baixa no MXM
    // POST {MXM_BASE_URL}/webmanager/api/InterfacedoContasPagarReceber/Gravar
    // Autenticação via MXM_AUTH_TOKEN
    throw new Error("TODO: baixarTituloMxm não implementado");
}
//# sourceMappingURL=mxm.js.map