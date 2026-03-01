FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# ---- builder ----
FROM base AS builder
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.json ./

RUN pnpm --filter @ai-3d-platform/web build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# API_URL is server-side: Next.js rewrites proxy /v1/* and /storage/* to this host.
# Uses Docker internal network name "api" so the Next.js server can reach the API.
ENV API_URL=http://api:3001

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
