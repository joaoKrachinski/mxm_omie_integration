import { BigQuery } from "@google-cloud/bigquery";
import { createLogger } from "@shared/logger";

const logger = createLogger("bigquery-adapter");

export type NotaQive = {
  document_status: string;
  nfe_total_value: number;
};

function getBigQueryClient(): BigQuery {
  const credentialsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsRaw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON é obrigatório para consultar o BigQuery");
  }

  let credentials: object;
  try {
    credentials = JSON.parse(credentialsRaw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON contém JSON inválido");
  }

  return new BigQuery({
    projectId: process.env.GCP_PROJECT_ID ?? "ftd-data-lake",
    credentials,
  });
}

export async function consultarNotaQive(
  cnpj: string,
  numeroNota: string
): Promise<NotaQive | null> {
  logger.info("Consultando nota no BigQuery (notas_qive)", { cnpj, numero_nota: numeroNota });

  const bigquery = getBigQueryClient();

  const query = `
    SELECT document_status, nfe_total_value
    FROM \`ftd-data-lake.fiscal.notas_qive\`
    WHERE issuer_cnpj = @issuer_cnpj
      AND document_number  = @document_number
    LIMIT 1
  `;

  const options = {
    query,
    params: {
      issuer_cnpj: String(cnpj),
      document_number: String(numeroNota),
    },
    types: {
      issuer_cnpj: "STRING",
      document_number: "STRING",
    },
  };

  try {
    const [rows] = await bigquery.query(options);

    if (!rows || rows.length === 0) {
      logger.info("Nota não encontrada no BigQuery", { cnpj, numero_nota: numeroNota });
      return null;
    }

    const row = rows[0] as { document_status: string; nfe_total_value: number };

    logger.info("Nota encontrada no BigQuery", {
      cnpj,
      numero_nota: numeroNota,
      document_status: row.document_status,
      nfe_total_value: row.nfe_total_value,
    });

    return {
      document_status: row.document_status,
      nfe_total_value: row.nfe_total_value,
    };
  } catch (error) {
    logger.error("Erro ao consultar BigQuery", {
      cnpj,
      numero_nota: numeroNota,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Erro ao consultar BigQuery: ${error instanceof Error ? error.message : String(error)}`);
  }
}
