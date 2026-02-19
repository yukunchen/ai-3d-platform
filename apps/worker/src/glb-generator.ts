import { S3Client } from '@aws-sdk/client-s3';
import { uploadToS3 } from '@ai-3d-platform/shared';

/**
 * Generate a simple cube GLB file for testing
 * This creates a minimal valid GLB with a simple cube mesh
 */
export async function generatePlaceholderGLB(
  jobId: string,
  s3Client: S3Client | null,
  bucket: string | undefined
): Promise<{ assetId: string; assetUrl: string }> {
  const assetId = `asset-${jobId}.glb`;

  // Minimal GLB with a simple cube
  // This is a pre-generated valid GLB buffer
  const glbBuffer = createMinimalGLB();

  let assetUrl: string;

  if (s3Client && bucket) {
    // Upload to S3
    const s3Key = `assets/${assetId}`;
    await uploadToS3(s3Client, bucket, s3Key, glbBuffer, 'model/gltf-binary');

    // In production, generate signed URL here
    // For now, return a placeholder URL that the API will replace with signed URL
    assetUrl = `s3://${bucket}/${s3Key}`;
  } else {
    // Fallback: store locally (for development without S3)
    assetUrl = `http://localhost:3001/assets/${assetId}`;
  }

  return { assetId, assetUrl };
}

/**
 * Create a minimal valid GLB file containing a cube
 * This is a hardcoded minimal glTF 2.0 binary file
 */
function createMinimalGLB(): Buffer {
  // GLB structure:
  // - 12 byte header (magic, version, length)
  // - JSON chunk (glTF scene)
  // - BIN chunk (mesh data)

  // Magic number for GLB: 0x46546C67 ("glTF" in little endian)
  // Version: 2
  // Total length: will be calculated

  // Minimal glTF JSON
  const jsonChunk = {
    asset: { version: "2.0", generator: "AI-3D-Platform" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        mode: 4 // TRIANGLES
      }]
    }],
    accessors: [{
      bufferView: 0,
      componentType: 5126, // FLOAT
      count: 8,
      type: "VEC3",
      max: [1, 1, 1],
      min: [-1, -1, -1]
    }, {
      bufferView: 1,
      componentType: 5123, // UNSIGNED_SHORT
      count: 36,
      type: "VEC3"
    }],
    bufferViews: [{
      buffer: 0,
      byteOffset: 0,
      byteLength: 96
    }, {
      buffer: 0,
      byteOffset: 96,
      byteLength: 72
    }],
    buffers: [{
      byteLength: 168
    }]
  };

  const jsonString = JSON.stringify(jsonChunk);
  const jsonBytes = new TextEncoder().encode(jsonString);

  // Pad JSON to 4-byte alignment
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const paddedJsonLength = jsonBytes.length + jsonPadding;

  // Cube vertex data (8 vertices, 3 floats each = 96 bytes)
  const vertices = new Float32Array([
    // Front face
    -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,
    // Back face
    -1, -1, -1,  -1,  1, -1,   1,  1, -1,   1, -1, -1,
  ]);

  // Cube indices (36 indices for 12 triangles)
  const indices = new Uint16Array([
    // Front
    0, 1, 2,  0, 2, 3,
    // Top
    3, 2, 6,  3, 6, 7,
    // Back
    7, 6, 5,  7, 5, 4,
    // Bottom
    4, 5, 1,  4, 1, 0,
    // Right
    1, 5, 6,  1, 6, 2,
    // Left
    4, 0, 3,  4, 3, 7,
  ]);

  // Combine vertex and index data
  const binData = new Uint8Array(vertices.byteLength + indices.byteLength);
  binData.set(new Uint8Array(vertices.buffer), 0);
  binData.set(new Uint8Array(indices.buffer), vertices.byteLength);

  // Pad binary to 4-byte alignment
  const binPadding = (4 - (binData.length % 4)) % 4;
  const paddedBinLength = binData.length + binPadding;

  // Total GLB length
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;

  // Create GLB buffer
  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);

  // Write header
  view.setUint32(0, 0x46546C67, true); // magic
  view.setUint32(4, 2, true);          // version
  view.setUint32(8, totalLength, true); // length

  // JSON chunk
  view.setUint32(12, paddedJsonLength, true); // chunk length
  view.setUint32(16, 0x4E4F534A, true);      // chunk type (JSON)

  // Write JSON bytes
  const jsonView = new Uint8Array(glb, 20);
  jsonView.set(jsonBytes);

  // BIN chunk
  const binChunkStart = 20 + paddedJsonLength;
  view.setUint32(binChunkStart, paddedBinLength, true);
  view.setUint32(binChunkStart + 4, 0x004E4942, true); // chunk type (BIN)

  // Write binary data
  const binView = new Uint8Array(glb, binChunkStart + 8);
  binView.set(binData);

  return Buffer.from(glb);
}
