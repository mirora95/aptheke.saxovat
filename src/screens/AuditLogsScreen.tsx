import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Badge, Button, Card, Input } from '../components/UI';
import { apiClient } from '../services/apiClient';
import type { ApiListResponse } from '../types';

interface AuditLogEntry {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  createdAt: string;
}

const ENTITY_TYPES = ['User', 'Medicine', 'Category', 'Order', 'Payment'];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export const AuditLogsScreen: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadLogs = async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (entityType) params.set('entityType', entityType);
      if (search) params.set('search', search);
      params.set('page', String(p));
      params.set('pageSize', String(pageSize));
      const response = await apiClient.get<ApiListResponse<AuditLogEntry>>(`/audit-logs?${params.toString()}`);
      setLogs(response.items);
      setTotal(response.total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(1); }, [entityType, search]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-2 text-sm text-gray-500">Track all administrative actions across the system.</p>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <Card className="p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <label className="text-sm font-medium text-gray-700 block mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={e => { setEntityType(e.target.value); setPage(1); }}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1 max-w-md">
            <Input
              label="Search"
              placeholder="Search by action or description"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Button variant="outline" onClick={() => loadLogs(page)} isLoading={loading}>
            <History size={16} className="mr-2" /> Refresh
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="text-sm text-gray-500">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900">No audit logs found</h2>
          <p className="mt-2 text-sm text-gray-500">Try different filter criteria.</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Timestamp</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Actor</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Entity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="py-3 px-4 font-medium">{log.actorName}</td>
                    <td className="py-3 px-4"><Badge>{log.action}</Badge></td>
                    <td className="py-3 px-4 text-gray-600">{log.entityType}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-gray-500">{total} total entries</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadLogs(p); }}>
                  Previous
                </Button>
                <span className="text-sm text-gray-500 self-center">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); loadLogs(p); }}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
