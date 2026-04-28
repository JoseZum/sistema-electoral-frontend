'use client';

import { useAuth } from '@/lib/auth-context';

export default function AuthError() {
  const { error } = useAuth();

  if (!error) return null;

  const normalizedError = error.toLowerCase();
  const isDomainError = normalizedError.includes('estudiantec.cr');
  const isPadronError = normalizedError.includes('padron');
  const isServiceError =
    normalizedError.includes('no esta disponible') ||
    normalizedError.includes('no se pudo conectar') ||
    normalizedError.includes('intenta nuevamente');

  let title = 'Error de autenticacion';

  if (isDomainError) {
    title = 'Cuenta no autorizada';
  } else if (isPadronError) {
    title = 'Cuenta sin acceso';
  } else if (isServiceError) {
    title = 'Servicio no disponible';
  }

  return (
    <div className="mt-4 p-4 bg-error-light border border-error/20 rounded-md">
      <p className="text-sm font-semibold text-error mb-1">{title}</p>
      <p className="text-xs text-error/80">{error}</p>
    </div>
  );
}
