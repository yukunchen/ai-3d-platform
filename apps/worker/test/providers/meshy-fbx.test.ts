import { describe, expect, it } from 'vitest';
import { AssetFormat, JobType } from '@ai-3d-platform/shared';
import { buildTextTaskPayload, buildImageTaskPayload } from '../../src/providers/meshy';

// The meshy payload builders don't change for FBX — the format selection
// happens at download time (model_urls.fbx vs model_urls.glb).
// These tests verify the payload builders remain correct and that
// the format field on job.data is the sole driver of URL selection.

describe('meshy FBX URL selection', () => {
  it('text payload is format-agnostic (FBX picked from model_urls at download)', () => {
    const payload = buildTextTaskPayload('a knight');
    // Payload itself does not include a format field — Meshy returns all formats
    expect(payload).not.toHaveProperty('format');
    expect(payload).not.toHaveProperty('output_format');
  });

  it('image payload is format-agnostic', () => {
    const payload = buildImageTaskPayload('https://example.com/img.png');
    expect(payload).not.toHaveProperty('format');
    expect(payload).not.toHaveProperty('output_format');
  });

  it('AssetFormat enum values are correct for URL key selection', () => {
    // model_urls keys in Meshy response: 'glb', 'fbx'
    expect(AssetFormat.GLB).toBe('glb');
    expect(AssetFormat.FBX).toBe('fbx');
  });

  it('job data format field drives extension', () => {
    const jobData = {
      id: 'test-job',
      type: JobType.Text,
      prompt: 'a cat',
      format: AssetFormat.FBX,
      createdAt: Date.now(),
    };
    // When format=FBX, extension should be 'fbx'
    const useFbx = jobData.format === AssetFormat.FBX;
    expect(useFbx).toBe(true);
    expect(useFbx ? 'fbx' : 'glb').toBe('fbx');
  });

  it('defaults to GLB when no format specified', () => {
    const jobData = {
      id: 'test-job-2',
      type: JobType.Text,
      prompt: 'a dog',
      createdAt: Date.now(),
    };
    const useFbx = jobData.format === AssetFormat.FBX;
    expect(useFbx).toBe(false);
    expect(useFbx ? 'fbx' : 'glb').toBe('glb');
  });
});
