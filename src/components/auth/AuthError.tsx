'use client';

import { useAuth } from '@/lib/auth-context';

export default function AuthError() {
  const { error } = useAuth();

  if (!error) return null;

  const isDomainError = error.includes('estudiantec.cr');

  return (
    <div className="mt-4 p-4 bg-error-light border border-error/20 rounded-md">
      <p className="text-sm font-semibold text-error mb-1">
        {isDomainError ? 'Cuenta no autorizada' : 'Error de autenticación'}
      </p>
      <p className="text-xs text-error/80">
        {isDomainError
          ? 'Solo se permiten cuentas institucionales @estudiantec.cr. Por favor, iniciá sesión con tu correo del TEC.'
          : error}
      </p>
    </div>
  );
}
