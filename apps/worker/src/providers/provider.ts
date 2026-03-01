import { S3Client } from '@aws-sdk/client-s3';
import { Job } from 'bullmq';
import { JobData, AssetFormat } from '@ai-3d-platform/shared';

export interface ProviderContext {
  s3Client: S3Client | null;
  bucket?: string;
}

export interface ProviderResult {
  assetId: string;
  assetUrl: string;
  textureMapIds?: Record<string, string>;
  format?: AssetFormat;
}

export interface ProviderAdapter {
  name: string;
  isConfigured(): boolean;
  generateFromText(job: Job<JobData, ProviderResult>, ctx: ProviderContext): Promise<ProviderResult>;
  generateFromImage(job: Job<JobData, ProviderResult>, ctx: ProviderContext): Promise<ProviderResult>;
  generateFromMultiView(job: Job<JobData, ProviderResult>, ctx: ProviderContext): Promise<ProviderResult>;
}
