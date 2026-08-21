import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, getToken, setToken } from '../services/api';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { user: me } = await authApi.me();
        setUser(me);
      } catch {
        setToken(null); // token expired/invalid — backend is authoritative here
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: loggedInUser } = await authApi.login(email, password);
    setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), isLoading, login, logout }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
