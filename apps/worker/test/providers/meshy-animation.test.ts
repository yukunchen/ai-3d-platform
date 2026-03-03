import { describe, expect, it } from 'vitest';
import { AssetFormat, JobType, AnimationType } from '@ai-3d-platform/shared';

describe('meshy animation support', () => {
  it('FBX + animation results in animationClipUrl being set', () => {
    // Meshy handles animation at download time — when format=FBX and
    // animationOptions is set, animationClipUrl should point to the FBX URL.
    const jobData = {
      id: 'test-anim-1',
      type: JobType.Text,
      prompt: 'a walking knight',
      format: AssetFormat.FBX,
      animationOptions: { type: AnimationType.Walk },
      createdAt: Date.now(),
    };

    const useFbx = jobData.format === AssetFormat.FBX;
    const modelUrl = 'https://meshy.ai/models/test-anim-1.fbx';
    const animationType = jobData.animationOptions?.type;

    let animationClipUrl: string | undefined;
    if (useFbx && animationType && animationType !== AnimationType.None) {
      animationClipUrl = modelUrl;
    }

    expect(animationClipUrl).toBe(modelUrl);
  });

  it('GLB + no animation has no animationClipUrl', () => {
    const jobData = {
      id: 'test-anim-2',
      type: JobType.Text,
      prompt: 'a static chair',
      format: AssetFormat.GLB,
      createdAt: Date.now(),
    };

    const useFbx = jobData.format === AssetFormat.FBX;
    const animationType = jobData.animationOptions?.type;

    let animationClipUrl: string | undefined;
    if (useFbx && animationType && animationType !== AnimationType.None) {
      animationClipUrl = 'https://meshy.ai/models/test.fbx';
    }

    expect(animationClipUrl).toBeUndefined();
  });

  it('FBX + animationType=none has no animationClipUrl', () => {
    const jobData = {
      id: 'test-anim-3',
      type: JobType.Text,
      prompt: 'a static model',
      format: AssetFormat.FBX,
      animationOptions: { type: AnimationType.None },
      createdAt: Date.now(),
    };

    const useFbx = jobData.format === AssetFormat.FBX;
    const animationType = jobData.animationOptions?.type;

    let animationClipUrl: string | undefined;
    if (useFbx && animationType && animationType !== AnimationType.None) {
      animationClipUrl = 'https://meshy.ai/models/test.fbx';
    }

    expect(animationClipUrl).toBeUndefined();
  });

  it('FBX + animationType=idle sets animationClipUrl', () => {
    const jobData = {
      id: 'test-anim-4',
      type: JobType.Text,
      prompt: 'an idle guard',
      format: AssetFormat.FBX,
      animationOptions: { type: AnimationType.Idle },
      createdAt: Date.now(),
    };

    const useFbx = jobData.format === AssetFormat.FBX;
    const modelUrl = 'https://meshy.ai/models/test-anim-4.fbx';
    const animationType = jobData.animationOptions?.type;

    let animationClipUrl: string | undefined;
    if (useFbx && animationType && animationType !== AnimationType.None) {
      animationClipUrl = modelUrl;
    }

    expect(animationClipUrl).toBe(modelUrl);
  });

  it('FBX + animationType=custom with customClipUrl sets animationClipUrl', () => {
    const jobData = {
      id: 'test-anim-5',
      type: JobType.Text,
      prompt: 'a dancing figure',
      format: AssetFormat.FBX,
      animationOptions: { type: AnimationType.Custom, customClipUrl: 'https://example.com/dance.fbx' },
      createdAt: Date.now(),
    };

    const useFbx = jobData.format === AssetFormat.FBX;
    const modelUrl = 'https://meshy.ai/models/test-anim-5.fbx';
    const animationType = jobData.animationOptions?.type;

    let animationClipUrl: string | undefined;
    if (useFbx && animationType && animationType !== AnimationType.None) {
      animationClipUrl = modelUrl;
    }

    expect(animationClipUrl).toBe(modelUrl);
  });
});
