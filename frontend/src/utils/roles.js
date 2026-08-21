/**
 * Mirrors the backend's RBAC roles for UI-visibility purposes ONLY (e.g.
 * hiding a "Trigger Sync" button an analyst can't use). This is never a
 * security boundary — the backend re-checks every request regardless, and a
 * user could still call the API directly. See ProtectedRoute.jsx.
 */
export const ROLES = { ADMIN: 'admin', OPERATOR: 'operator', ANALYST: 'analyst' };

export const WRITE_ROLES = [ROLES.ADMIN, ROLES.OPERATOR];

export function canTriggerOperations(user) {
  return Boolean(user && WRITE_ROLES.includes(user.role));
}

export function isAdmin(user) {
  return Boolean(user && user.role === ROLES.ADMIN);
}
