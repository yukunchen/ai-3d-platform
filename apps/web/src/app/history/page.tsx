'use client';

import { useState, useEffect, useCallback } from 'react';
import HistoryTable from '../../components/HistoryTable';

interface JobHistoryRecord {
  jobId: string;
  type: string;
  prompt: string;
  status: string;
  createdAt: number;
  assetId: string | null;
  cost?: number;
  thumbnailUrl?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function HistoryPage() {
  const [data, setData] = useState<JobHistoryRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async (page: number, status: string, type: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);

      const res = await fetch(`/v1/jobs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch jobs');

      const json = await res.json();
      setData(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(pagination.page, statusFilter, typeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    fetchJobs(1, value, typeFilter);
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    fetchJobs(1, statusFilter, value);
  };

  const handlePageChange = (page: number) => {
    fetchJobs(page, statusFilter, typeFilter);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1>Job History</h1>
      {error && (
        <div style={{ color: '#dc2626', marginBottom: '1rem' }}>Error: {error}</div>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <HistoryTable
          data={data as any}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatusFilterChange={handleStatusChange}
          onTypeFilterChange={handleTypeChange}
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
