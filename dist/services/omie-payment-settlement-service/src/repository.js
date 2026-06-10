"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findByOmieId = findByOmieId;
exports.updateStatus = updateStatus;
exports.countByStatus = countByStatus;
exports.findPendingSettlement = findPendingSettlement;
exports.countAll = countAll;
const COLLECTION = process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS ?? "payment_integrations";
async function findByOmieId(db, omieId) {
    return db.collection(COLLECTION).findOne({ omie_id: omieId });
}
async function updateStatus(db, omieId, status, extra) {
    await db.collection(COLLECTION).updateOne({ omie_id: omieId }, { $set: { status, ...extra } });
}
async function countByStatus(db) {
    const pipeline = [
        {
            $match: {
                status: { $in: ["pago_omie", "baixado_mxm", "erro_baixa_mxm"] },
            },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
    ];
    const result = await db.collection(COLLECTION).aggregate(pipeline).toArray();
    return result.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
    }, {});
}
async function findPendingSettlement(db, status, desde, limite = 100) {
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
async function countAll(db) {
    return db.collection(COLLECTION).countDocuments();
}
//# sourceMappingURL=repository.js.map