import "dotenv/config";
import { connectDatabase, disconnectDatabase, listDocuments, countByStatus } from "./database";

async function main() {
  const uri      = process.env.MONGODB_URI!;
  const database = process.env.MONGODB_DATABASE!;
  const status   = process.argv[2];
  const limite   = Number(process.argv[3] ?? 50);

  console.log(`\n=== DOCUMENTOS NA COLEÇÃO (database: ${database}) ===`);
  if (status) console.log(`Filtro status: ${status}`);
  console.log(`Limite: ${limite}\n`);

  await connectDatabase(uri, database);

  const [docs, porStatus] = await Promise.all([
    listDocuments(status, undefined, limite),
    countByStatus(),
  ]);

  console.log("📊 Contagem por status:");
  if (Object.keys(porStatus).length === 0) {
    console.log("   (nenhum documento encontrado)\n");
  } else {
    for (const [s, count] of Object.entries(porStatus)) {
      console.log(`   ${s}: ${count}`);
    }
  }

  console.log(`\n📄 Últimos ${docs.length} documentos:\n`);
  if (docs.length === 0) {
    console.log("   Nenhum documento encontrado.");
    console.log("\n   Possíveis causas:");
    console.log("   1. O POST /syncOmie ainda não foi chamado");
    console.log("   2. O MXM não retornou títulos na janela de tempo configurada");
    console.log("   3. Verifique os logs do serviço ao chamar /syncOmie\n");
  } else {
    for (const doc of docs) {
      console.log(JSON.stringify(doc, null, 2));
      console.log("---");
    }
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
