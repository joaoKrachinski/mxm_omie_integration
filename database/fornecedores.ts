import mongoose, { Schema } from "mongoose";
import { createLogger } from "@shared/logger";

const logger = createLogger("database", "fornecedores");

export type Fornecedor = {
  cnpj_cpf: string;
  codigo_cliente_omie: string;
};

const fornecedorSchema = new Schema<Fornecedor>(
  {
    cnpj_cpf: { type: String, required: true, unique: true },
    codigo_cliente_omie: { type: String, required: true },
  },
  {
    versionKey: false,
    collection: process.env.MONGODB_COLLECTION_FORNECEDORES ?? "fornecedores",
  }
);

function getFornecedorModel() {
  return (
    (mongoose.models["Fornecedor"] as mongoose.Model<Fornecedor>) ??
    mongoose.model<Fornecedor>("Fornecedor", fornecedorSchema)
  );
}

export async function findFornecedor(cnpjCpf: string): Promise<Fornecedor | null> {
  const Model = getFornecedorModel();
  logger.info("Buscando fornecedor no MongoDB", { cnpj_cpf: cnpjCpf });
  const result = await Model.findOne({ cnpj_cpf: cnpjCpf }).lean();
  if (result) {
    logger.info("Fornecedor encontrado no cache MongoDB", {
      cnpj_cpf: cnpjCpf,
      codigo_cliente_omie: result.codigo_cliente_omie,
    });
  } else {
    logger.info("Fornecedor não encontrado no cache MongoDB", { cnpj_cpf: cnpjCpf });
  }
  return result as Fornecedor | null;
}

export async function upsertFornecedor(cnpjCpf: string, codigoClienteOmie: string): Promise<void> {
  const Model = getFornecedorModel();
  await Model.updateOne(
    { cnpj_cpf: cnpjCpf },
    { $set: { cnpj_cpf: cnpjCpf, codigo_cliente_omie: codigoClienteOmie } },
    { upsert: true }
  );
  logger.info("Fornecedor salvo no cache MongoDB", {
    cnpj_cpf: cnpjCpf,
    codigo_cliente_omie: codigoClienteOmie,
  });
}
