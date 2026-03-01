import { describe, expect, it } from 'vitest';
import { AssetFormat, JobType, SkeletonPreset } from '@ai-3d-platform/shared';
import { buildHunyuanSubmitPayload } from '../../src/providers/hunyuan';

describe('hunyuan FBX payload builder', () => {
  it('sets ResultFormat=FBX for rapid text job when format=FBX', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-fbx-1',
        type: JobType.Text,
        prompt: 'a dragon',
        format: AssetFormat.FBX,
        createdAt: Date.now(),
      },
      { mode: 'rapid', resultFormat: 'GLB' }
    );

    expect(action).toBe('SubmitHunyuanTo3DRapidJob');
    expect(payload.ResultFormat).toBe('FBX');
  });

  it('sets ResultFormat=FBX for pro text job when format=FBX', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-fbx-2',
        type: JobType.Text,
        prompt: 'a robot',
        format: AssetFormat.FBX,
        createdAt: Date.now(),
      },
      { mode: 'pro', model: '3.0', resultFormat: 'GLB' }
    );

    expect(action).toBe('SubmitHunyuanTo3DProJob');
    expect(payload.ResultFormat).toBe('FBX');
  });

  it('sets SkeletonPreset=humanoid in rapid FBX job', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-fbx-3',
        type: JobType.Text,
        prompt: 'a character',
        format: AssetFormat.FBX,
        skeletonOptions: { preset: SkeletonPreset.Humanoid },
        createdAt: Date.now(),
      },
      { mode: 'rapid', resultFormat: 'GLB' }
    );

    expect(action).toBe('SubmitHunyuanTo3DRapidJob');
    expect(payload.ResultFormat).toBe('FBX');
    expect(payload.SkeletonPreset).toBe('humanoid');
  });

  it('sets SkeletonPreset=quadruped in rapid FBX job', () => {
    const { payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-fbx-4',
        type: JobType.Text,
        prompt: 'a horse',
        format: AssetFormat.FBX,
        skeletonOptions: { preset: SkeletonPreset.Quadruped },
        createdAt: Date.now(),
      },
      { mode: 'rapid' }
    );

    expect(payload.SkeletonPreset).toBe('quadruped');
  });

  it('does not set SkeletonPreset when preset=none', () => {
    const { payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-fbx-5',
        type: JobType.Text,
        prompt: 'a table',
        format: AssetFormat.FBX,
        skeletonOptions: { preset: SkeletonPreset.None },
        createdAt: Date.now(),
      },
      { mode: 'rapid' }
    );

    expect(payload.SkeletonPreset).toBeUndefined();
  });

  it('keeps GLB format when no format specified', () => {
    const { payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-glb-1',
        type: JobType.Text,
        prompt: 'a chair',
        createdAt: Date.now(),
      },
      { mode: 'rapid', resultFormat: 'GLB' }
    );

    expect(payload.ResultFormat).toBe('GLB');
  });
});
