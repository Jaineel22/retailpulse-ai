import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import { useApi } from '../hooks/useApi';
import { analyticsApi, anomalyApi, recommendationApi } from '../services/api';
import { StatCard } from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import Card from '../components/Card';

async function loadDashboard() {
  const [summary, trend, topProducts, anomalies, stockout] = await Promise.all([
    analyticsApi.summary(),
    analyticsApi.salesTrend(30),
    analyticsApi.topProducts(6),
    anomalyApi.list({}),
    recommendationApi.stockout(),
  ]);
  return { summary, trend: trend.trend, topProducts: topProducts.products, anomalies: anomalies.anomalies, stockoutRisks: stockout.stockoutRisks };
}

const currency = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function Dashboard() {
  const { data, loading, error, reload } = useApi(useCallback(() => loadDashboard(), []));

  if (loading) return <LoadingSpinner label="Loading dashboard…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const { summary, trend, topProducts, anomalies, stockoutRisks } = data;
  const highRiskCount = stockoutRisks.filter((r) => r.riskLevel === 'HIGH').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Live KPIs from RetailPulse AI's backend analytics.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Sales" value={currency(summary.totalSales)} />
        <StatCard label="Total Orders" value={summary.totalOrders} />
        <StatCard label="Avg Order Value" value={currency(summary.averageOrderValue)} />
        <StatCard label="Low Stock" value={summary.lowStockProductCount} tone={summary.lowStockProductCount > 0 ? 'warning' : 'default'} />
        <StatCard label="Out of Stock" value={summary.outOfStockProductCount} tone={summary.outOfStockProductCount > 0 ? 'danger' : 'default'} />
        <StatCard label="Anomalies" value={anomalies.length} tone={anomalies.length > 0 ? 'warning' : 'default'} />
      </div>

      {highRiskCount > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{highRiskCount}</strong> product{highRiskCount === 1 ? ' is' : 's are'} at HIGH stockout risk. See the{' '}
          <Link to="/recommendations" className="font-medium underline">
            Recommendations
          </Link>{' '}
          page for details.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Sales Trend (last 30 days)">
          {trend.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No orders in this window yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => currency(value)} />
                <Line type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Top Products by Revenue">
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No sales recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="productName" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => currency(value)} />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
