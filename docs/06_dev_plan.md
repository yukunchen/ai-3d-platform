# Development Plan

## Phase 1 (MVP v1.1 - TDD Gates)
1. Step 1: Health + test harness
- Add test tooling and first failing test for `/health`
- Pass criteria: `pnpm test:tdd:step1` green

2. Step 2: Job creation contract
- Write failing tests for `POST /v1/jobs` positive and validation cases
- Pass criteria: `pnpm test:tdd:step2` green

3. Step 3: Job status mapping
- Write failing tests for queue state -> API status mapping
- Pass criteria: `pnpm test:tdd:step3` green

4. Step 4: Asset route contract
- Write failing tests for `/v1/assets/{assetId}` and preview redirect
- Pass criteria: `pnpm test:tdd:step4` green

5. Step 5: Worker core behavior
- Write failing tests for provider selection and fallback generation
- Pass criteria: `pnpm test:tdd:step5` green

6. Step 6: Web smoke
- Write failing smoke test for submit -> status -> success state
- Pass criteria: `pnpm test:tdd:step6` green

## Phase 2
- FBX output
- Animation / Rig
- Unity SDK
- VR headset demo

## Key Risks
- Provider instability
- Output quality variance
- Cost spikes
- Test flakiness from external dependencies
