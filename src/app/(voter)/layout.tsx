'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Loader from '@/components/Loader';

export default function VoterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <Loader fullscreen />;
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Voter Header */}
      <header className="voter-header">
        <a className="voter-brand" href="/votaciones">
          <Image
            src="/logo-color.png"
            alt="Tribunal Electoral Estudiantil"
            width={96}
            height={96}
            priority
            className="voter-brand-logo"
          />
        </a>
        <div className="voter-user">
          <span>{user?.fullName}</span>
          <div
            className="sidebar-avatar"
            style={{ width: 28, height: 28, background: 'var(--accent)', fontSize: '0.6875rem' }}
          >
            {user?.fullName
              ?.split(' ')
              .slice(0, 2)
              .map((n) => n[0])
              .join('')
              .toUpperCase() || '??'}
          </div>
        </div>
      </header>
      <main className="voter-main">
        {user?.role === 'admin' && (
          <div className="voter-main-admin-link">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => router.push('/padron')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Panel Admin
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
