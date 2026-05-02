import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLogto } from '@logto/react';
import { getLogtoPostLogoutRedirectUri, getLogtoRedirectUri } from './logto';

interface AuthUser {
  id: string;
  name?: string;
  email?: string;
}

interface AuthContextValue {
  isLogtoEnabled: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: AuthUser;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getDisplayName(claims: any): string | undefined {
  return claims?.name ?? claims?.username ?? claims?.email;
}

export function LocalAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(() => ({
    isLogtoEnabled: false,
    isAuthenticated: false,
    isLoading: false,
    signIn: async () => {
      window.alert('Logto が設定されていません。VITE_LOGTO_ENDPOINT と VITE_LOGTO_APP_ID を設定してください。');
    },
    signOut: async () => {}
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function LogtoAuthProvider({ children }: { children: ReactNode }) {
  const logto = useLogto();
  const [user, setUser] = useState<AuthUser | undefined>();
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsLoaded, setClaimsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadClaims() {
      if (!logto.isAuthenticated) {
        setUser(undefined);
        setClaimsLoaded(false);
        return;
      }

      setClaimsLoading(true);
      try {
        const claims = await logto.getIdTokenClaims();
        if (!cancelled && claims?.sub) {
          setUser({
            id: claims.sub,
            name: getDisplayName(claims),
            email: claims.email ?? undefined
          });
        }
      } finally {
        if (!cancelled) {
          setClaimsLoaded(true);
          setClaimsLoading(false);
        }
      }
    }

    void loadClaims();
    return () => {
      cancelled = true;
    };
  }, [logto.isAuthenticated]);

  const isUserResolving = logto.isAuthenticated && !user && !claimsLoaded;
  const value = useMemo<AuthContextValue>(() => ({
    isLogtoEnabled: true,
    isAuthenticated: logto.isAuthenticated,
    isLoading: logto.isLoading || claimsLoading || isUserResolving,
    user,
    signIn: async () => {
      logto.signIn(getLogtoRedirectUri());
    },
    signOut: async () => {
      await logto.signOut(getLogtoPostLogoutRedirectUri());
      setUser(undefined);
      setClaimsLoaded(false);
    }
  }), [claimsLoading, isUserResolving, logto, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within an auth provider');
  }
  return value;
}
