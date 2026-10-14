# Imagen de la web (Next.js en modo standalone). Se construye desde la raíz
# del monorepo: docker build -f deploy/Dockerfile .
FROM node:24-bookworm-slim AS build
RUN npm install -g pnpm@12.11.2
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# Configuración del sitio público (deploy/.env). Se fija al compilar.
ARG ADSENSE_CLIENT=""
ARG ADSENSE_SLOT=""
ARG CONTACT_EMAIL=""
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1     ADSENSE_CLIENT=$ADSENSE_CLIENT ADSENSE_SLOT=$ADSENSE_SLOT CONTACT_EMAIL=$CONTACT_EMAIL
RUN pnpm --filter @pdf-editor/web build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
