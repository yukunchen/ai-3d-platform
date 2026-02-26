# AI 3D Platform

Text/Image to 3D model generation platform (GLB-first) with a web UI, API, and worker pipeline.

## Monorepo Structure
- `apps/web`: Next.js frontend (submit jobs, poll status, preview/download)
- `apps/api`: Express API (job creation/status/assets)
- `apps/worker`: BullMQ worker (provider calls + asset generation)
- `packages/shared`: shared types/enums/storage helpers
- `docs`: PRD, architecture, API contract, test plan

## Prerequisites
- Node.js `>= 18`
- pnpm `8.x`
- Redis `>= 6`

## Install
```bash
pnpm install
```

## Run Locally
```bash
pnpm dev
```

This starts the workspace apps via Turborepo.  
If needed, run services individually:
```bash
pnpm -C apps/api dev
pnpm -C apps/worker dev
pnpm -C apps/web dev
```

## Test Commands
- API + Worker:
```bash
pnpm test
```

- Web smoke:
```bash
pnpm test:web:smoke
```

- Full local suite:
```bash
pnpm test:all
```

- TDD gates:
```bash
pnpm test:tdd:step1
pnpm test:tdd:step2
pnpm test:tdd:step3
pnpm test:tdd:step4
pnpm test:tdd:step5
pnpm test:tdd:step6
```

## CI
- Workflow: `.github/workflows/test.yml`
- Jobs:
  - `api-worker-tests` (runs `pnpm test`)
  - `web-smoke` (installs Playwright Chromium, runs `pnpm test:web:smoke`)

## Key Docs
- `docs/01_prd.md`
- `docs/02_architecture.md`
- `docs/03_api_contract.md`
- `docs/07_test_plan.md`
- `docs/09_local_testing_ci.md`
