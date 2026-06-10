import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(uri: string, dbName: string): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export function getDb(): Db {
  if (!db) throw new Error("MongoDB não conectado. Chame connectMongo primeiro.");
  return db;
}

export async function setupIndexes(database: Db, collection: string): Promise<void> {
  const col = database.collection(collection);
  await col.createIndex({ numero_documento: 1, cnpj_cpf: 1, valor: 1 }, { unique: true });
  await col.createIndex({ omie_id: 1 });
  await col.createIndex({ jira_id: 1 });
  await col.createIndex({ status: 1 });
  await col.createIndex({ vencimento: 1 });
}
