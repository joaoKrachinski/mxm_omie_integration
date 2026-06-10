#!/bin/bash
set -e

SERVICE_NAME="mxm-omie-sync-service"
PROJECT_ID="${GCP_PROJECT_ID:-ftd-data-lake}"
REGION="${GCP_REGION:-us-east1}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "==> Building Docker image: ${IMAGE}"
docker build -f services/mxm-omie-sync-service/Dockerfile -t "${IMAGE}" .

echo "==> Pushing image to GCR"
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run"
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --timeout="${SERVICE_TIMEOUT_SECONDS:-30}s" \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info" \
  --set-secrets="MONGODB_URI=MONGODB_URI:latest,MXM_AUTH_TOKEN=MXM_AUTH_TOKEN:latest,OMIE_APP_KEY=OMIE_APP_KEY:latest,OMIE_APP_SECRET=OMIE_APP_SECRET:latest,SLACK_BOT_TOKEN=SLACK_BOT_TOKEN:latest"

echo "==> Deploy de ${SERVICE_NAME} concluído"
