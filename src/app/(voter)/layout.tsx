'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Loader from '@/components/Loader';

/**
 * Selector entre las dos secciones del votante.
 *
 * El cliente lo pidió explícitamente: "Mostrar la opción en la pantalla del
 * usuario para elegir si desea ver las votaciones o las postulaciones
 * disponibles."
 */
const VOTER_SECTIONS = [
  { href: '/votaciones', label: 'Votaciones' },
  // La ruta del votante es /mis-postulaciones porque /postulaciones ya la
  // ocupa la gestión del admin: los route groups no cambian la URL, así que
  // dos páginas con el mismo path chocarían. Mismo criterio que la API.
  { href: '/mis-postulaciones', label: 'Postulaciones' },
];

export default function VoterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

        <nav className="voter-section-switch" aria-label="Secciones disponibles">
          {VOTER_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`filter-chip ${pathname.startsWith(section.href) ? 'active' : ''}`}
              aria-current={pathname.startsWith(section.href) ? 'page' : undefined}
            >
              {section.label}
            </Link>
          ))}
        </nav>

        {children}
      </main>
    </div>
  );
}
