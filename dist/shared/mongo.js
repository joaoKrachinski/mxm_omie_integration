"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongo = connectMongo;
exports.disconnectMongo = disconnectMongo;
exports.getDb = getDb;
exports.setupIndexes = setupIndexes;
const mongodb_1 = require("mongodb");
let client = null;
let db = null;
async function connectMongo(uri, dbName) {
    if (db)
        return db;
    client = new mongodb_1.MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    return db;
}
async function disconnectMongo() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}
function getDb() {
    if (!db)
        throw new Error("MongoDB não conectado. Chame connectMongo primeiro.");
    return db;
}
async function setupIndexes(database, collection) {
    const col = database.collection(collection);
    await col.createIndex({ numero_documento: 1, cnpj_cpf: 1, valor: 1 }, { unique: true });
    await col.createIndex({ omie_id: 1 });
    await col.createIndex({ jira_id: 1 });
    await col.createIndex({ status: 1 });
    await col.createIndex({ vencimento: 1 });
}
//# sourceMappingURL=mongo.js.map