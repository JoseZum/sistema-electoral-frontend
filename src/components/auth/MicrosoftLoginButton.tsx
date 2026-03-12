'use client';

import { useAuth } from '@/lib/auth-context';

export default function MicrosoftLoginButton() {
  const { loginWithMicrosoft, isLoading } = useAuth();

  return (
    <button
      onClick={loginWithMicrosoft}
      disabled={isLoading}
      className="w-full px-5 py-3 bg-surface-raised border-[1.5px] border-border rounded-md font-body text-[0.9375rem] font-semibold cursor-pointer flex items-center justify-center gap-3 transition-all duration-200 text-ink hover:border-ink hover:shadow-md hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg width="20" height="20" viewBox="0 0 21 21">
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
      </svg>
      {isLoading ? 'Conectando...' : 'Continuar con Microsoft'}
    </button>
  );
}
