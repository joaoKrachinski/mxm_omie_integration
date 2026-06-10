"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findByIdempotencyKey = findByIdempotencyKey;
exports.insertPaymentIntegration = insertPaymentIntegration;
exports.updateStatus = updateStatus;
exports.countByStatus = countByStatus;
exports.findPendingReprocess = findPendingReprocess;
const COLLECTION = process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS ?? "payment_integrations";
async function findByIdempotencyKey(db, numeroDocumento, cnpjCpf, valor) {
    return db.collection(COLLECTION).findOne({
        numero_documento: numeroDocumento,
        cnpj_cpf: cnpjCpf,
        valor,
    });
}
async function insertPaymentIntegration(db, doc) {
    await db.collection(COLLECTION).insertOne(doc);
}
async function updateStatus(db, numeroDocumento, cnpjCpf, valor, status, extra) {
    await db.collection(COLLECTION).updateOne({ numero_documento: numeroDocumento, cnpj_cpf: cnpjCpf, valor }, { $set: { status, ...extra } });
}
async function countByStatus(db) {
    const pipeline = [
        { $group: { _id: "$status", count: { $sum: 1 } } },
    ];
    const result = await db.collection(COLLECTION).aggregate(pipeline).toArray();
    return result.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
    }, {});
}
async function findPendingReprocess(db, status, desde, limite = 100) {
    const filter = {};
    if (status)
        filter.status = status;
    if (desde)
        filter.data_criacao = { $gte: desde };
    return db
        .collection(COLLECTION)
        .find(filter)
        .limit(limite)
        .toArray();
}
//# sourceMappingURL=repository.js.map