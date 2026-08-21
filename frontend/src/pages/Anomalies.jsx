import { useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { anomalyApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

export default function Anomalies() {
  const { data, loading, error, reload } = useApi(useCallback(() => anomalyApi.list({}), []));

  if (loading) return <LoadingSpinner label="Loading anomalies…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const anomalies = data.anomalies || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Anomalies &amp; Alerts</h1>
        <p className="text-sm text-slate-500">
          Results from the Isolation Forest anomaly detector (Python ML service), persisted by the backend.
        </p>
      </div>

      {anomalies.length === 0 ? (
        <EmptyState title="No anomalies recorded" message="Run anomaly detection from a product's prediction workflow to populate this list." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {anomalies.map((a) => (
                <tr key={a._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {a.product?.name} <span className="font-mono text-xs text-slate-400">({a.product?.sku})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(a.timestamp).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={a.severity} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.score}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
