import { useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { recommendationApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Card from '../components/Card';

export default function Recommendations() {
  const { data, loading, error, reload } = useApi(useCallback(() => recommendationApi.all(), []));

  if (loading) return <LoadingSpinner label="Computing recommendations…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const { stockoutRisks, reorderRecommendations, vendorRecommendations } = data;
  const actionableStockout = stockoutRisks.filter((r) => r.riskLevel !== 'LOW');
  const actionableReorder = reorderRecommendations.filter((r) => r.recommendedQuantity > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Recommendations</h1>
        <p className="text-sm text-slate-500">Deterministic, rule-based operational recommendations — no LLM involved.</p>
      </div>

      <Card title={`Stockout Risk (${actionableStockout.length} at risk)`}>
        {actionableStockout.length === 0 ? (
          <EmptyState title="No stockout risk detected" message="Every product currently has healthy stock relative to demand." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Current Stock</th>
                  <th className="px-3 py-2">Forecast Demand/day</th>
                  <th className="px-3 py-2">Days of Cover</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actionableStockout.map((r) => (
                  <tr key={r.productId}>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.productName}</td>
                    <td className="px-3 py-2 text-slate-600">{r.currentStock}</td>
                    <td className="px-3 py-2 text-slate-600">{r.forecastDailyDemand ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.daysOfCover ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={r.riskLevel} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Reorder Recommendations (${actionableReorder.length} needed)`}>
        {actionableReorder.length === 0 ? (
          <EmptyState title="No reorders needed" message="Current stock meets target levels for every product." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Recommended Quantity</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actionableReorder.map((r) => (
                  <tr key={r.productId}>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.productName}</td>
                    <td className="px-3 py-2 font-semibold text-indigo-600">{r.recommendedQuantity}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={r.riskLevel} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Vendor Concerns (${vendorRecommendations.length})`}>
        {vendorRecommendations.length === 0 ? (
          <EmptyState title="No vendor concerns" message="No vendors currently show a meaningful cancellation-rate or activity concern." />
        ) : (
          <ul className="space-y-2">
            {vendorRecommendations.map((v) => (
              <li key={v.vendorId} className="flex items-start justify-between rounded-md border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-slate-800">{v.vendorName}</p>
                  <p className="text-xs text-slate-500">{v.reason}</p>
                </div>
                <StatusBadge value={v.severity} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
