# Motogram Web Admin - Production Dockerfile (Spec 5.4)
# Next.js 14 standalone output icin multi-stage.

FROM node:20-bullseye-slim AS deps
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config-tsconfig/package.json ./packages/config-tsconfig/
COPY apps/web-admin/package.json ./apps/web-admin/

RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /workspace
COPY packages/config-tsconfig ./packages/config-tsconfig
COPY packages/shared ./packages/shared
COPY apps/web-admin ./apps/web-admin

RUN pnpm --filter @motogram/shared build
RUN pnpm --filter @motogram/web-admin build

FROM node:20-bullseye-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3100 \
    HOSTNAME=0.0.0.0

RUN groupadd -r motogram && useradd -r -g motogram motogram

# Next.js standalone output
# NOT: public/ klasorunde en az .gitkeep olmali (repo'da tracked);
# aksi halde COPY basarisiz olur.
COPY --from=build --chown=motogram:motogram /workspace/apps/web-admin/.next/standalone ./
COPY --from=build --chown=motogram:motogram /workspace/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=build --chown=motogram:motogram /workspace/apps/web-admin/public ./apps/web-admin/public/

USER motogram
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3100/login', r => process.exit(r.statusCode<500?0:1)).on('error', () => process.exit(1))"

CMD ["node", "apps/web-admin/server.js"]
