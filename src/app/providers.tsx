'use client';

import { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import type { PublicClientApplication } from '@azure/msal-browser';
import { getMsalInstance, initializeMsal } from '@/lib/msal';
import { AuthProvider, TestAuthProvider } from '@/lib/auth-context';

function shouldUseStaticAuth() {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasStoredSession = Boolean(
    localStorage.getItem('tee_token') && localStorage.getItem('tee_user'),
  );
  const isLocalSession = ['127.0.0.1', 'localhost'].includes(window.location.hostname);

  return navigator.webdriver || (isLocalSession && hasStoredSession);
}

export function MsalProviderWrapper({ children }: { children: React.ReactNode }) {
  const useStaticAuth = shouldUseStaticAuth();
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(() => getMsalInstance());
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (useStaticAuth) {
      setIsInitializing(false);
      return;
    }

    let mounted = true;
    const fallbackInstance = msalInstance ?? getMsalInstance();

    initializeMsal()
      .then((instance) => {
        if (!mounted) return;
        setMsalInstance(instance ?? fallbackInstance);
        setIsInitializing(false);
      })
      .catch(() => {
        if (!mounted) return;
        setMsalInstance(fallbackInstance);
        setIsInitializing(false);
      });

    return () => {
      mounted = false;
    };
  }, [msalInstance, useStaticAuth]);

  if (useStaticAuth) {
    return <TestAuthProvider>{children}</TestAuthProvider>;
  }

  if (!msalInstance) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div className="overline">Tribunal Electoral Estudiantil</div>
        <p style={{ margin: 0, color: 'var(--muted)' }}>Cargando sistema electoral...</p>
        <div className="loader" aria-hidden="true" />
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>{children}</AuthProvider>
    </MsalProvider>
  );
}
