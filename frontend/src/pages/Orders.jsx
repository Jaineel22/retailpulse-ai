import { useCallback, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { orderApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function Orders() {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useApi(useCallback(() => orderApi.list(status || undefined), [status]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">Recent orders across all vendors.</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingSpinner label="Loading orders…" />}
      {!loading && error && <ErrorState message={error.message} onRetry={reload} />}
      {!loading && !error && data.orders.length === 0 && (
        <EmptyState title="No orders found" message={status ? `No orders with status "${status}".` : 'No orders have been placed yet.'} />
      )}
      {!loading && !error && data.orders.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.orders.map((o) => (
                <tr key={o._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{o.orderNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{o.vendor?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-600">{o.items?.length ?? 0}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">${Number(o.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
