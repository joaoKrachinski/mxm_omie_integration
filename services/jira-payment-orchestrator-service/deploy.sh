#!/bin/bash
set -e

SERVICE_NAME="jira-payment-orchestrator-service"
PROJECT_ID="${GCP_PROJECT_ID:-ftd-data-lake}"
REGION="${GCP_REGION:-us-east1}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "==> Building via Cloud Build: ${IMAGE}"
gcloud builds submit --config=services/jira-payment-orchestrator-service/cloudbuild.yaml \
  --project="${PROJECT_ID}" \
  .

if [ "${SKIP_ENV:-false}" != "true" ]; then
  echo "==> Removendo secret SLACK_DEVELOPMENT_CHANNEL (será env var)"
  gcloud run services update "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --remove-secrets="SLACK_DEVELOPMENT_CHANNEL" 2>/dev/null || true
fi

echo "==> Deploying to Cloud Run${SKIP_ENV:+ (apenas imagem, sem alterar env/secrets)}"
if [ "${SKIP_ENV:-false}" = "true" ]; then
  gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --platform=managed \
    --allow-unauthenticated \
    --timeout="300s"
else
  gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --platform=managed \
    --allow-unauthenticated \
    --timeout="300s" \
    --set-env-vars="NODE_ENV=production,LOG_LEVEL=info,MONGODB_DATABASE=testes-mxm-omie,MONGODB_COLLECTION_PAYMENT_INTEGRATIONS=testes-mxm-omie,OMIE_BASE_URL=https://app.omie.com.br,OMIE_ID_CONTA_CORRENTE=6917718230,JIRA_BASE_URL=https://insiderstore.atlassian.net,JIRA_EMAIL=payments-automacao-jira@insiderstore.com.br,GOOGLE_SHEETS_SPREADSHEET_ID=1pcwoO-CXu5HPL-_19my3Vh2oy5BIOrZTr8yGTO_z6Zs,GOOGLE_SHEETS_TAB_NAME=aprovadores,GOOGLE_SHEETS_RANGE=A:Z,SLACK_DEVELOPMENT_CHANNEL=C0B97USHTE3,SLACK_ALERT_CHANNEL=C0B9T2KFVM2,JIRA_STATUS_VERIFICANDO_CADASTRO=Verificando Cadastro De Fornecedor,JIRA_STATUS_APROVADOR_GESTOR=Aprovação Gestor,JIRA_STATUS_ALCADA1=Aprovador Gestor + Alçada 1,JIRA_STATUS_ALCADA2=Aprovador Gestor + Alçada 2,JIRA_STATUS_ANALISE_FISCAL=Análise Fiscal,JIRA_STATUS_AGUARDANDO_AGENDAMENTO=Aguardando Agendamento MXM,JIRA_STATUS_AGUARDANDO_PAGAMENTO=Aguardando Pagamento,JIRA_STATUS_AGENDAMENTO_MANUAL=Agendamento Manual,JIRA_STATUS_PAGO=Pago,GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION}" \
    --set-secrets="MONGODB_URI=MONGODB_URI:latest,OMIE_APP_KEY=OMIE_APP_KEY:latest,OMIE_APP_SECRET=OMIE_APP_SECRET:latest,JIRA_API_TOKEN=JIRA_API_TOKEN:latest,SLACK_BOT_TOKEN=SLACK_BOT_TOKEN:latest,GOOGLE_SERVICE_ACCOUNT_JSON=GOOGLE_SERVICE_ACCOUNT_JSON:latest"
fi

echo "==> Configurando Cloud Scheduler (reprocess a cada hora)"
SERVICE_URL="https://${SERVICE_NAME}-553046829256.us-east1.run.app"
SCHEDULER_JOB="jira-reprocess-hourly"

if gcloud scheduler jobs describe "${SCHEDULER_JOB}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud scheduler jobs update http "${SCHEDULER_JOB}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --schedule="0 * * * *" \
    --time-zone="America/Sao_Paulo" \
    --uri="${SERVICE_URL}/jira/reprocess" \
    --http-method=POST \
    --update-headers="Content-Type=application/json" \
    --message-body="{}" \
    --attempt-deadline="540s"
else
  gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --schedule="0 * * * *" \
    --time-zone="America/Sao_Paulo" \
    --uri="${SERVICE_URL}/jira/reprocess" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body="{}" \
    --attempt-deadline="540s"
fi

echo "==> Deploy de ${SERVICE_NAME} concluído"
echo "==> Scheduler '${SCHEDULER_JOB}' configurado para executar todo hora (America/Sao_Paulo)"
