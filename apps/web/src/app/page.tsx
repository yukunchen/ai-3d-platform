'use client';

import { useState } from 'react';
import { JobType, JobStatus, CreateJobRequest, JobStatusResponse } from '@ai-3d-platform/shared';
import LoadingSpinner from '../components/LoadingSpinner';
import ModelViewer from '../components/ModelViewer';
import styles from './page.module.css';

export default function Home() {
  const [jobType, setJobType] = useState<JobType>(JobType.Text);
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const createJob = async () => {
    setLoading(true);
    setError(null);
    setAssetUrl(null);

    try {
      const body: CreateJobRequest = {
        type: jobType,
        prompt,
      };

      if (jobType === JobType.Image && imageUrl) {
        body.imageUrl = imageUrl;
      }

      const res = await fetch(`${API_URL}/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const res = await fetch(`${API_URL}/v1/jobs/${id}`);
        const data: JobStatusResponse = await res.json();

        setStatus(data.status);

        if (data.status === JobStatus.Succeeded && data.assetId) {
          // Get asset URL
          const assetRes = await fetch(`${API_URL}/v1/assets/${data.assetId}`);
          const assetData = await assetRes.json();

          // Convert to proxy-friendly URL
          let modelUrl = assetData.downloadUrl;
          // If it's a relative path starting with /storage, prepend the frontend origin
          if (modelUrl.startsWith('/storage/')) {
            modelUrl = window.location.origin + modelUrl;
          } else if (modelUrl.includes('localhost:3001')) {
            modelUrl = modelUrl.replace('http://localhost:3001', '');
            modelUrl = window.location.origin + modelUrl;
          }
          console.log('[Page] Model URL:', modelUrl);
          setAssetUrl(modelUrl);
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

      <div className={styles.form}>
        <div className={styles.inputGroup}>
          <label>Type:</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value as JobType)}
          >
            <option value={JobType.Text}>Text to 3D</option>
            <option value={JobType.Image}>Image to 3D</option>
          </select>
        </div>

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

        <button
          onClick={() => {
            console.log('Button clicked!', { prompt, loading, jobType });
            createJob();
          }}
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Processing...' : 'Generate 3D Model'}
        </button>
      </div>

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
          </div>
        </div>
      )}
    </main>
  );
}
