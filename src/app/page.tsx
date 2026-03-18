'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import LoginCard from '@/components/auth/LoginCard';
import LoginInfoPanel from '@/components/auth/LoginInfoPanel';

export default function LoginPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.role === 'admin') {
        router.replace('/padron');
      } else {
        router.replace('/votaciones');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p style={{ color: 'var(--muted)' }}>Cargando...</p>
      </main>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen flex">
      {/* Left Column — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <LoginCard />
      </div>

      {/* Right Column — Info Panel */}
      <div
        className="w-[48%] bg-ink flex flex-col justify-center p-16 relative overflow-hidden max-lg:hidden"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.02) 20px, rgba(255,255,255,0.02) 21px), repeating-linear-gradient(-45deg, transparent, transparent 20px, rgba(255,255,255,0.02) 20px, rgba(255,255,255,0.02) 21px)",
        }}
      >
        <LoginInfoPanel />
      </div>
    </main>
  );
}
