# Product Requirements Document (PRD)

## Goal
Enable users to generate 3D models from text or images and download them for use in DCC tools, Unity, or VR.

## User Flow
1. User enters text prompt or uploads image
2. User submits generation request
3. System shows job progress
4. User previews generated 3D model
5. User downloads model (GLB)

## MVP Scope (v1.1, TDD Minimal Runnable)
- Text → 3D
- Image → 3D
- Three-view Image → 3D
- GLB output
- Job status polling
- Web preview
- Download link
- Local mock-provider fallback for deterministic tests

## Out of Scope (MVP)
- Model editing
- Asset marketplace
- Multi-provider quality voting
- Automatic rig retargeting
- FBX / animation / rigging
- CI hard gate on real provider calls

## Success Metrics
- Job success rate > 80%
- Median generation time < 5 min
- Preview load success > 95%

## MVP Acceptance Gates
1. Core API contract tests pass (`/v1/jobs`, `/v1/jobs/{id}`, `/v1/assets/{id}`, `/v1/assets/{id}/preview`)
2. Worker core tests pass (provider selection, image validation, fallback behavior)
3. One web smoke flow passes (submit -> status -> success state)
4. All tests run locally without external provider credentials
