import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { JobData, JobStatus, JobType, CreateJobResponse, JobStatusResponse } from '@ai-3d-platform/shared';
import { saveJobToHistory } from './history';

const createJobSchema = z.object({
  type: z.enum([JobType.Text, JobType.Image]),
  prompt: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional(),
});

export function createJobRouter(queue: Queue<JobData>): Router {
  const router = Router();

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
      await saveJobToHistory(jobId, body.type, body.prompt, JobStatus.Queued, null);

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
        case 'completed':
          status = JobStatus.Succeeded;
          const result = job.returnvalue;
          if (result) {
            assetId = result.assetId;
          }
          break;
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
