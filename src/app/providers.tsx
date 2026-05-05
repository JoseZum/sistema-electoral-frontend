'use client';

import { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import type { PublicClientApplication } from '@azure/msal-browser';
import { getMsalInstance, initializeMsal } from '@/lib/msal';
import { AuthProvider } from '@/lib/auth-context';
import Loader from '@/components/Loader';

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
    return <Loader fullscreen />;
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>{children}</AuthProvider>
    </MsalProvider>
  );
}
