'use client';

import { JobStatus, JobType } from '@ai-3d-platform/shared';

interface JobHistoryRecord {
  jobId: string;
  type: JobType;
  prompt: string;
  status: JobStatus;
  createdAt: number;
  assetId: string | null;
  cost?: number;
  thumbnailUrl?: string;
}

interface JobCardProps {
  job: JobHistoryRecord;
}

const statusColors: Record<string, string> = {
  queued: '#6b7280',
  running: '#2563eb',
  succeeded: '#16a34a',
  failed: '#dc2626',
};

export default function JobCard({ job }: JobCardProps) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {job.thumbnailUrl && (
        <img
          src={job.thumbnailUrl}
          alt={`Thumbnail for ${job.jobId}`}
          style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '0.25rem' }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>
          {job.jobId.slice(0, 8)}...
        </span>
        <span
          style={{
            padding: '0.15rem 0.5rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            color: '#fff',
            backgroundColor: statusColors[job.status] || '#6b7280',
          }}
        >
          {job.status}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '0.9rem', textTransform: 'capitalize' }}>{job.type}</p>
      <p
        style={{
          margin: 0,
          fontSize: '0.85rem',
          color: '#374151',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {job.prompt}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280' }}>
        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
        <span>{job.cost !== undefined ? `$${(job.cost / 100).toFixed(2)}` : '-'}</span>
      </div>
      {job.assetId && (
        <a
          href={`/v1/assets/${job.assetId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.85rem', color: '#2563eb' }}
        >
          View Asset
        </a>
      )}
    </div>
  );
}
