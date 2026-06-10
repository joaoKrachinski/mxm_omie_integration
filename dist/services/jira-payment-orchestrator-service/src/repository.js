"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findByIdempotencyKey = findByIdempotencyKey;
exports.findByJiraId = findByJiraId;
exports.updateJiraInfo = updateJiraInfo;
exports.updateStatus = updateStatus;
exports.findStuckByStatus = findStuckByStatus;
const COLLECTION = process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS ?? "payment_integrations";
async function findByIdempotencyKey(db, numeroDocumento, cnpjCpf, valor) {
    return db.collection(COLLECTION).findOne({
        numero_documento: numeroDocumento,
        cnpj_cpf: cnpjCpf,
        valor,
    });
}
async function findByJiraId(db, jiraId) {
    return db.collection(COLLECTION).findOne({ jira_id: jiraId });
}
async function updateJiraInfo(db, numeroDocumento, cnpjCpf, valor, jiraId, extra) {
    await db.collection(COLLECTION).updateOne({ numero_documento: numeroDocumento, cnpj_cpf: cnpjCpf, valor }, { $set: { jira_id: jiraId, status: "criado_jira", ...extra } });
}
async function updateStatus(db, jiraId, status, extra) {
    await db.collection(COLLECTION).updateOne({ jira_id: jiraId }, { $set: { status, ...extra } });
}
async function findStuckByStatus(db, status, desde, limite = 100) {
    const filter = { status };
    if (desde)
        filter.data_criacao = { $lte: desde };
    return db
        .collection(COLLECTION)
        .find(filter)
        .limit(limite)
        .toArray();
}
//# sourceMappingURL=repository.js.map