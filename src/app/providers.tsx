'use client';

import { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance, msalReady } from '@/lib/msal';
import { AuthProvider } from '@/lib/auth-context';

export function MsalProviderWrapper({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    msalReady.then(() => setIsReady(true));
  }, []);

  if (!isReady) return null;

  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>{children}</AuthProvider>
    </MsalProvider>
  );
}
