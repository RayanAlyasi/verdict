# syntax=docker/dockerfile:1
# The web app: Next.js's standalone server on Node 26, run as the non-root node user. Build it from
# the repository root, where the workspace and its lockfile live:
#   docker build -f apps/web/Dockerfile --build-arg APP_COMMIT=$(git rev-parse HEAD) .

ARG NODE_IMAGE=node:26.12.1-trixie-slim@sha256:36793bcbb160a6a16cede1e62b93f84e26b78a972a8a4c0b879c1c12f22761ec

FROM ${NODE_IMAGE} AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
# The pnpm version from packageManager, so the image and developers can't drift apart.
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
  && pnpm install --frozen-lockfile --filter @verdict/web
COPY apps/web apps/web
RUN pnpm --dir apps/web build

FROM ${NODE_IMAGE}
# Current root certificates, which NODE_USE_SYSTEM_CA adds to Node's bundled ones.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ARG APP_COMMIT
LABEL org.opencontainers.image.licenses="AGPL-3.0-only" \
  org.opencontainers.image.source="https://github.com/RayanAlyasi/verdict" \
  org.opencontainers.image.revision="${APP_COMMIT}"
# APP_COMMIT is baked in: production runs the image built for staging, so it can't be set later.
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  NODE_USE_SYSTEM_CA=1 \
  HOSTNAME=0.0.0.0 \
  PORT=3000 \
  APP_COMMIT=${APP_COMMIT}
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
# The server's own cache is the one place it writes.
RUN mkdir -p apps/web/.next/cache && chown node:node apps/web/.next/cache
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
