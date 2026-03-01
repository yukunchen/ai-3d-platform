import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { JobData, JobStatus, JobType, CreateJobResponse, JobStatusResponse, Provider, TextureStyle, AssetFormat, SkeletonPreset } from '@ai-3d-platform/shared';
import { saveJobToHistory } from './history';

type QueueState = 'waiting' | 'delayed' | 'active' | 'completed' | 'failed' | string;

export interface QueueJobLike {
  getState(): Promise<QueueState>;
  returnvalue?: { assetId?: string } | null;
  failedReason?: string;
}

export interface JobQueueLike {
  add(
    name: string,
    data: JobData,
    opts: { jobId: string; attempts: number; backoff: { type: string; delay: number } }
  ): Promise<unknown>;
  getJob(jobId: string): Promise<QueueJobLike | null | undefined>;
}

interface JobRouterDeps {
  saveToHistory?: typeof saveJobToHistory;
}

const createJobSchema = z
  .object({
    type: z.enum([JobType.Text, JobType.Image, JobType.MultiView]),
    prompt: z.string().min(1).max(2000),
    imageUrl: z.string().url().optional(),
    viewImages: z
      .object({
        front: z.string().url(),
        left: z.string().url(),
        right: z.string().url(),
      })
      .optional(),
    provider: z.enum([Provider.Hunyuan, Provider.Meshy]).optional(),
    textureOptions: z
      .object({
        resolution: z.union([z.literal(512), z.literal(1024), z.literal(2048)]),
        style: z.enum([
          TextureStyle.Photorealistic,
          TextureStyle.Cartoon,
          TextureStyle.Stylized,
          TextureStyle.Flat,
        ]),
      })
      .optional(),
    format: z.nativeEnum(AssetFormat).optional(),
    skeletonOptions: z.object({ preset: z.nativeEnum(SkeletonPreset) }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === JobType.Image && !data.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'imageUrl is required for image-to-3D jobs',
        path: ['imageUrl'],
      });
    }
    if (data.type === JobType.Text && data.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'imageUrl must be empty for text-to-3D jobs',
        path: ['imageUrl'],
      });
    }
    if (data.type === JobType.Text && data.viewImages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'viewImages must be empty for text-to-3D jobs',
        path: ['viewImages'],
      });
    }
    if (data.type === JobType.Image && data.viewImages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'viewImages must be empty for image-to-3D jobs',
        path: ['viewImages'],
      });
    }
    if (data.type === JobType.MultiView) {
      if (data.imageUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'imageUrl must be empty for multiview-to-3D jobs',
          path: ['imageUrl'],
        });
      }
      if (!data.viewImages) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'viewImages are required for multiview-to-3D jobs',
          path: ['viewImages'],
        });
      }
    }
    if (data.skeletonOptions && data.format !== AssetFormat.FBX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'skeletonOptions is only valid when format is FBX',
        path: ['skeletonOptions'],
      });
    }
  });

export function createJobRouter(queue: JobQueueLike | Queue<JobData>, deps: JobRouterDeps = {}): Router {
  const router = Router();
  const saveToHistory = deps.saveToHistory || saveJobToHistory;

  // POST /v1/jobs - Create a new job
  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = createJobSchema.parse(req.body);

      const jobId = uuidv4();
      const jobData: JobData = {
        id: jobId,
        type: body.type,
        prompt: body.prompt,
        imageUrl: body.imageUrl,
        viewImages: body.viewImages,
        provider: body.provider,
        format: body.format,
        textureOptions: body.textureOptions,
        skeletonOptions: body.skeletonOptions,
        createdAt: Date.now(),
      };

      await queue.add('generate-3d', jobData, {
        jobId,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      // Save job to history
      await saveToHistory(jobId, body.type, body.prompt, JobStatus.Queued, null);

      const response: CreateJobResponse = {
        jobId,
        status: JobStatus.Queued,
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      console.error('Error creating job:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  });

  // GET /v1/jobs/:jobId - Get job status
  router.get('/:jobId', async (req: Request, res: Response) => {
    const { jobId } = req.params;

    try {
      const job = await queue.getJob(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      let status: JobStatus;
      let assetId: string | null = null;
      let error: string | null = null;

      const state = await job.getState();

      switch (state) {
        case 'waiting':
        case 'delayed':
          status = JobStatus.Queued;
          break;
        case 'active':
          status = JobStatus.Running;
          break;
        case 'completed': {
          status = JobStatus.Succeeded;
          const result = job.returnvalue;
          if (result) {
            assetId = result.assetId;
          }
          break;
        }
        case 'failed':
          status = JobStatus.Failed;
          error = job.failedReason || 'Job failed';
          break;
        default:
          status = JobStatus.Queued;
      }

      const response: JobStatusResponse = {
        jobId,
        status,
        assetId,
        error,
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting job:', error);
      res.status(500).json({ error: 'Failed to get job status' });
    }
  });

  return router;
}
