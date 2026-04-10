'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

type ElectionInfo = {
  id: string;
  title: string;
  status: string;
  requires_keys: boolean;
  min_keys: number;
};

type progressScrutiny = {
  total_Members: number;
  submittedKeys: number;
  membersPending: {
    id: string;
    full_name: string;
    carnet: string;
    date: Date;
    has_submitted: boolean;
  }[];
  can_finalize: boolean;
};

type generalMetrics = {
  total_votes: number;
  total_elegibles: number;
  participation_rate: number;
};

type ScrutinyResponse = {
  electionInfo: ElectionInfo;
  progressScrutiny: progressScrutiny;
  general_Metric: generalMetrics;
  publication_status: string;
};

type scrutinyKeys = {
    id: string;           
    election_id: string;  
    member_id: string;
    key_shard: string;    
    has_submitted: boolean;
    submitted_at: Date; 
};

// Colores para los avatares — se asignan por índice
const AVATAR_COLORS = [
  '#BE1E2D', '#059669', '#7C3AED',
  '#D97706', '#0EA5E9', '#DC2626',
];

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

export default function EscrutinioPage() {
  const [electionInfo, setElectionInfo] = useState<ElectionInfo | null>(null);
  const [electionFull, setElectionFull] = useState<ScrutinyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('')
  const [submit, setSubmit] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Parsear params de la URL de forma segura
  const params = (() => {
    try {
      return JSON.parse(decodeURIComponent(searchParams.get('data') || ''));
    } catch {
      return null;
    }
  })();

  const electionId: string | null = params?.id ?? null;

  // Redirigir si no hay electionId
  useEffect(() => {
    if (!electionId) router.push('/escrutinio');
  }, [electionId]);

  // Fetch data
  useEffect(() => {
    if (!electionId) return;

    const fetchElections = async () => {
      try {
        setLoading(true);
        const data = await apiClient<ScrutinyResponse>(`/api/scrutiny/${electionId}`);
        setElectionInfo(data.electionInfo);
        setElectionFull(data);
      } catch (err) {
        console.error('Error fetching scrutiny:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchElections();
  }, [electionId]);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setSubmit(true);
    try{
      const payload: Record<string, string> = {
        memberId: user.studentId,
        key: value.trim()
      }

      const response = await apiClient<scrutinyKeys>(`/api/scrutiny/${electionId}/submit-key`,
        {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if(response) alert('Se subio la llave');
        else{
          alert('No se logro subir la llave');
          setSubmit(false);
        }
      }catch(error){
        alert('Error al subir la llave')
      }finally{
        setSubmit(false);
      }

  };
  // ── Valores derivados ──────────────────────────────────
  const submittedCount = electionFull?.progressScrutiny.submittedKeys ?? 0;
  const requiredKeys   = electionInfo?.min_keys ?? 0;
  const members        = electionFull?.progressScrutiny.membersPending ?? [];

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--muted)' }}>
          Cargando votaciones...
        </div>
      ) : !electionInfo || !electionFull ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--muted)' }}>
          No se pudo cargar la información de la elección.
        </div>
      ) : (
        <>
          {/* ── Header ── */}
          <div className="text-center mb-10">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--warning-light)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-3xl font-serif font-normal mb-1">Escrutinio de resultados</h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{electionInfo.title}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Se requieren{' '}
              <strong style={{ color: 'var(--ink)' }}>
                {requiredKeys} llaves
              </strong>{' '}
              del directorio para revelar los resultados.
            </p>
          </div>

          {/* ── Card de llaves ── */}
          <div
            className="rounded-xl overflow-hidden mb-6"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-raised)' }}
          >
            {/* Card header */}
            <div
              className="flex justify-between items-center px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                Llaves de escrutinio
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: submittedCount >= requiredKeys ? 'var(--success)' : 'var(--warning)' }}
              >
                {submittedCount} de {requiredKeys} requeridas
              </span>
            </div>

            {/* Key holder rows */}
            <div>
              {members.map((holder, index) => {
                const submitted = Boolean(holder.has_submitted);
                const isLast    = index === members.length - 1;
                const color     = AVATAR_COLORS[index % AVATAR_COLORS.length];

                return (
                  <div
                    key={holder.id}
                    className="flex items-center gap-4 px-6 py-4 transition-colors"
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      background: submitted ? 'var(--success-light)' : 'transparent',
                      opacity: !submitted ? 0.6 : 1,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ background: color }}
                    >
                      {getInitials(holder.full_name)}
                    </div>

                    {/* Nombre + estado */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm" style={{ color: 'var(--ink)' }}>
                        {holder.full_name}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: submitted ? 'var(--success)' : 'var(--muted)' }}
                      >
                        {submitted
                          ? `Llave ingresada — ${new Date(holder.date).toLocaleString('es-CR')}`
                          : 'Pendiente'}
                      </div>
                    </div>

                    {/* Check / círculo vacío */}
                    {submitted ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ border: '2px solid var(--border)' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div
      className="rounded-xl p-6 guilloche-bg"
      style={{ border: '2px dashed var(--border)' }}
    >
      {/* Title */}
      <div className="text-center mb-4">
        <div className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
          Ingresar tu llave
        </div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          Pegá tu llave de escrutinio asignada
        </div>
      </div>

      {/* Input + button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? 'text' : 'password'}
            className="input w-full pr-10"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
            placeholder="Pegar llave criptográfica..."
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            disabled={loading}
          />
          {/* Toggle visibility */}
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            tabIndex={-1}
          >
            {visible ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <button
          className="btn btn-accent"
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          style={{ opacity: loading || !value.trim() ? 0.6 : 1 }}
        >
          {(loading || submit ) ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : 'Enviar'}
        </button>
      </div>

      
    </div>
          {/* ── Nota de auditoría ── */}
          <p className="text-center mt-6 text-xs" style={{ color: 'var(--muted)' }}>
            Los resultados se revelarán automáticamente cuando se alcance el mínimo de llaves requeridas.
            Este proceso queda registrado en el log de auditoría.
          </p>
        </>
      )}
    </div>
  );
}
