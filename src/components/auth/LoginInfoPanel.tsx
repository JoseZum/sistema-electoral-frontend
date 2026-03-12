const stats = [
  { value: '11,247', label: 'Estudiantes' },
  { value: '34', label: 'Asociaciones' },
  { value: '100%', label: 'Anónimo' },
];

export default function LoginInfoPanel() {
  return (
    <div className="bg-white/[0.06] border border-white/10 rounded-lg p-8 text-white relative z-10 animate-fadeInUp animation-delay-200">
      <h2 className="font-display font-normal tracking-tight text-[2rem] leading-[1.15] text-white mb-4">
        Tu voto importa
      </h2>
      <p className="text-white/60 text-[0.9375rem] leading-[1.7] mb-6">
        El sistema electoral del TEC garantiza la integridad, anonimato y transparencia de cada proceso electoral estudiantil.
      </p>
      <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="font-display text-[2rem] text-white leading-none mb-1">
              {stat.value}
            </div>
            <div className="text-xs text-white/40 uppercase tracking-[0.05em]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
