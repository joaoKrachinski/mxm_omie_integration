FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY shared/ ./shared/
COPY adapters/ ./adapters/
COPY database/ ./database/
COPY services/jira-payment-orchestrator-service/ ./services/jira-payment-orchestrator-service/

RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

EXPOSE 3002

ENV PORT=3002

CMD ["node", "dist/services/jira-payment-orchestrator-service/src/server.js"]
