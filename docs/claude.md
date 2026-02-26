# Claude Project Guide: Text/Image → 3D Model (GLB/FBX) Web + Unity/VR

## 1. Goal
Build an MVP web app that lets a user submit **text or an image** and receive a **downloadable 3D model**.
Primary output: **.glb** (PBR). Secondary (phase 2): **.fbx**, animation, skeleton/rig.
The system must support: create job → track status → preview → download.

Success = A complete runnable pipeline with quality gates:
- Web UI can submit and preview
- API can create jobs and report status
- Worker can call provider and produce valid GLB
- Assets are stored and downloadable via signed URLs

## 2. Non-goals (MVP)
- No full 3D editor (only basic view/rotate/zoom).
- No multi-provider auto-selection or prompt optimization.
- No VR runtime optimizations; only Unity sample loader.

## 3. Read these docs first (do not skip)
- 00_system_constraints.md
- 01_prd.md
- 02_architecture.md
- 03_api_contract.md
- 04_model_pipeline.md
- 05_security_compliance.md
- 07_test_plan.md
- 08_repo_layout.md
- 09_local_testing_ci.md

## 4. Hard rules
### 4.1 API contract is source of truth
Implement APIs exactly as defined in `03_api_contract.md`.
If you must change it, update the doc in the same commit and explain why.

### 4.2 Provider integration must be isolated
All Tencent Hunyuan / Meshy calls must be behind `providers/*`.
No provider-specific logic in controllers/routes.

### 4.3 Asset Quality Gate
After generation, run validation:
- glTF validation + custom thresholds from `04_model_pipeline.md`
If validation fails: mark job failed and return a clear error; do NOT ship broken files.

### 4.4 Security
- Secrets only from env; never commit.
- Downloads must use expiring signed URLs.
- Log redaction required.

## 5. Implementation plan (execute in order)
### Step 1: Repo scaffolding
Create monorepo with:
- apps/web (Next.js or Vite)
- apps/api (Node/TS)
- apps/worker (Node/TS)
- packages/shared (types, api schema)
Set up lint/format, and local dev scripts.

### Step 2: Job API (mock provider)
Implement `POST /v1/jobs` and `GET /v1/jobs/{id}`.
Queue job into Redis/BullMQ (or equivalent). Use a mock provider initially.

### Step 3: Storage + download path
Implement asset storage (local/S3-compatible) and `GET /v1/assets/{id}` signed URL flow.
Worker produces a placeholder GLB to prove end-to-end.

### Step 4: Real provider integration
Replace mock with ONE real provider first (Tencent Hunyuan OR Meshy).
Implement retries/timeouts/ratelimiting per constraints.

### Step 5: Web preview
Add a preview page using three.js (or <model-viewer>) for GLB.

### Step 6: Quality gate + observability
Add validation pipeline and structured logs + job failure reasons.

### Step 7: Tests
Follow `07_test_plan.md`:
- unit tests for API
- e2e tests for job lifecycle
- regression “golden set” script

### Step 8: Unity sample (phase 1)
Provide a Unity sample that:
- calls API, polls job, downloads GLB
- loads and renders the model
VR headset display is optional in MVP; target PC first.

## 6. Definition of Done
- `pnpm dev` (or equivalent) starts web+api+worker.
- 5 example prompts generate valid GLB and preview works.
- Unity sample loads downloaded GLB successfully.

## 7. Output protocol for Claude
For each step:
1) list files changed
2) explain key decisions
3) provide run instructions
4) provide test/verification commands
