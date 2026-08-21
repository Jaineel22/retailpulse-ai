import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { analyticsApi, anomalyApi, recommendationApi, ApiClientError } from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    analyticsApi: { summary: vi.fn(), salesTrend: vi.fn(), topProducts: vi.fn() },
    anomalyApi: { list: vi.fn() },
    recommendationApi: { stockout: vi.fn() },
  };
});

function mockHappyPath() {
  analyticsApi.summary.mockResolvedValue({
    totalSales: 12500.5,
    totalOrders: 42,
    averageOrderValue: 297.63,
    lowStockProductCount: 2,
    outOfStockProductCount: 1,
  });
  analyticsApi.salesTrend.mockResolvedValue({ trend: [{ date: '2026-08-01', sales: 500, orders: 3 }] });
  analyticsApi.topProducts.mockResolvedValue({ products: [{ productId: 'p1', productName: 'Widget', quantitySold: 10, revenue: 500 }] });
  anomalyApi.list.mockResolvedValue({ anomalies: [] });
  recommendationApi.stockout.mockResolvedValue({ stockoutRisks: [] });
}

describe('Dashboard page', () => {
  it('renders real KPI values retrieved from the backend', async () => {
    mockHappyPath();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('stat-total-sales')).toHaveTextContent('$12,500.5');
    expect(screen.getByTestId('stat-total-orders')).toHaveTextContent('42');
    expect(screen.getByTestId('stat-low-stock')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-out-of-stock')).toHaveTextContent('1');
  });

  it('renders an error state when the backend request fails', async () => {
    analyticsApi.summary.mockRejectedValue(new ApiClientError('Unable to reach the RetailPulse API. Is the backend running?', 0));
    analyticsApi.salesTrend.mockResolvedValue({ trend: [] });
    analyticsApi.topProducts.mockResolvedValue({ products: [] });
    anomalyApi.list.mockResolvedValue({ anomalies: [] });
    recommendationApi.stockout.mockResolvedValue({ stockoutRisks: [] });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to reach the retailpulse api/i);
  });
});
