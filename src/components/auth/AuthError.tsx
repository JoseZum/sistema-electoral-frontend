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
  let description = error;

  if (isDomainError) {
    title = 'Cuenta no autorizada';
    description = 'Solo se permiten cuentas institucionales del TEC. Inicia sesion con una cuenta autorizada de Microsoft.';
  } else if (isPadronError) {
    title = 'Cuenta sin acceso';
    description = 'Tu cuenta no aparece en el padron electoral. Si esto es un error, contacta al TEE.';
  } else if (isServiceError) {
    title = 'Servicio no disponible';
    description = 'No se pudo completar el inicio de sesion en este momento. Intenta nuevamente en unos minutos.';
  }

  return (
    <div className="mt-4 p-4 bg-error-light border border-error/20 rounded-md">
      <p className="text-sm font-semibold text-error mb-1">{title}</p>
      <p className="text-xs text-error/80">{description}</p>
    </div>
  );
}
