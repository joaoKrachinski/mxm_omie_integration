FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY shared/ ./shared/
COPY adapters/ ./adapters/
COPY services/omie-payment-settlement-service/ ./services/omie-payment-settlement-service/

RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

EXPOSE 3003

ENV PORT=3003

CMD ["node", "dist/services/omie-payment-settlement-service/src/server.js"]
