import { useCallback, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { productApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

export default function Products() {
  const { data, loading, error, reload } = useApi(useCallback(() => productApi.list(), []));
  const [search, setSearch] = useState('');

  if (loading) return <LoadingSpinner label="Loading products…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const products = data.products || [];
  const filtered = search
    ? products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">{products.length} product(s) in the catalog.</p>
        </div>
        <input
          type="search"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No products found" message={search ? 'Try a different search.' : 'No products have been created yet.'} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.sku}</td>
                  <td className="px-4 py-3 text-slate-600">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.vendor?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">${Number(p.price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={p.isActive ? 'active' : 'inactive'} />
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
