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

interface HistoryTableProps {
  data: JobHistoryRecord[];
  statusFilter: string;
  typeFilter: string;
  onStatusFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const statusColors: Record<string, string> = {
  queued: '#6b7280',
  running: '#2563eb',
  succeeded: '#16a34a',
  failed: '#dc2626',
};

export default function HistoryTable({
  data,
  statusFilter,
  typeFilter,
  onStatusFilterChange,
  onTypeFilterChange,
  page,
  totalPages,
  onPageChange,
}: HistoryTableProps) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <label>
          Status:{' '}
          <select
            data-testid="status-filter"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label>
          Type:{' '}
          <select
            data-testid="type-filter"
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
          >
            <option value="all">All</option>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="multiview">Multiview</option>
          </select>
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>Job ID</th>
            <th style={{ padding: '0.5rem' }}>Type</th>
            <th style={{ padding: '0.5rem' }}>Prompt</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th style={{ padding: '0.5rem' }}>Created At</th>
            <th style={{ padding: '0.5rem' }}>Cost</th>
            <th style={{ padding: '0.5rem' }}>Asset</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                No jobs found
              </td>
            </tr>
          ) : (
            data.map((job) => (
              <tr key={job.jobId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {job.jobId.slice(0, 8)}...
                </td>
                <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{job.type}</td>
                <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.prompt.length > 40 ? job.prompt.slice(0, 40) + '...' : job.prompt}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span
                    data-testid="status-badge"
                    style={{
                      display: 'inline-block',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      color: '#fff',
                      backgroundColor: statusColors[job.status] || '#6b7280',
                    }}
                  >
                    {job.status}
                  </span>
                </td>
                <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                  {new Date(job.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {job.cost !== undefined ? `$${(job.cost / 100).toFixed(2)}` : '-'}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {job.assetId ? (
                    <a href={`/v1/assets/${job.assetId}`} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          style={{ padding: '0.5rem 1rem' }}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages || 1}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          style={{ padding: '0.5rem 1rem' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
