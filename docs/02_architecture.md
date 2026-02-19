# System Architecture

## Components
- Web App (Next.js)
- API Server
- Job Queue (BullMQ)
- Worker (3D generation)
- Object Storage (S3)
- External Providers (Tencent Hunyuan, Meshy)

## Data Flow
1. Web → API: create job
2. API → Queue: enqueue job
3. Worker → Provider: generate 3D
4. Worker → Storage: upload assets
5. API → Web: job status & asset URLs

## Design Principles
- API is stateless
- Workers are horizontally scalable
- Providers are isolated behind adapters
