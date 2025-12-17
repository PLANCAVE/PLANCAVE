import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, refreshAccessToken, setAccessToken } from '../api';

interface User {
  id: number;
  email: string;
  role: 'admin' | 'designer' | 'customer';
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  profile_picture_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUserProfile: (profile: Partial<User>) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDesigner: boolean;
  isCustomer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Logout function
  const logout = () => {
    // Keep behavior simple and quiet: clear auth state without noisy alerts/logging
    // Also clear any legacy localStorage values from previous builds.
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setAccessToken(null);
    setToken(null);
    setUser(null);
    apiLogout().catch(() => {
      // ignore logout errors
    });
  };

  // No automatic token expiry or inactivity-based logout on the client.

  // Initial load
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Legacy cleanup in case old builds left tokens in storage.
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');

        // Attempt to restore session via HttpOnly refresh cookie.
        const refreshResp = await refreshAccessToken();
        const accessToken = refreshResp.data?.access_token as string | undefined;
        if (!accessToken) {
          setAccessToken(null);
          setToken(null);
          setUser(null);
          return;
        }

        setAccessToken(accessToken);
        setToken(accessToken);

        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          const rawId = payload.sub ?? payload.id;
          const id = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
          const role = (payload.role as User['role']) ?? 'customer';
          const emailClaim = (payload.email as string) || '';

          const userData: User = {
            id,
            email: emailClaim,
            role,
          };
          setUser(userData);
        } catch {
          // If JWT can't be decoded, drop session.
          setAccessToken(null);
          setToken(null);
          setUser(null);
        }
      } catch {
        setAccessToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    const { access_token } = response.data;
    
    // Decode JWT to get user info (basic decode, not secure validation)
    const payload = JSON.parse(atob(access_token.split('.')[1]));

    // New JWT format (flask-jwt-extended):
    //   - identity is stored in 'sub' claim as a string user_id
    //   - role and email are stored as top-level custom claims
    const rawId = payload.sub ?? payload.id;
    const id = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
    const role = (payload.role as User['role']) ?? 'customer';
    const emailClaim = (payload.email as string) || email;

    const userData: User = {
      id,
      email: emailClaim,
      role,
    };

    setAccessToken(access_token);
    setToken(access_token);
    setUser(userData);
  };

  const refreshUserProfile = (profile: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...profile };

      return updated;
    });
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    refreshUserProfile,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    isDesigner: user?.role === 'designer',
    isCustomer: user?.role === 'customer',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
