import { useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { inventoryApi, recommendationApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

async function loadInventory() {
  const [inventoryRes, stockoutRes] = await Promise.all([inventoryApi.list(), recommendationApi.stockout()]);
  const riskByProductId = new Map(stockoutRes.stockoutRisks.map((r) => [r.productId, r]));
  return { inventory: inventoryRes.inventory, riskByProductId };
}

export default function Inventory() {
  const { data, loading, error, reload } = useApi(useCallback(() => loadInventory(), []));

  if (loading) return <LoadingSpinner label="Loading inventory…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const { inventory, riskByProductId } = data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-500">{inventory.length} record(s). Stockout risk comes from the recommendation engine.</p>
      </div>

      {inventory.length === 0 ? (
        <EmptyState title="No inventory records" message="Inventory hasn't been set up for any product yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Reserved</th>
                <th className="px-4 py-3">Reorder Threshold</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Stockout Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((item) => {
                const risk = riskByProductId.get(item.product?._id);
                return (
                  <tr key={item._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.product?.name} <span className="font-mono text-xs text-slate-400">({item.product?.sku})</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-slate-600">{item.reservedQuantity}</td>
                    <td className="px-4 py-3 text-slate-600">{item.reorderThreshold}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="px-4 py-3">{risk ? <StatusBadge value={risk.riskLevel} /> : <span className="text-xs text-slate-400">n/a</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
