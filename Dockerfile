FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig*.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts/build-server.mjs ./scripts/build-server.mjs
ENV VITE_SICA_MODE=server
RUN npm run build && npm run build:server

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production SICA_HOST=0.0.0.0 SICA_SECURE_COOKIE=true
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/.server ./.server
COPY server ./server
COPY scripts/postgres-data.mjs scripts/supabase-prepare.mjs scripts/healthcheck.mjs ./scripts/
RUN mkdir -p /app/var/postgres && chown -R node:node /app/var && chmod 700 /app/var /app/var/postgres
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 CMD ["node", "scripts/healthcheck.mjs"]
CMD ["node", "server/start.mjs"]
