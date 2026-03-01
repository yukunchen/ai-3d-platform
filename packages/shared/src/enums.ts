/**
 * Job status enum
 */
export enum JobStatus {
  Queued = 'queued',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

/**
 * Job type enum
 */
export enum JobType {
  Text = 'text',
  Image = 'image',
  MultiView = 'multiview',
}

/**
 * Asset format enum
 */
export enum AssetFormat {
  GLB = 'glb',
  FBX = 'fbx',
}

/**
 * User role enum
 */
export enum UserRole {
  Admin = 'admin',
  User = 'user',
}

/**
 * Authentication provider enum
 */
export enum AuthProvider {
  Email = 'email',
  Google = 'google',
  GitHub = 'github',
}

/**
 * Provider enum
 */
export enum Provider {
  Hunyuan = 'hunyuan',
  Meshy = 'meshy',
}

/**
 * Texture style enum
 */
export enum TextureStyle {
  Photorealistic = 'photorealistic',
  Cartoon = 'cartoon',
  Stylized = 'stylized',
  Flat = 'flat',
}
