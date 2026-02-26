import { describe, expect, it } from 'vitest';
import { buildImageTaskPayload, buildMultiViewTaskPayload, buildTextTaskPayload } from '../../src/providers/meshy';

describe('meshy payload builders', () => {
  it('builds text payload', () => {
    expect(buildTextTaskPayload('a red car')).toEqual({
      mode: 'preview',
      prompt: 'a red car',
      should_remesh: true,
    });
  });

  it('builds single-image payload', () => {
    expect(buildImageTaskPayload('https://example.com/image.png')).toEqual({
      image_url: 'https://example.com/image.png',
      should_remesh: true,
      should_texture: true,
      enable_pbr: true,
      save_pre_remeshed_model: false,
    });
  });

  it('builds multi-view payload in front/left/right order', () => {
    expect(
      buildMultiViewTaskPayload({
        front: 'https://example.com/front.png',
        left: 'https://example.com/left.png',
        right: 'https://example.com/right.png',
      })
    ).toEqual({
      image_urls: [
        'https://example.com/front.png',
        'https://example.com/left.png',
        'https://example.com/right.png',
      ],
      should_remesh: true,
      should_texture: true,
      enable_pbr: true,
      save_pre_remeshed_model: false,
    });
  });
});
