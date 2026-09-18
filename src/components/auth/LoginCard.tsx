import MicrosoftLoginButton from './MicrosoftLoginButton';
import AuthError from './AuthError';

export default function LoginCard() {
  return (
    <div className="max-w-[26rem] w-full animate-fadeInUp">
      <div className="overline" style={{ marginBottom: '1rem' }}>
        Tribunal Electoral Estudiantil
      </div>

      <h1 className="font-display font-medium tracking-tight text-[clamp(2.1rem,4vw,3.1rem)] leading-[1.1] text-white mb-4">
        Tu voto decide quién representa al TEC
      </h1>

      <p className="text-white/70 text-[0.9375rem] leading-[1.7] mb-8">
        Elecciones estudiantiles con garantías de integridad, confidencialidad y transparencia en cada proceso.
      </p>

      <MicrosoftLoginButton />
      <AuthError />

      {/* 60% es el minimo que pasa AA sobre --ink en texto de 12px; con 45% da 3.8:1. */}
      <p className="text-white/60 text-xs leading-relaxed mt-4">
        Se ingresa con la cuenta institucional del TEC. El sistema no guarda tu contraseña.
      </p>
    </div>
  );
}
