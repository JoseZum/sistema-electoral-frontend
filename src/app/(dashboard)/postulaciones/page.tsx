'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Loader from '@/components/Loader';
import { FormStatusBadge } from '@/components/postulaciones/ApplicationStatusBadge';
import { deleteForm, listForms } from '@/lib/postulaciones-api';
import { formatDateTime } from '@/lib/postulaciones-fields';
import type { ApplicationFormWithStats } from '@/types/postulaciones';

type FeedbackState = { tone: 'success' | 'error'; message: string } | null;

export default function PostulacionesPage() {
  const [forms, setForms] = useState<ApplicationFormWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApplicationFormWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      setForms(await listForms());
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'No se pudieron cargar los formularios',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteForm(deleteTarget.id);
      setFeedback({ tone: 'success', message: `Se eliminó "${deleteTarget.title}"` });
      setDeleteTarget(null);
      await loadForms();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'No se pudo eliminar el formulario',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="view-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <div className="overline" style={{ marginBottom: '0.75rem' }}>Candidaturas</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500 }}>
            Formularios de postulación
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Crea formularios de candidatura, revisa las respuestas y resuelve cada postulación.
          </p>
        </div>
        <Link href="/postulaciones/crear" className="btn btn-accent">
          Crear formulario
        </Link>
      </div>

      {feedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            background: feedback.tone === 'success' ? '#ecfdf5' : 'var(--error-light)',
            border: `1px solid ${feedback.tone === 'success' ? '#059669' : 'var(--error)'}`,
            color: feedback.tone === 'success' ? '#065f46' : 'var(--error)',
          }}
        >
          {feedback.message}
        </div>
      )}

      {loading && <Loader />}

      {!loading && forms.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            Todavía no hay formularios
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Crea el primer formulario para empezar a recibir postulaciones.
          </p>
        </div>
      )}

      {!loading && forms.length > 0 && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {forms.map((form) => (
            <div key={form.id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 500 }}>
                      {form.title}
                    </h3>
                    <FormStatusBadge status={form.status} />
                  </div>
                  {form.description && (
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
                      {form.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                    <span>Cierra: <strong>{formatDateTime(form.end_time)}</strong></span>
                    <span>Elegibles: <strong>{form.eligible_count}</strong></span>
                    {form.tag_name && <span>Tag: <strong>{form.tag_name}</strong></span>}
                    {form.election_title && <span>Votación: <strong>{form.election_title}</strong></span>}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href={`/postulaciones/${form.id}`} className="btn btn-outline btn-sm">
                      Ver respuestas ({form.submitted_count + form.conditioned_count + form.approved_count + form.rejected_count + form.draft_count})
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteTarget(form)}
                    >
                      Eliminar
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                    <span style={{ color: '#2563eb' }}>{form.submitted_count} por revisar</span>
                    <span style={{ color: '#059669' }}>{form.approved_count} aprobadas</span>
                    <span style={{ color: '#d97706' }}>{form.conditioned_count} condicionadas</span>
                    <span style={{ color: '#dc2626' }}>{form.rejected_count} denegadas</span>
                    {/* Los borradores no se revisan, pero el admin necesita
                        saber cuánta gente empezó y no llegó a enviar. */}
                    <span style={{ color: 'var(--muted)' }}>{form.draft_count} sin terminar</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay active" role="dialog" aria-modal="true">
          <div className="modal">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', marginBottom: '0.5rem' }}>
              Eliminar formulario
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
              Se eliminará <strong>{deleteTarget.title}</strong> junto con todas sus postulaciones
              y archivos adjuntos. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
