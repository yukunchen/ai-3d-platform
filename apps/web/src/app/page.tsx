'use client';

import { useState, useEffect } from 'react';
import { JobType, JobStatus, CreateJobRequest, JobStatusResponse, Provider, TextureStyle, AssetFormat, SkeletonPreset, AnimationType } from '@ai-3d-platform/shared';
import LoadingSpinner from '../components/LoadingSpinner';
import ModelViewer from '../components/ModelViewer';
import TexturePanel from '../components/TexturePanel';
import styles from './page.module.css';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('auth_token');
    if (saved) setToken(saved);
    else setAuthMode('login');
  }, []);

  const handleAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);

    // Client-side validation
    if (!authEmail.trim()) {
      setAuthError('Email is required');
      setAuthLoading(false);
      return;
    }
    if (!authPassword.trim()) {
      setAuthError('Password is required');
      setAuthLoading(false);
      return;
    }
    if (authMode === 'register' && authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters');
      setAuthLoading(false);
      return;
    }
    if (authMode === 'register' && !authName.trim()) {
      setAuthError('Name is required');
      setAuthLoading(false);
      return;
    }

    try {
      const isRegister = authMode === 'register';
      const endpoint = isRegister ? '/v1/auth/register' : '/v1/auth/login';
      const body = isRegister
        ? { name: authName, email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        // Extract detailed validation error message if available
        let errorMsg = data.error || 'Authentication failed';
        if (data.details && Array.isArray(data.details) && data.details.length > 0) {
          const firstError = data.details[0];
          if (firstError.message) {
            errorMsg = `${firstError.path?.join('.') || 'Field'}: ${firstError.message}`;
          }
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setAuthMode(null);
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setAuthMode('login');
  };

  const [jobType, setJobType] = useState<JobType>(JobType.Text);
  const [provider, setProvider] = useState<Provider | 'auto'>('auto');
  const [format, setFormat] = useState<AssetFormat>(AssetFormat.GLB);
  const [skeletonPreset, setSkeletonPreset] = useState<SkeletonPreset>(SkeletonPreset.None);
  const [animationType, setAnimationType] = useState<AnimationType>(AnimationType.None);
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [leftImageUrl, setLeftImageUrl] = useState('');
  const [rightImageUrl, setRightImageUrl] = useState('');
  const [textureResolution, setTextureResolution] = useState<512 | 1024 | 2048>(1024);
  const [textureStyle, setTextureStyle] = useState<TextureStyle>(TextureStyle.Photorealistic);
  const [enableTextures, setEnableTextures] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [textureMaps, setTextureMaps] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Use relative URLs so Next.js rewrites proxy to the API server (see next.config.js).
  // This avoids NEXT_PUBLIC_* build-time coupling to a specific host.
  const API_URL = '';

  const validateInput = (): string | null => {
    if (!prompt.trim()) {
      return 'Prompt is required';
    }
    if (jobType === JobType.Image && !imageUrl.trim()) {
      return 'Image URL is required for image-to-3D';
    }
    if (jobType === JobType.MultiView) {
      if (!frontImageUrl.trim() || !leftImageUrl.trim() || !rightImageUrl.trim()) {
        return 'Front/Left/Right image URLs are required for three-view-to-3D';
      }
    }
    return null;
  };

  const createJob = async () => {
    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setAssetUrl(null);
    setTextureMaps(null);

    try {
      const body: CreateJobRequest = {
        type: jobType,
        prompt,
      };

      if (jobType === JobType.Image && imageUrl) {
        body.imageUrl = imageUrl;
      }
      if (jobType === JobType.MultiView) {
        body.viewImages = {
          front: frontImageUrl,
          left: leftImageUrl,
          right: rightImageUrl,
        };
      }
      if (provider !== 'auto') {
        body.provider = provider;
      }
      body.format = format;
      if (format === AssetFormat.FBX && skeletonPreset !== SkeletonPreset.None) {
        body.skeletonOptions = { preset: skeletonPreset };
      }
      if (format === AssetFormat.FBX && animationType !== AnimationType.None) {
        body.animationOptions = { type: animationType };
      }
      if (enableTextures) {
        body.textureOptions = { resolution: textureResolution, style: textureStyle };
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/v1/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error('Failed to create job');
      }

      const data = await res.json();
      setJobId(data.jobId);
      setStatus(data.status);

      // Poll for status
      pollJobStatus(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (id: string) => {
    while (true) {
      try {
        const pollHeaders: Record<string, string> = {};
        if (token) pollHeaders['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_URL}/v1/jobs/${id}`, { headers: pollHeaders });
        const data: JobStatusResponse = await res.json();

        setStatus(data.status);

        if (data.status === JobStatus.Succeeded && data.assetId) {
          // Get asset URL
          const assetHeaders: Record<string, string> = {};
          if (token) assetHeaders['Authorization'] = `Bearer ${token}`;
          const assetRes = await fetch(`${API_URL}/v1/assets/${data.assetId}`, { headers: assetHeaders });
          const assetData = await assetRes.json();

          // /storage/* is proxied through Next.js rewrites — use as-is (relative).
          // Absolute URLs (S3) are used directly.
          let modelUrl = assetData.downloadUrl;
          if (modelUrl.includes('localhost:3001')) {
            // Local dev without rewrites: strip host so browser uses same origin
            modelUrl = modelUrl.replace('http://localhost:3001', '');
          }
          console.log('[Page] Model URL:', modelUrl);
          setAssetUrl(modelUrl);

          // Fetch texture maps if available
          try {
            const texHeaders: Record<string, string> = {};
            if (token) texHeaders['Authorization'] = `Bearer ${token}`;
            const texRes = await fetch(`${API_URL}/v1/assets/${data.assetId}/textures`, { headers: texHeaders });
            if (texRes.ok) {
              setTextureMaps(await texRes.json());
            }
          } catch {
            // Textures are optional; silently ignore
          }

          break;
        } else if (data.status === JobStatus.Failed) {
          setError(data.error || 'Job failed');
          break;
        }

        if (data.status === JobStatus.Queued || data.status === JobStatus.Running) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          break;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to poll status');
        break;
      }
    }
  };

  return (
    <main className={styles.main}>
      <h1>AI 3D Model Generator</h1>

      {authMode && (
        <div className={styles.form} style={{ marginBottom: '2rem' }}>
          <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
          {authMode === 'register' && (
            <div className={styles.inputGroup}>
              <label>Name:</label>
              <input
                type="text"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Your name"
                data-testid="auth-name"
              />
            </div>
          )}
          <div className={styles.inputGroup}>
            <label>Email:</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
              data-testid="auth-email"
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Password:</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder={authMode === 'register' ? 'At least 8 characters' : 'Password'}
              data-testid="auth-password"
            />
          </div>
          {authError && <div className={styles.error}>{authError}</div>}
          <button
            onClick={handleAuth}
            disabled={authLoading}
            className={styles.button}
            data-testid="auth-submit"
          >
            {authLoading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Register'}
          </button>
          <button
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setAuthError(null);
            }}
            className={styles.button}
            style={{ background: '#666' }}
            data-testid="auth-toggle"
          >
            {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
      )}

      {token && (
        <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
          <button onClick={handleLogout} className={styles.button} style={{ background: '#c00', padding: '0.5rem 1rem' }} data-testid="logout-btn">
            Logout
          </button>
        </div>
      )}

      {token && <div className={styles.form}>
        <div className={styles.inputGroup}>
          <label>Type:</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value as JobType)}
          >
            <option value={JobType.Text}>Text to 3D</option>
            <option value={JobType.Image}>Image to 3D</option>
            <option value={JobType.MultiView}>Three-view to 3D</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>Provider:</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider | 'auto')}
          >
            <option value="auto">Auto</option>
            <option value={Provider.Hunyuan}>Tencent Hunyuan</option>
            <option value={Provider.Meshy}>Meshy</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>Format:</label>
          <select
            value={format}
            onChange={(e) => {
              const newFormat = e.target.value as AssetFormat;
              setFormat(newFormat);
              if (newFormat !== AssetFormat.FBX) {
                setSkeletonPreset(SkeletonPreset.None);
                setAnimationType(AnimationType.None);
              }
            }}
          >
            <option value={AssetFormat.GLB}>GLB (default)</option>
            <option value={AssetFormat.FBX}>FBX</option>
          </select>
        </div>

        {format === AssetFormat.FBX && (
          <div className={styles.inputGroup}>
            <label>Skeleton Preset:</label>
            <select
              value={skeletonPreset}
              onChange={(e) => setSkeletonPreset(e.target.value as SkeletonPreset)}
            >
              <option value={SkeletonPreset.None}>None</option>
              <option value={SkeletonPreset.Humanoid}>Humanoid</option>
              <option value={SkeletonPreset.Quadruped}>Quadruped</option>
            </select>
          </div>
        )}

        {format === AssetFormat.FBX && (
          <div className={styles.inputGroup}>
            <label>Animation:</label>
            <select
              value={animationType}
              onChange={(e) => setAnimationType(e.target.value as AnimationType)}
            >
              <option value="none">None</option>
              <option value="idle">Idle</option>
              <option value="walk">Walk</option>
              <option value="run">Run</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        )}

        <div className={styles.inputGroup}>
          <label>
            <input
              type="checkbox"
              checked={enableTextures}
              onChange={(e) => setEnableTextures(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Enable Texture Maps
          </label>
        </div>

        {enableTextures && (
          <>
            <div className={styles.inputGroup}>
              <label>Texture Resolution:</label>
              <select
                value={textureResolution}
                onChange={(e) => setTextureResolution(Number(e.target.value) as 512 | 1024 | 2048)}
              >
                <option value={512}>512</option>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label>Texture Style:</label>
              <select
                value={textureStyle}
                onChange={(e) => setTextureStyle(e.target.value as TextureStyle)}
              >
                <option value={TextureStyle.Photorealistic}>Photorealistic</option>
                <option value={TextureStyle.Cartoon}>Cartoon</option>
                <option value={TextureStyle.Stylized}>Stylized</option>
                <option value={TextureStyle.Flat}>Flat</option>
              </select>
            </div>
          </>
        )}

        <div className={styles.inputGroup}>
          <label>Prompt:</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a description of the 3D model..."
            maxLength={2000}
          />
        </div>

        {jobType === JobType.Image && (
          <div className={styles.inputGroup}>
            <label>Image URL:</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.png"
            />
          </div>
        )}

        {jobType === JobType.MultiView && (
          <>
            <div className={styles.inputGroup}>
              <label>Front Image URL:</label>
              <input
                type="url"
                value={frontImageUrl}
                onChange={(e) => setFrontImageUrl(e.target.value)}
                placeholder="https://example.com/front.png"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Left Image URL:</label>
              <input
                type="url"
                value={leftImageUrl}
                onChange={(e) => setLeftImageUrl(e.target.value)}
                placeholder="https://example.com/left.png"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Right Image URL:</label>
              <input
                type="url"
                value={rightImageUrl}
                onChange={(e) => setRightImageUrl(e.target.value)}
                placeholder="https://example.com/right.png"
              />
            </div>
          </>
        )}

        <button
          onClick={() => {
            console.log('Button clicked!', { prompt, loading, jobType });
            createJob();
          }}
          disabled={loading || !!validateInput()}
          className={styles.button}
        >
          {loading ? 'Processing...' : 'Generate 3D Model'}
        </button>
      </div>}

      {error && <div className={styles.error}>{error}</div>}

      {status && (status === JobStatus.Queued || status === JobStatus.Running) && (
        <div className={styles.loadingContainer}>
          <LoadingSpinner
            status={status === JobStatus.Queued ? 'Your request is in queue...' : 'Generating your 3D model...'}
          />
        </div>
      )}

      {status && !(status === JobStatus.Queued || status === JobStatus.Running) && (
        <div className={styles.status}>
          <h3>Status: {status}</h3>
          {jobId && <p>Job ID: {jobId}</p>}
        </div>
      )}

      {status === JobStatus.Succeeded && assetUrl && (
        <div className={styles.resultContainer}>
          {format === AssetFormat.FBX ? (
            <div className={styles.result}>
              <h3>Success!</h3>
              <p>FBX format is not previewable in the browser.</p>
              <a href={assetUrl} download className={styles.downloadButton}>
                Download FBX
              </a>
            </div>
          ) : (
            <>
              <div className={styles.modelViewerWrapper}>
                <ModelViewer
                  modelUrl={assetUrl}
                  height={400}
                  enableZoom={true}
                  enablePan={true}
                />
              </div>
              <div className={styles.result}>
                <h3>Success!</h3>
                <a href={assetUrl} download className={styles.downloadButton}>
                  Download GLB
                </a>
                {textureMaps && <TexturePanel textures={textureMaps} />}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
