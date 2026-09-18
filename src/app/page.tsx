'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import LoginCard from '@/components/auth/LoginCard';
import Loader from '@/components/Loader';

// Cifras verificadas a mano contra producción el 18 de septiembre de 2026.
// "Carreras" no se muestra: un count(distinct) daba 100, pero es la misma
// carrera escrita de varias formas; normalizando tildes y mayúsculas no queda
// una cifra defendible. "Sedes" sí, ya agrupada a mano (antes daba 16 por el
// mismo motivo: el mismo campus escrito de varias formas).
const PADRON = 12946;
const HABILITADOS = 10283;
const SEDES = 5;
const n = (value: number) => value.toLocaleString('es-CR');

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
    return <Loader fullscreen />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen flex flex-col">
      <div className="cover-hero">
        <LoginCard />

        <div className="cover-ballot" aria-hidden="true">
          <span className="cover-orbit cover-orbit-1" />
          <span className="cover-orbit cover-orbit-2" />
          <span className="cover-dot cover-dot-1" />
          <span className="cover-dot cover-dot-2" />
          <div className="cover-paper">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="cover-box">
            <span>TEE</span>
          </div>
        </div>
      </div>

      <div className="cover-strip">
        <p>Padrón estudiantil vigente, verificado antes de cada proceso electoral.</p>
        <div className="cover-figures">
          <div>
            <strong>{n(PADRON)}</strong>
            <span>Personas en el padrón</span>
          </div>
          <div>
            <strong>{n(HABILITADOS)}</strong>
            <span>Habilitadas para votar</span>
          </div>
          <div>
            <strong>{SEDES}</strong>
            <span>Sedes</span>
          </div>
        </div>
      </div>
    </main>
  );
}
