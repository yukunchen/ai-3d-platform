import { Job } from 'bullmq';
import { JobData } from '@ai-3d-platform/shared';
import { ProviderAdapter, ProviderContext, ProviderResult } from './provider';
import { generateFromText, generateFromImage, generateFromMultiView, isMeshyConfigured } from './meshy';

export function createMeshyProvider(): ProviderAdapter {
  return {
    name: 'meshy',
    isConfigured: () => isMeshyConfigured(),
    generateFromText: (job: Job<JobData, ProviderResult>, ctx: ProviderContext) =>
      generateFromText(job, ctx.s3Client, ctx.bucket),
    generateFromImage: (job: Job<JobData, ProviderResult>, ctx: ProviderContext) =>
      generateFromImage(job, ctx.s3Client, ctx.bucket),
    generateFromMultiView: (job: Job<JobData, ProviderResult>, ctx: ProviderContext) =>
      generateFromMultiView(job, ctx.s3Client, ctx.bucket),
  };
}
