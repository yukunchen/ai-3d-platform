# Repository Layout Rules

## apps/web
- UI only
- No provider logic

## apps/api
- HTTP API
- Auth, validation, queueing

## apps/worker
- Job execution
- Provider calls
- Asset validation

## packages/shared
- Types
- Enums
- API schemas

## Rules
- No cross-app imports except via packages/shared
- No provider SDK used outside worker
