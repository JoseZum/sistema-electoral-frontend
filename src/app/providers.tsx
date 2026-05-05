'use client';

import { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import type { PublicClientApplication } from '@azure/msal-browser';
import { getMsalInstance, initializeMsal } from '@/lib/msal';
import { AuthProvider } from '@/lib/auth-context';

export function MsalProviderWrapper({ children }: { children: React.ReactNode }) {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fallbackInstance = getMsalInstance();

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
  }, []);

  if (isInitializing || !msalInstance) {
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
