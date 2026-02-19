# Security & Compliance

## Secrets
- Stored only in environment variables
- Never logged

## Access Control
- Assets accessed via signed URLs
- URL expiration <= 1 hour

## Data Retention
- User uploads: auto-delete after N days (configurable)
- Generated assets: retained per user policy

## Prompt Safety
- Basic content filtering before provider call
