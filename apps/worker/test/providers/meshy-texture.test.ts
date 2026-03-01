import { describe, expect, it } from 'vitest';
import { buildTextTaskPayload, buildImageTaskPayload, buildMultiViewTaskPayload } from '../../src/providers/meshy';
import { TextureStyle } from '@ai-3d-platform/shared';

describe('meshy textureOptions mapping', () => {
  describe('buildTextTaskPayload with textureOptions', () => {
    it('includes texture_resolution and art_style when textureOptions provided', () => {
      const payload = buildTextTaskPayload('a red car', { resolution: 1024, style: TextureStyle.Photorealistic });
      expect(payload.texture_resolution).toBe(1024);
      expect(payload.art_style).toBe('realistic');
    });

    it('omits texture fields when no textureOptions', () => {
      const payload = buildTextTaskPayload('a red car');
      expect(payload.texture_resolution).toBeUndefined();
      expect(payload.art_style).toBeUndefined();
    });

    it('maps Cartoon style to cartoon', () => {
      const payload = buildTextTaskPayload('a toy', { resolution: 512, style: TextureStyle.Cartoon });
      expect(payload.art_style).toBe('cartoon');
    });

    it('maps Stylized style to low-poly', () => {
      const payload = buildTextTaskPayload('a toy', { resolution: 512, style: TextureStyle.Stylized });
      expect(payload.art_style).toBe('low-poly');
    });

    it('maps Flat style to pbr', () => {
      const payload = buildTextTaskPayload('a toy', { resolution: 2048, style: TextureStyle.Flat });
      expect(payload.art_style).toBe('pbr');
      expect(payload.texture_resolution).toBe(2048);
    });
  });

  describe('buildImageTaskPayload with textureOptions', () => {
    it('includes texture_resolution and art_style when textureOptions provided', () => {
      const payload = buildImageTaskPayload('https://example.com/img.png', { resolution: 2048, style: TextureStyle.Cartoon });
      expect(payload.texture_resolution).toBe(2048);
      expect(payload.art_style).toBe('cartoon');
    });

    it('omits texture fields when no textureOptions', () => {
      const payload = buildImageTaskPayload('https://example.com/img.png');
      expect(payload.texture_resolution).toBeUndefined();
      expect(payload.art_style).toBeUndefined();
    });
  });

  describe('buildMultiViewTaskPayload with textureOptions', () => {
    const viewImages = {
      front: 'https://example.com/front.png',
      left: 'https://example.com/left.png',
      right: 'https://example.com/right.png',
    };

    it('includes texture_resolution and art_style when textureOptions provided', () => {
      const payload = buildMultiViewTaskPayload(viewImages, { resolution: 1024, style: TextureStyle.Stylized });
      expect(payload.texture_resolution).toBe(1024);
      expect(payload.art_style).toBe('low-poly');
    });

    it('omits texture fields when no textureOptions', () => {
      const payload = buildMultiViewTaskPayload(viewImages);
      expect(payload.texture_resolution).toBeUndefined();
      expect(payload.art_style).toBeUndefined();
    });
  });
});
