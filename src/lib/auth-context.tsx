'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './msal';
import { apiClient, ApiError } from './api-client';
import type { User, AuthState } from '@/types/auth';

interface AuthContextType extends AuthState {
  loginWithMicrosoft: () => void;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthResponse {
  token: string;
  user: User;
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return 'No se pudo conectar con el servidor. Verifica que el backend este disponible.';
      case 'AUTH_MICROSOFT_TOKEN_EXPIRED':
      case 'AUTH_TOKEN_EXPIRED':
        return 'Tu sesion con Microsoft expiro. Intenta iniciar sesion nuevamente.';
      case 'AUTH_CONFIG_ERROR':
      case 'DB_CONNECTION_ERROR':
      case 'DB_AUTH_FAILED':
        return 'El servicio de autenticacion no esta disponible en este momento.';
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Authentication failed';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { instance, accounts } = useMsal();
  const isMsalAuthenticated = useIsAuthenticated();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [processedAccount, setProcessedAccount] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('tee_token');
    const userStr = localStorage.getItem('tee_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        setState({ user, token, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('tee_token');
        localStorage.removeItem('tee_user');
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    if (!isMsalAuthenticated || accounts.length === 0) return;
    if (state.isAuthenticated) return;

    const account = accounts[0];
    const accountKey = account.homeAccountId;
    if (processedAccount === accountKey) return;
    setProcessedAccount(accountKey);

    async function sendTokenToBackend() {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));
        setError(null);

        console.log('[Auth] MSAL account detected:', account.username);

        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });

        console.log('[Auth] Sending token to backend...');
        const authResponse = await apiClient<AuthResponse>('/api/auth/microsoft', {
          method: 'POST',
          body: JSON.stringify({ idToken: tokenResponse.idToken }),
        });
        console.log('[Auth] Backend validated. role:', authResponse.user?.role);

        localStorage.setItem('tee_token', authResponse.token);
        localStorage.setItem('tee_user', JSON.stringify(authResponse.user));

        setState({
          user: authResponse.user,
          token: authResponse.token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (err) {
        const message = getAuthErrorMessage(err);

        if (err instanceof ApiError) {
          console.error('[Auth] Error', {
            status: err.status,
            code: err.code,
            message: err.message,
            details: err.details,
          });
        } else {
          console.error('[Auth] Error', err);
        }

        setError(message);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }

    sendTokenToBackend();
  }, [isMsalAuthenticated, accounts, instance, state.isAuthenticated, processedAccount]);

  const loginWithMicrosoft = useCallback(() => {
    setError(null);
    setProcessedAccount(null);
    instance.loginRedirect(loginRequest);
  }, [instance]);

  const logout = useCallback(() => {
    localStorage.removeItem('tee_token');
    localStorage.removeItem('tee_user');
    setProcessedAccount(null);
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    setError(null);
    instance.logoutRedirect({ postLogoutRedirectUri: '/' });
  }, [instance]);

  return (
    <AuthContext.Provider value={{ ...state, loginWithMicrosoft, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
