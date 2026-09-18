'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import LoginCard from '@/components/auth/LoginCard';
import Loader from '@/components/Loader';

// Cifras verificadas contra producción el 18 de septiembre de 2026.
// Al actualizarlas, NO uses COUNT(DISTINCT ...): `sede` y `career` son texto libre con
// varias grafías para el mismo valor («CARTAGO» y «CAMPUS TECNOLÓGICO CENTRAL CARTAGO»
// son el mismo campus), así que esa cuenta devuelve 16 sedes y 100 carreras, que no
// existen. Hay que agrupar las variantes a mano.
const PADRON = 12946;
const HABILITADOS = 10283;
const CARRERAS = 20;
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
    <main className="cover-page">
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
        <p>
          Padrón vigente: {n(PADRON)} personas registradas, {n(HABILITADOS)} habilitadas
          para votar.
        </p>
        <div className="cover-figures">
          <div>
            <strong>{n(HABILITADOS)}</strong>
            <span>Estudiantes habilitados</span>
          </div>
          <div>
            <strong>{CARRERAS}</strong>
            <span>Carreras</span>
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
