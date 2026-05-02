import MicrosoftLoginButton from './MicrosoftLoginButton';
import AuthError from './AuthError';

export default function LoginCard() {
  return (
    <div className="max-w-[400px] w-full animate-fadeInUp">
      <div className="overline" style={{ marginBottom: '1rem' }}>
        Tribunal Electoral Estudiantil
      </div>

      <h1 className="font-display font-normal tracking-tight text-[2.5rem] leading-[1.08] mb-2">
        Portal de Votación
      </h1>

      <p className="text-muted text-[0.9375rem] mb-10">
        Ingresa con tu cuenta institucional para acceder al sistema de votación.
      </p>

      <MicrosoftLoginButton />
      <AuthError />

      <div className="mt-6 pt-6 border-t border-border text-center">
        <a
          href="#"
          className="text-[0.8125rem] text-muted no-underline transition-colors duration-200 hover:text-ink"
        >
          Acceso administrativo TEE
        </a>
      </div>
    </div>
  );
}
