import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthSession, User, UserRole } from '../types';
import { AUTH_UNAUTHORIZED_EVENT, authService } from '../services';
import {
  clearStoredAuthSession,
  readStoredAuthSession,
  writeStoredAuthSession,
} from '../services/authSession';

interface AuthContextType {
  session: AuthSession | null;
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<AuthSession>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const getRoleHomePath = (role: UserRole | null | undefined) => {
  switch (role) {
    case UserRole.CUSTOMER:
      return '/';
    case UserRole.PHARMACIST:
      return '/';
    case UserRole.SUPERADMIN:
      return '/';
    default:
      return '/login';
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const storedSession = readStoredAuthSession();
        const restoredSession = await authService.restoreSession(storedSession);

        if (!mounted) return;

        if (restoredSession) {
          setSession(restoredSession);
          writeStoredAuthSession(restoredSession);
        } else {
          clearStoredAuthSession();
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null);
      clearStoredAuthSession();
      setIsLoading(false);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await authService.login({ email, password });
      setSession(response.session);
      writeStoredAuthSession(response.session);
      return response.session;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setSession(null);
    clearStoredAuthSession();
    void authService.logout();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        role: session?.user.role || null,
        isAuthenticated: !!session?.user,
        isLoading,
        accessToken: session?.tokens.accessToken ?? null,
        refreshToken: session?.tokens.refreshToken ?? null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
