import { useCallback } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { analyticsApi } from '../services/api';
import { StatCard } from '../components/Card';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

async function loadAnalytics() {
  const [summary, trend, topProducts, vendorPerformance] = await Promise.all([
    analyticsApi.summary(),
    analyticsApi.salesTrend(30),
    analyticsApi.topProducts(10),
    analyticsApi.vendorPerformance(),
  ]);
  return { summary, trend: trend.trend, topProducts: topProducts.products, vendors: vendorPerformance.vendors };
}

const currency = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function Analytics() {
  const { data, loading, error, reload } = useApi(useCallback(() => loadAnalytics(), []));

  if (loading) return <LoadingSpinner label="Loading analytics…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const { summary, trend, topProducts, vendors } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Backend MongoDB aggregation results — the frontend only renders them.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Total Sales (all time)" value={currency(summary.totalSales)} />
        <StatCard label="Total Orders" value={summary.totalOrders} />
        <StatCard label="Avg Order Value" value={currency(summary.averageOrderValue)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Sales Value Trend (30 days)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => currency(value)} />
              <Area type="monotone" dataKey="sales" stroke="#4f46e5" fill="#c7d2fe" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Order Volume Trend (30 days)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="orders" fill="#0ea5e9" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Sales by Vendor">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={vendors}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => currency(value)} />
              <Bar dataKey="salesValue" fill="#16a34a" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top Products by Revenue">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="productName" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => currency(value)} />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Vendor Performance">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Products</th>
                <th className="px-3 py-2">Orders</th>
                <th className="px-3 py-2">Sales Value</th>
                <th className="px-3 py-2">Avg Order Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((v) => (
                <tr key={v.vendorId}>
                  <td className="px-3 py-2 font-medium text-slate-800">{v.name}</td>
                  <td className="px-3 py-2 text-slate-600">{v.productCount}</td>
                  <td className="px-3 py-2 text-slate-600">{v.orderCount}</td>
                  <td className="px-3 py-2 text-slate-600">{currency(v.salesValue)}</td>
                  <td className="px-3 py-2 text-slate-600">{currency(v.averageOrderValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
