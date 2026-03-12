import MicrosoftLoginButton from './MicrosoftLoginButton';
import TokenLoginForm from './TokenLoginForm';
import AuthError from './AuthError';

export default function LoginCard() {
  return (
    <div className="max-w-[400px] w-full animate-fadeInUp">
      {/* Overline */}
      <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.1em] uppercase text-accent mb-4">
        <span className="block w-8 h-px bg-accent" />
        Tribunal Electoral Estudiantil
      </div>

      {/* Title */}
      <h1 className="font-display font-normal tracking-tight text-[2.5rem] leading-[1.08] mb-2">
        Portal de Votación
      </h1>

      {/* Subtitle */}
      <p className="text-muted text-[0.9375rem] mb-10">
        Ingresá con tu cuenta institucional para ver las votaciones disponibles.
      </p>

      {/* Microsoft Login */}
      <MicrosoftLoginButton />

      {/* Error message */}
      <AuthError />

      {/* Divider */}
      <div className="flex items-center gap-4 my-6 text-muted-light text-[0.8125rem]">
        <span className="flex-1 h-px bg-border" />
        o ingresá con token
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Token Form */}
      <TokenLoginForm />

      {/* Footer note */}
      <p className="text-[0.8125rem] text-muted mt-6 text-center">
        El token fue enviado a tu correo @estudiantec.cr
      </p>

      {/* Admin link */}
      <div className="mt-6 pt-6 border-t border-border text-center">
        <a href="#" className="text-[0.8125rem] text-muted no-underline transition-colors duration-200 hover:text-ink">
          Acceso administrativo TEE →
        </a>
      </div>
    </div>
  );
}
