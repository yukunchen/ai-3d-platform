# API Contract (v1)

## POST /v1/jobs
Create a 3D generation job.

Request:
{
  "type": "text" | "image" | "multiview",
  "prompt": "string",
  "imageUrl": "string (optional)",
  "viewImages": {
    "front": "string(url)",
    "left": "string(url)",
    "right": "string(url)"
  } (optional),
  "provider": "hunyuan | meshy (optional)"
}
Rules:
- If type = "image", imageUrl is required.
- If type = "text", imageUrl must be omitted.
- If type = "multiview", viewImages.front/left/right are required and imageUrl must be omitted.

Response:
{
  "jobId": "string",
  "status": "queued"
}

## GET /v1/jobs/{jobId}
Response:
{
  "jobId": "string",
  "status": "queued | running | succeeded | failed",
  "assetId": "string | null",
  "error": "string | null"
}

## GET /v1/assets/{assetId}
Response:
{
  "downloadUrl": "string (signed)",
  "format": "glb"
}

## GET /v1/assets/{assetId}/preview
- Returns GLB or redirect to preview resource

## Testing Notes
- The four endpoints above are MVP hard-contract endpoints and must be covered by automated tests.
- Real provider calls are not required for contract tests; queue/provider can be mocked.

## Non-blocking Extension
- `GET /v1/jobs` (history list) exists as an extension endpoint and is not part of the MVP hard-contract gate.
