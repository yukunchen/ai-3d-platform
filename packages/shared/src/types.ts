import { JobStatus, JobType, AssetFormat, UserRole, AuthProvider, Provider, TextureStyle } from './enums';

/**
 * Texture generation options
 */
export interface TextureOptions {
  resolution: 512 | 1024 | 2048;
  style: TextureStyle;
}

export interface MultiViewImages {
  front: string;
  left: string;
  right: string;
}

/**
 * Create job request body
 */
export interface CreateJobRequest {
  type: JobType;
  prompt: string;
  imageUrl?: string;
  viewImages?: MultiViewImages;
  provider?: Provider;
  textureOptions?: TextureOptions;
}

/**
 * Create job response
 */
export interface CreateJobResponse {
  jobId: string;
  status: JobStatus.Queued;
}

/**
 * Job status response
 */
export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  assetId: string | null;
  error: string | null;
}

/**
 * Asset response
 */
export interface AssetResponse {
  downloadUrl: string;
  format: AssetFormat;
}

/**
 * Job data stored in queue
 */
export interface JobData {
  id: string;
  type: JobType;
  prompt: string;
  imageUrl?: string;
  viewImages?: MultiViewImages;
  provider?: Provider;
  textureOptions?: TextureOptions;
  createdAt: number;
}

/**
 * Job result after completion
 */
export interface JobResult {
  assetId: string;
  assetUrl: string;
  format: AssetFormat;
  provider: string;
  generationTimeMs: number;
  textureMapIds?: Record<string, string>;
}

/**
 * User entity
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authProvider: AuthProvider;
  createdAt: number;
}

/**
 * Authentication request (email/password or provider token)
 */
export interface AuthRequest {
  email?: string;
  password?: string;
  provider?: AuthProvider;
  providerToken?: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: number;
}

/**
 * API Key entity
 */
export interface ApiKey {
  id: string;
  key: string;
  userId: string;
  name: string;
  createdAt: number;
  expiresAt: number;
}
