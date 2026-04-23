'use client';

import { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import type { PublicClientApplication } from '@azure/msal-browser';
import { initializeMsal } from '@/lib/msal';
import { AuthProvider } from '@/lib/auth-context';

export function MsalProviderWrapper({ children }: { children: React.ReactNode }) {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);

  useEffect(() => {
    let mounted = true;

    initializeMsal().then((instance) => {
      if (mounted) {
        setMsalInstance(instance);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!msalInstance) return null;

  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>{children}</AuthProvider>
    </MsalProvider>
  );
}
