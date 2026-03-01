FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# ---- builder ----
FROM base AS builder
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
COPY tsconfig.json ./

RUN pnpm --filter @ai-3d-platform/shared build
RUN pnpm --filter @ai-3d-platform/worker build

# ---- runtime ----
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
RUN node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('packages/shared/package.json','utf8'));p.main='./dist/index.js';p.exports={'.':'./dist/index.js'};fs.writeFileSync('packages/shared/package.json',JSON.stringify(p,null,2))"

ENV NODE_ENV=production

CMD ["node", "apps/worker/dist/index.js"]
