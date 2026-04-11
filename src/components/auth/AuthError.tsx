'use client';

import { useAuth } from '@/lib/auth-context';

export default function AuthError() {
  const { error } = useAuth();

  if (!error) return null;

  const isDomainError = error.includes('estudiantec.cr');

  return (
    <div className="mt-4 p-4 bg-error-light border border-error/20 rounded-md">
      <p className="text-sm font-semibold text-error mb-1">
        {isDomainError ? 'Cuenta no autorizada' : 'Error de autenticacion'}
      </p>
      <p className="text-xs text-error/80">
        {isDomainError
          ? 'Solo se permiten cuentas institucionales del TEC. Inicia sesion con una cuenta autorizada de Microsoft.'
          : error}
      </p>
    </div>
  );
}
