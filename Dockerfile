# Kickstand: one container, Node adapter in standalone mode.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# Public URL, needed at build time so Astro trusts the Host header for its CSRF origin check.
ARG SITE_URL=http://localhost:4321
ENV SITE_URL=$SITE_URL
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ARG SITE_URL=http://localhost:4321
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    DATABASE_URL=file:/data/db/kickstand.db \
    UPLOAD_DIR=/data/uploads \
    SITE_URL=$SITE_URL \
    ASTRO_TELEMETRY_DISABLED=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Migrations and the plain-JS runner (no drizzle-kit or tsx needed at runtime).
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
RUN mkdir -p /data/db /data/uploads && chown -R node:node /data
USER node
EXPOSE 4321
# Apply pending migrations on start, then serve.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node dist/server/entry.mjs"]
