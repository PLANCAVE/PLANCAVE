import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { login as apiLogin } from '../api';

interface User {
  id: number;
  email: string;
  role: 'admin' | 'designer' | 'customer';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    const { access_token } = response.data;
    
    // Decode JWT to get user info (basic decode, not secure validation)
    const payload = JSON.parse(atob(access_token.split('.')[1]));
    console.log('JWT Payload:', JSON.stringify(payload, null, 2));
    
    // flask-jwt-extended stores identity in 'sub' claim
    const identity = payload.sub || payload;
    console.log('Identity:', JSON.stringify(identity, null, 2));
    
    const userData: User = {
      id: identity.id,
      email: email, // Use the email from login form
      role: identity.role,
    };
    
    console.log('User Data:', JSON.stringify(userData, null, 2));
    console.log('isAdmin will be:', userData.role === 'admin');
    
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    isDesigner: user?.role === 'designer' || user?.role === 'admin', // Admin can do everything designers can
    isCustomer: user?.role === 'customer' || user?.role === 'admin', // Admin can do everything customers can
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
