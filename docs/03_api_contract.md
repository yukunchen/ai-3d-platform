# API Contract (v1)

## POST /v1/jobs
Create a 3D generation job.

Request:
{
  "type": "text" | "image",
  "prompt": "string",
  "imageUrl": "string (optional)"
}

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
