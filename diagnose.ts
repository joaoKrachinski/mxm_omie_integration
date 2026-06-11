import "dotenv/config";
import { connectDatabase, disconnectDatabase, insertDocument, findDocument } from "./database";

async function diagnose() {
  const uri      = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DATABASE;
  const colName  = process.env.MONGODB_COLLECTION_PAYMENT_INTEGRATIONS ?? "payment_integrations";

  console.log("\n=== DIAGNÓSTICO MONGODB ===\n");

  console.log("1. Variáveis de ambiente:");
  console.log("   MONGODB_URI      :", uri ? uri.replace(/:\/\/[^@]+@/, "://<credentials>@") : "❌ NÃO DEFINIDA");
  console.log("   MONGODB_DATABASE :", database ?? "❌ NÃO DEFINIDA");
  console.log("   COLLECTION       :", colName);

  if (!uri || !database) {
    console.log("\n❌ Corrija as variáveis de ambiente no .env e tente novamente.\n");
    process.exit(1);
  }

  console.log("\n2. Tentando conectar ao MongoDB Atlas...");
  try {
    await connectDatabase(uri, database);
    console.log("   ✅ Conexão e ping OK");
  } catch (err) {
    console.log("   ❌ Falha na conexão:", String(err));
    console.log("\n   Verifique:");
    console.log("   - Se a senha no MONGODB_URI está correta");
    console.log("   - Se o IP da sua máquina está liberado no Atlas (Network Access)");
    console.log("   - Se o cluster está ativo\n");
    process.exit(1);
  }

  console.log("\n3. Tentando inserir documento de teste...");
  try {
    await insertDocument({
      mxm_id:           "DIAG-TEST-001",
      numero_documento: "DIAG-TEST-001",
      cnpj_cpf:         "00000000000000",
      valor:            100,
      data_criacao:     new Date().toISOString().slice(0, 10),
      status:           "criado_omie",
    });
    console.log("   ✅ Documento inserido com sucesso");
  } catch (err) {
    const msg = String(err);
    if (msg.includes("E11000")) {
      console.log("   ✅ Documento já existia (índice único funcionando corretamente)");
    } else {
      console.log("   ❌ Falha no insert:", msg);
      await disconnectDatabase();
      process.exit(1);
    }
  }

  console.log("\n4. Lendo documento inserido...");
  const found = await findDocument("DIAG-TEST-001", "00000000000000", 100);
  if (found) {
    console.log("   ✅ Documento encontrado:", JSON.stringify(found, null, 2).replace(/^/gm, "   "));
  } else {
    console.log("   ❌ Documento não encontrado após inserção");
  }

  await disconnectDatabase();
  console.log("\n=== DIAGNÓSTICO CONCLUÍDO ===\n");
}

diagnose().catch((err) => {
  console.error("Erro inesperado:", err);
  process.exit(1);
});
