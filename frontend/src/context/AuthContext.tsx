import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setToken, getToken } from '../utils/api';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  tenant_id?: string;
  is_platform_admin?: boolean;
  is_tenant_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemo: boolean;
  demoExpiresAt: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  loginDemo: (name: string, email: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemo: false,
  demoExpiresAt: null,
  login: async () => {},
  register: async () => {},
  loginDemo: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [demoExpiresAt, setDemoExpiresAt] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await api.get('/auth/me');
      setUser(data);
      // Register for push notifications when authenticated (native only, silently no-ops on web)
      try {
        const { registerForPushNotificationsAsync } = await import('../utils/pushNotifications');
        registerForPushNotificationsAsync();
      } catch {}
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    await setToken(data.token);
    setUser(data);
  };

  const register = async (regData: any) => {
    const { data } = await api.post('/auth/register', regData);
    await setToken(data.token);
    setUser(data);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await setToken(null);
    setUser(null);
    setIsDemo(false);
    setDemoExpiresAt(null);
  };

  const loginDemo = async (name: string, email: string, role: string) => {
    const { data } = await api.post('/auth/demo-access', { name, email, role });
    await setToken(data.token);
    setUser(data);
    setIsDemo(true);
    setDemoExpiresAt(data.demo_expires_at);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, demoExpiresAt, login, register, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
