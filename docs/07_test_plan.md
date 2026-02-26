# Test Plan (MVP v1.1, TDD Minimal Runnable)

## Test Method
- API: Vitest + Supertest
- Worker: Vitest (pure logic with mocked providers)
- Web smoke: Playwright
- Execution strategy: fail-first per step, then minimal implementation until green

## TDD Steps and Cases

### Step 1 - Health / Harness
- Case: `GET /health` returns `200` with `{status:"ok"}`
- Command: `pnpm test:tdd:step1`

### Step 2 - `POST /v1/jobs` Contract
- Case: text job success -> `201`, `jobId`, `status=queued`
- Case: image job without `imageUrl` -> `400`
- Case: text job with `imageUrl` -> `400`
- Case: multiview job with front/left/right success -> `201`
- Case: multiview job without `viewImages` -> `400`
- Case: text job with `viewImages` -> `400`
- Case: prompt length > 2000 -> `400`
- Command: `pnpm test:tdd:step2`

### Step 3 - `GET /v1/jobs/{jobId}` Status Mapping
- Case: queue `waiting|delayed` -> `queued`
- Case: queue `active` -> `running`
- Case: queue `completed` -> `succeeded` with `assetId`
- Case: queue `failed` -> `failed` with `error`
- Case: missing job -> `404`
- Command: `pnpm test:tdd:step3`

### Step 4 - Asset Endpoints
- Case: `GET /v1/assets/{assetId}` -> `200`, `downloadUrl`, `format=glb`
- Case: missing asset -> `404`
- Case: `GET /v1/assets/{assetId}/preview` -> redirect with signed URL
- Command: `pnpm test:tdd:step4`

### Step 5 - Worker Core
- Case: explicit configured provider is selected
- Case: unavailable requested provider falls back to first configured one
- Case: image job without `imageUrl` fails fast
- Case: multiview job without front/left/right fails fast
- Case: multiview job routes to provider `generateFromMultiView`
- Case: no provider configured -> mock placeholder path is used
- Case: provider errors propagate and fail job
- Command: `pnpm test:tdd:step5`

### Step 6 - Web Smoke
- Case: submit prompt, poll status, show success and download link
- Command: `pnpm test:tdd:step6`

## Regression Commands
- API only: `pnpm test:api`
- Worker only: `pnpm test:worker`
- Web smoke only: `pnpm test:web:smoke`
- Full local regression: `pnpm test && pnpm test:web:smoke`

## MVP Pass Criteria
1. API contract tests all pass
2. Worker core tests all pass
3. Web smoke test passes once locally
4. No real provider credentials required for automated tests
