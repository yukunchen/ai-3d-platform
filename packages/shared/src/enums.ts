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
