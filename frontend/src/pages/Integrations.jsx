import { useCallback, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { integrationApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Card from '../components/Card';
import RoleGate from '../components/RoleGate';
import { ROLES } from '../utils/roles';

function SyncLogs({ integrationId }) {
  const { data, loading, error } = useApi(useCallback(() => integrationApi.syncLogs(integrationId), [integrationId]));

  if (loading) return <LoadingSpinner label="Loading sync history…" />;
  if (error) return <ErrorState message={error.message} />;

  const logs = data.syncLogs || [];
  if (logs.length === 0) return <EmptyState title="No sync runs yet" />;

  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-3 py-2">Started</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">Created</th>
          <th className="px-3 py-2">Updated</th>
          <th className="px-3 py-2">Skipped</th>
          <th className="px-3 py-2">Error</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {logs.map((log) => {
          const c = log.counts || {};
          const created = c.productsCreated + c.inventoryCreated + c.ordersCreated;
          const updated = c.productsUpdated + c.inventoryUpdated + c.ordersUpdated;
          const skipped = c.productsSkipped + c.inventorySkipped + c.ordersSkipped;
          return (
            <tr key={log._id}>
              <td className="px-3 py-2 text-slate-600">{new Date(log.startedAt).toLocaleString()}</td>
              <td className="px-3 py-2">
                <StatusBadge value={log.status} />
              </td>
              <td className="px-3 py-2 text-slate-600">{created}</td>
              <td className="px-3 py-2 text-slate-600">{updated}</td>
              <td className="px-3 py-2 text-slate-600">{skipped}</td>
              <td className="px-3 py-2 text-xs text-red-600">{log.error || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function Integrations() {
  const { data, loading, error, reload } = useApi(useCallback(() => integrationApi.list(), []));
  const [expandedId, setExpandedId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [syncError, setSyncError] = useState('');

  async function handleSync(id) {
    setSyncingId(id);
    setSyncError('');
    try {
      await integrationApi.sync(id);
      reload();
      setExpandedId(id);
    } catch (err) {
      setSyncError(err.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  if (loading) return <LoadingSpinner label="Loading integrations…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const integrations = data.integrations || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500">Commerce provider connections synced into RetailPulse (Phase 2 sync engine).</p>
      </div>

      {syncError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{syncError}</p>}

      {integrations.length === 0 ? (
        <EmptyState title="No integrations configured" />
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => (
            <Card key={integration._id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{integration.name}</p>
                  <p className="text-xs text-slate-500">Provider: {integration.provider}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={integration.isActive ? 'active' : 'inactive'} />
                  {integration.lastSyncStatus && <StatusBadge value={integration.lastSyncStatus} />}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === integration._id ? null : integration._id)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    {expandedId === integration._id ? 'Hide Logs' : 'View Sync Logs'}
                  </button>
                  <RoleGate roles={[ROLES.ADMIN, ROLES.OPERATOR]}>
                    <button
                      type="button"
                      onClick={() => handleSync(integration._id)}
                      disabled={syncingId === integration._id || !integration.isActive}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {syncingId === integration._id ? 'Syncing…' : 'Trigger Sync'}
                    </button>
                  </RoleGate>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Last sync: {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'never'}
              </p>
              {expandedId === integration._id && (
                <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-4">
                  <SyncLogs integrationId={integration._id} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
