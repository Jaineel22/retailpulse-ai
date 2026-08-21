import { useAuth } from '../hooks/useAuth';

/**
 * UI-visibility gate only (see utils/roles.js) — never a security control.
 */
export default function RoleGate({ roles, children }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return null;
  return children;
}
