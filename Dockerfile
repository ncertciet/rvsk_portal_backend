# ================================
# Build stage
# ================================
FROM node:22.21.1 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build
RUN npm run build:6a
RUN npm run build:schemes


# ================================
# Portal runtime
# ================================
FROM node:22.21.1-slim AS portal

WORKDIR /app

ENV NODE_ENV=development

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 8091

CMD ["node", "dist/apps/portal/apps/portal/src/main.js"]


# ================================
# RVSK 6A runtime
# ================================
FROM node:22.21.1-slim AS rvsk6a

WORKDIR /app

ENV NODE_ENV=development

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 8083

CMD ["node", "dist/apps/rvsk6a/apps/rvsk6a/src/main.js"]


# ================================
# Schemes runtime
# ================================
FROM node:22.21.1-slim AS schemes

WORKDIR /app

ENV NODE_ENV=development

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 8082

CMD ["node", "dist/apps/schemes/apps/schemes/src/main.js"]
