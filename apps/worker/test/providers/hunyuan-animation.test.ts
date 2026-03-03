import { describe, expect, it } from 'vitest';
import { AssetFormat, JobType, AnimationType } from '@ai-3d-platform/shared';
import { buildHunyuanSubmitPayload } from '../../src/providers/hunyuan';

describe('hunyuan animation payload builder', () => {
  it('sets AnimationPreset=walk for rapid FBX job', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-anim-1',
        type: JobType.Text,
        prompt: 'a walking character',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.Walk },
        createdAt: Date.now(),
      },
      { mode: 'rapid', resultFormat: 'GLB' }
    );

    expect(action).toBe('SubmitHunyuanTo3DRapidJob');
    expect(payload.ResultFormat).toBe('FBX');
    expect(payload.AnimationPreset).toBe('walk');
  });

  it('does not set AnimationPreset when type=none', () => {
    const { payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-anim-2',
        type: JobType.Text,
        prompt: 'a static statue',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.None },
        createdAt: Date.now(),
      },
      { mode: 'rapid' }
    );

    expect(payload.AnimationPreset).toBeUndefined();
  });

  it('sets AnimationPreset=idle for rapid FBX job', () => {
    const { payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-anim-3',
        type: JobType.Text,
        prompt: 'an idle guard',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.Idle },
        createdAt: Date.now(),
      },
      { mode: 'rapid' }
    );

    expect(payload.AnimationPreset).toBe('idle');
  });

  it('sets AnimationPreset=run for pro FBX job', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-anim-4',
        type: JobType.Text,
        prompt: 'a running athlete',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.Run },
        createdAt: Date.now(),
      },
      { mode: 'pro', model: '3.0', resultFormat: 'GLB' }
    );

    expect(action).toBe('SubmitHunyuanTo3DProJob');
    expect(payload.ResultFormat).toBe('FBX');
    expect(payload.AnimationPreset).toBe('run');
  });

  it('sets AnimationPreset=custom for rapid FBX job', () => {
    const { payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-anim-5',
        type: JobType.Text,
        prompt: 'a dancing character',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.Custom, customClipUrl: 'https://example.com/dance.fbx' },
        createdAt: Date.now(),
      },
      { mode: 'rapid' }
    );

    expect(payload.AnimationPreset).toBe('custom');
  });

  it('does not set AnimationPreset when animationOptions is absent', () => {
    const { payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-anim-6',
        type: JobType.Text,
        prompt: 'a table',
        format: AssetFormat.FBX,
        createdAt: Date.now(),
      },
      { mode: 'rapid' }
    );

    expect(payload.AnimationPreset).toBeUndefined();
  });

  it('sets AnimationPreset=walk for pro mode without explicit format option', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-anim-7',
        type: JobType.Text,
        prompt: 'a walking robot',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.Walk },
        createdAt: Date.now(),
      },
      { mode: 'pro', model: '3.0' }
    );

    expect(action).toBe('SubmitHunyuanTo3DProJob');
    expect(payload.AnimationPreset).toBe('walk');
  });
});
