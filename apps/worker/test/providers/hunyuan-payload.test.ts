import { describe, expect, it } from 'vitest';
import { JobType } from '@ai-3d-platform/shared';
import { buildHunyuanSubmitPayload } from '../../src/providers/hunyuan';

describe('hunyuan submit payload builder', () => {
  it('builds rapid text payload', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-1',
        type: JobType.Text,
        prompt: 'a wooden chair',
        createdAt: Date.now(),
      },
      { mode: 'rapid', resultFormat: 'GLB', enablePbr: true, enableGeometry: false }
    );

    expect(action).toBe('SubmitHunyuanTo3DRapidJob');
    expect(payload).toEqual({
      Prompt: 'a wooden chair',
      ResultFormat: 'GLB',
      EnablePBR: true,
      EnableGeometry: false,
    });
  });

  it('throws for rapid multiview payload', () => {
    expect(() =>
      buildHunyuanSubmitPayload(
        {
          id: 'job-2',
          type: JobType.MultiView,
          prompt: 'three views',
          viewImages: {
            front: 'https://example.com/front.png',
            left: 'https://example.com/left.png',
            right: 'https://example.com/right.png',
          },
          createdAt: Date.now(),
        },
        { mode: 'rapid' }
      )
    ).toThrow('rapid mode does not support multiview');
  });

  it('builds pro multiview payload', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-3',
        type: JobType.MultiView,
        prompt: 'three views',
        viewImages: {
          front: 'https://example.com/front.png',
          left: 'https://example.com/left.png',
          right: 'https://example.com/right.png',
        },
        createdAt: Date.now(),
      },
      { mode: 'pro', model: '3.0', enablePbr: true }
    );

    expect(action).toBe('SubmitHunyuanTo3DProJob');
    expect(payload).toEqual({
      Model: '3.0',
      ImageUrl: 'https://example.com/front.png',
      MultiViewImages: [
        { ViewType: 'left', ViewImageUrl: 'https://example.com/left.png' },
        { ViewType: 'right', ViewImageUrl: 'https://example.com/right.png' },
      ],
      EnablePBR: true,
    });
  });

  it('builds rapid image payload with base64', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-4',
        type: JobType.Image,
        prompt: 'a dog photo',
        imageUrl: 'https://example.com/dog.png',
        createdAt: Date.now(),
      },
      { mode: 'rapid', imageBase64: 'ZmFrZS1iYXNlNjQ=' }
    );

    expect(action).toBe('SubmitHunyuanTo3DRapidJob');
    expect(payload).toEqual({
      ImageBase64: 'ZmFrZS1iYXNlNjQ=',
    });
  });

  it('builds pro image payload with base64', () => {
    const { action, payload } = buildHunyuanSubmitPayload(
      {
        id: 'job-5',
        type: JobType.Image,
        prompt: 'a dog photo',
        imageUrl: 'https://example.com/dog.png',
        createdAt: Date.now(),
      },
      { mode: 'pro', model: '3.0', imageBase64: 'ZmFrZS1iYXNlNjQ=' }
    );

    expect(action).toBe('SubmitHunyuanTo3DProJob');
    expect(payload).toEqual({
      Model: '3.0',
      ImageBase64: 'ZmFrZS1iYXNlNjQ=',
    });
  });
});
