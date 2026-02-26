import { JobData } from '@ai-3d-platform/shared';
import { ProviderAdapter, ProviderContext, ProviderResult } from './providers/provider';

export interface JobLike {
  id?: string;
  data: JobData;
}

export interface Generate3DDeps {
  providers: ProviderAdapter[];
  s3Client: ProviderContext['s3Client'];
  bucket?: string;
  generatePlaceholder?: (
    jobId: string,
    s3Client: ProviderContext['s3Client'],
    bucket?: string
  ) => Promise<ProviderResult>;
  delay?: (ms: number) => Promise<void>;
  random?: () => number;
  envProvider?: string;
}

export function selectProvider(
  providers: ProviderAdapter[],
  nameOverride?: string,
  envProvider?: string
): ProviderAdapter | null {
  const providerName = (nameOverride || envProvider || '').toLowerCase();

  if (providerName) {
    const selected = providers.find((p) => p.name === providerName);
    if (!selected) {
      console.warn(`[Provider] Unknown provider "${providerName}", falling back to auto selection`);
    } else if (!selected.isConfigured()) {
      console.warn(`[Provider] "${providerName}" is not configured, falling back to auto selection`);
    } else {
      return selected;
    }
  }

  const configured = providers.find((p) => p.isConfigured());
  return configured || null;
}

async function defaultGeneratePlaceholder(
  jobId: string,
  s3Client: ProviderContext['s3Client'],
  bucket?: string
): Promise<ProviderResult> {
  const { generatePlaceholderGLB } = await import('./glb-generator');
  return generatePlaceholderGLB(jobId, s3Client, bucket);
}

export async function generate3D(job: JobLike, deps: Generate3DDeps): Promise<ProviderResult> {
  const ctx: ProviderContext = { s3Client: deps.s3Client, bucket: deps.bucket };
  const provider = selectProvider(deps.providers, job.data.provider, deps.envProvider);

  if (!provider) {
    const delay = deps.delay || ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const random = deps.random || Math.random;
    const generatePlaceholder = deps.generatePlaceholder || defaultGeneratePlaceholder;

    console.log(`[Mock Provider] Generating 3D for job ${job.id}`);
    console.log(`[Mock Provider] Type: ${job.data.type}, Prompt: ${job.data.prompt.substring(0, 50)}...`);

    const waitMs = 1000 + random() * 2000;
    await delay(waitMs);
    return generatePlaceholder(job.id!, deps.s3Client, deps.bucket);
  }

  if (job.data.type === 'multiview') {
    const viewImages = job.data.viewImages;
    if (!viewImages?.front || !viewImages?.left || !viewImages?.right) {
      throw new Error('front/left/right images are required for multiview-to-3D generation');
    }
    return provider.generateFromMultiView(job as never, ctx);
  }

  if (job.data.type === 'image') {
    if (!job.data.imageUrl) {
      throw new Error('Image URL is required for image-to-3D generation');
    }
    return provider.generateFromImage(job as never, ctx);
  }

  return provider.generateFromText(job as never, ctx);
}
