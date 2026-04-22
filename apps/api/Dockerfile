# Motogram API - Production Dockerfile (Spec 8.11)
# Basit 2-stage: build (tum deps + prisma generate + nest build) -> runtime (kopyali).
# DevDeps runtime'a dahil kalir (image ~200MB daha buyuk) ancak prisma generate
# ciktisi + workspace:* resolution guvenli sekilde calisir.

# ===== Stage 1: Build =====
FROM node:20-bullseye-slim AS build
WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# Manifest + lockfile cache layer
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config-tsconfig/package.json ./packages/config-tsconfig/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# Source + build
COPY packages/config-tsconfig ./packages/config-tsconfig
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @motogram/shared build
RUN pnpm --filter @motogram/api exec prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter @motogram/api build
# `pnpm --filter @motogram/api build` nest build + build:seed (tsc -p tsconfig.seed.json)
# calistirir; cikti: apps/api/dist (runtime) + apps/api/dist-seed (prisma seed JS).

# ===== Stage 2: Runtime =====
FROM node:20-bullseye-slim AS runtime
WORKDIR /workspace

ENV NODE_ENV=production \
    PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates dumb-init \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r motogram && useradd -r -g motogram motogram

# corepack/pnpm cache icin yazilabilir HOME gerekli (non-root)
ENV HOME=/home/motogram
RUN mkdir -p /home/motogram/.cache/node/corepack \
  && chown -R motogram:motogram /home/motogram

# Runtime container icinde pnpm komutlarini (db:seed, prisma ops) calistirabilmek icin
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# Workspace layout korunarak kopyala (pnpm symlink + workspace:* resolution icin).
COPY --from=build --chown=motogram:motogram /workspace/package.json ./package.json
COPY --from=build --chown=motogram:motogram /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build --chown=motogram:motogram /workspace/node_modules ./node_modules
COPY --from=build --chown=motogram:motogram /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=motogram:motogram /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=motogram:motogram /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build --chown=motogram:motogram /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=motogram:motogram /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=motogram:motogram /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=motogram:motogram /workspace/apps/api/dist-seed ./apps/api/dist-seed
COPY --from=build --chown=motogram:motogram /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=motogram:motogram /workspace/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=build --chown=motogram:motogram /workspace/apps/api/tsconfig.seed.json ./apps/api/tsconfig.seed.json

USER motogram
WORKDIR /workspace/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT||3000) + '/v1/readyz', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
