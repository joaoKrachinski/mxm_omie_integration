FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY shared/ ./shared/
COPY adapters/ ./adapters/
COPY services/mxm-omie-sync-service/ ./services/mxm-omie-sync-service/

RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/services/mxm-omie-sync-service/src/server.js"]
