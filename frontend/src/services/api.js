/**
 * Centralized API client. Every backend call in the app goes through here —
 * components never call fetch()/axios directly. The backend remains the
 * source of truth for both authentication and authorization; this file only
 * attaches the JWT and normalizes responses/errors.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'retailpulse_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiClientError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiClientError('Unable to reach the RetailPulse API. Is the backend running?', 0);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    // no JSON body
  }

  if (!res.ok) {
    const message = payload?.message || `Request failed (${res.status})`;
    throw new ApiClientError(message, res.status, payload?.errors);
  }

  return payload?.data;
}

// --- Auth -------------------------------------------------------------
export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password }, auth: false }),
  me: () => request('/auth/me'),
};

// --- Vendors ------------------------------------------------------------
export const vendorApi = {
  list: () => request('/vendors'),
};

// --- Products -----------------------------------------------------------
export const productApi = {
  list: () => request('/products'),
};

// --- Inventory ----------------------------------------------------------
export const inventoryApi = {
  list: () => request('/inventory'),
};

// --- Orders ---------------------------------------------------------------
export const orderApi = {
  list: (status) => request(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
};

// --- Analytics ------------------------------------------------------------
export const analyticsApi = {
  summary: () => request('/analytics/summary'),
  salesTrend: (days = 30) => request(`/analytics/sales-trend?days=${days}`),
  topProducts: (limit = 8) => request(`/analytics/top-products?limit=${limit}`),
  vendorPerformance: () => request('/analytics/vendor-performance'),
};

// --- Predictions ------------------------------------------------------------
export const predictionApi = {
  listForProduct: (productId) => request(`/predictions/${productId}`),
  run: (productId, horizonDays) => request('/predictions/run', { method: 'POST', body: { productId, horizonDays } }),
};

// --- Anomalies ------------------------------------------------------------
export const anomalyApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/anomalies${qs ? `?${qs}` : ''}`);
  },
  run: (productId) => request('/anomalies/run', { method: 'POST', body: { productId } }),
};

// --- Recommendations ------------------------------------------------------------
export const recommendationApi = {
  all: () => request('/recommendations'),
  stockout: () => request('/recommendations/stockout'),
  reorder: () => request('/recommendations/reorder'),
  vendors: () => request('/recommendations/vendors'),
};

// --- Integrations ------------------------------------------------------------
export const integrationApi = {
  list: () => request('/integrations'),
  syncLogs: (integrationId) => request(`/integrations/${integrationId}/sync-logs`),
  sync: (integrationId) => request(`/integrations/${integrationId}/sync`, { method: 'POST' }),
};

// --- AI Assistant ------------------------------------------------------------
export const aiApi = {
  ask: (question) => request('/ai/ask', { method: 'POST', body: { question } }),
};

export { ApiClientError };
