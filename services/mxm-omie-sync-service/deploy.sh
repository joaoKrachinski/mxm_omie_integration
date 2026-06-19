#!/bin/bash
set -e

SERVICE_NAME="mxm-omie-sync-service"
PROJECT_ID="${GCP_PROJECT_ID:-ftd-data-lake}"
REGION="${GCP_REGION:-us-east1}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "==> Building via Cloud Build: ${IMAGE}"
gcloud builds submit --config=services/mxm-omie-sync-service/cloudbuild.yaml \
  --project="${PROJECT_ID}" \
  .

echo "==> Removendo secret SLACK_DEVELOPMENT_CHANNEL (será env var)"
gcloud run services update "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --remove-secrets="SLACK_DEVELOPMENT_CHANNEL" 2>/dev/null || true

echo "==> Deploying to Cloud Run"
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --timeout="300s" \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info,MONGODB_DATABASE=testes-mxm-omie,MONGODB_COLLECTION_PAYMENT_INTEGRATIONS=testes-mxm-omie,MXM_BASE_URL=https://insider.mxmcloud.com.br,OMIE_BASE_URL=https://app.omie.com.br,SYNC_WINDOW_HOURS=26,SLACK_DEVELOPMENT_CHANNEL=C0B97USHTE3,SLACK_ALERT_CHANNEL=C0B9T2KFVM2,GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION}" \
  --set-secrets="MONGODB_URI=MONGODB_URI:latest,MXM_USERNAME=MXM_USERNAME:latest,MXM_PASSWORD=MXM_PASSWORD:latest,MXM_ENVIRONMENT=MXM_ENVIRONMENT:latest,OMIE_APP_KEY=OMIE_APP_KEY:latest,OMIE_APP_SECRET=OMIE_APP_SECRET:latest,SLACK_BOT_TOKEN=SLACK_BOT_TOKEN:latest"

echo "==> Configurando Cloud Scheduler (diário às 22h BRT)"
SERVICE_URL="https://${SERVICE_NAME}-553046829256.us-east1.run.app"
SCHEDULER_JOB="mxm-omie-sync-daily"

# Cria ou atualiza o job (update ignora erro se não existir, create ignora se já existir)
if gcloud scheduler jobs describe "${SCHEDULER_JOB}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud scheduler jobs update http "${SCHEDULER_JOB}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --schedule="0 22 * * *" \
    --time-zone="America/Sao_Paulo" \
    --uri="${SERVICE_URL}/syncOmie" \
    --http-method=POST \
    --update-headers="Content-Type=application/json" \
    --message-body="{}" \
    --attempt-deadline="540s"
else
  gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --schedule="0 22 * * *" \
    --time-zone="America/Sao_Paulo" \
    --uri="${SERVICE_URL}/syncOmie" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body="{}" \
    --attempt-deadline="540s"
fi

echo "==> Deploy de ${SERVICE_NAME} concluído"
echo "==> Scheduler '${SCHEDULER_JOB}' configurado para todo dia às 22h (America/Sao_Paulo)"
