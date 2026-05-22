# Multi-stage build pro PABX backend
FROM node:20-alpine AS deps
WORKDIR /app
# OpenSSL pro Prisma engine
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat tini
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DATABASE_URL="file:./data/dev.db"
ENV SESSIONS_DIR="./data/.sessions"

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Diretorios persistentes
RUN mkdir -p /app/data /app/.uploads && \
    chown -R node:node /app

USER node
EXPOSE 3001
ENTRYPOINT ["/sbin/tini","--"]
CMD ["sh","-c","npx prisma migrate deploy && node dist/server.js"]
