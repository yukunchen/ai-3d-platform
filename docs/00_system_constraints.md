# System Constraints (Hard Rules)

## Input
- Text prompt (UTF-8, max 2,000 chars)
- Image upload (PNG/JPG/WebP, max 10MB, max 2048x2048)

## Output
- Primary: .glb (glTF 2.0, binary)
- Secondary (Phase 2): .fbx
- Required assets:
  - Mesh
  - PBR materials
  - Textures (if applicable)
- Optional (Phase 2):
  - Animation
  - Skeleton / Rig

## Runtime
- Node.js >= 18
- TypeScript >= 5
- Redis >= 6
- S3-compatible object storage

## Performance
- Job timeout: 15 min (hard)
- Max concurrent jobs per worker: 2
- Retry: max 2 times (provider failure only)

## Cost Control
- Per-job provider call must be logged with estimated cost
- Daily soft limit (configurable)

## Compliance
- User uploads are private and isolated
- Generated assets are accessible only via signed URLs
- Logs must not contain secrets or raw prompts
