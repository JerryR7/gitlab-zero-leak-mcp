FROM node:22.12-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY src ./src

RUN sed -i '/"prepare":/d' package.json && \
    npm ci && \
    npm run build

FROM node:22.12-alpine AS release

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

RUN npm ci --omit=dev && \
    npm cache clean --force && \
    chown -R node:node /app

USER node

ENTRYPOINT ["node", "dist/index.js"]