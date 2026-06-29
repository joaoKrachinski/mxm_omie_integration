#!/bin/bash
set -e

SERVICE_NAME="omie-payment-settlement-service"
PROJECT_ID="${GCP_PROJECT_ID:-ftd-data-lake}"
REGION="${GCP_REGION:-us-east1}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "==> Building via Cloud Build: ${IMAGE}"
gcloud builds submit --config=services/omie-payment-settlement-service/cloudbuild.yaml \
  --project="${PROJECT_ID}" \
  .

echo "==> Deploying to Cloud Run"
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --timeout="300s" \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info,MONGODB_DATABASE=testes-mxm-omie,MONGODB_COLLECTION_PAYMENT_INTEGRATIONS=testes-mxm-omie,OMIE_BASE_URL=https://app.omie.com.br,OMIE_ID_CONTA_CORRENTE=6917718230,MXM_BASE_URL=https://insider.mxmcloud.com.br,JIRA_BASE_URL=https://insiderstore.atlassian.net,JIRA_EMAIL=payments-automacao-jira@insiderstore.com.br,SLACK_DEVELOPMENT_CHANNEL=C0B97USHTE3,SLACK_ALERT_CHANNEL=C0B9T2KFVM2,GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION}" \
  --set-secrets="MONGODB_URI=MONGODB_URI:latest,OMIE_APP_KEY=OMIE_APP_KEY:latest,OMIE_APP_SECRET=OMIE_APP_SECRET:latest,OMIE_WEBHOOK_TOKEN=OMIE_WEBHOOK_TOKEN:latest,MXM_USERNAME=MXM_USERNAME:latest,MXM_PASSWORD=MXM_PASSWORD:latest,MXM_ENVIRONMENT=MXM_ENVIRONMENT:latest,JIRA_API_TOKEN=JIRA_API_TOKEN:latest,SLACK_BOT_TOKEN=SLACK_BOT_TOKEN:latest"

echo "==> Deploy de ${SERVICE_NAME} concluído"
