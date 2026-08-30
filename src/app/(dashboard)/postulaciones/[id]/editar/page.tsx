'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Loader from '@/components/Loader';
import ApplicationFormEditor from '@/components/postulaciones/ApplicationFormEditor';
import { getForm } from '@/lib/postulaciones-api';
import type { ApplicationFormWithStats } from '@/types/postulaciones';

export default function EditarPostulacionPage() {
  const params = useParams();
  const formId = String(params.id);
  const [form, setForm] = useState<ApplicationFormWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setForm(await getForm(formId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el formulario');
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loader />;

  if (error || !form) {
    return (
      <div className="card" role="alert" style={{ padding: '1.5rem' }}>
        <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>
          {error || 'El formulario no existe'}
        </div>
        <Link href="/postulaciones" className="btn btn-outline">Volver a formularios</Link>
      </div>
    );
  }

  if (form.status !== 'DRAFT' && form.status !== 'SCHEDULED') {
    return (
      <div className="card" role="alert" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          Este formulario ya no se puede editar
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          La convocatoria ya está abierta, cerrada o archivada. Sus datos se conservan para no
          alterar postulaciones en curso o ya resueltas.
        </p>
        <Link href={`/postulaciones/${form.id}`} className="btn btn-outline">
          Ver formulario
        </Link>
      </div>
    );
  }

  return <ApplicationFormEditor initialForm={form} />;
}
