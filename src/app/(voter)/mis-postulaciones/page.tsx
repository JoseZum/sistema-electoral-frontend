'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Loader from '@/components/Loader';
import ApplicationStatusBadge from '@/components/postulaciones/ApplicationStatusBadge';
import { listMyForms } from '@/lib/postulaciones-api';
import { formatDateTime } from '@/lib/postulaciones-fields';
import type { MyApplicationFormSummary } from '@/types/postulaciones';

/** Qué invita a hacer cada estado cuando el estudiante abre el formulario. */
function callToAction(form: MyApplicationFormSummary): string {
  if (!form.application_status) return form.can_edit ? 'Postularme' : 'Ver convocatoria';
  if (form.application_status === 'CONDITIONED') return 'Corregir y reenviar';
  // Un borrador de una convocatoria ya cerrada no se puede continuar, así que
  // no se invita a hacerlo.
  if (form.application_status === 'DRAFT') {
    return form.can_edit ? 'Continuar borrador' : 'Ver borrador';
  }
  return 'Ver mi postulación';
}

export default function MisPostulacionesPage() {
  const [forms, setForms] = useState<MyApplicationFormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listMyForms()
      .then((data) => !cancelled && setForms(data))
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las postulaciones');
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const openCount = forms.filter((form) => form.status === 'OPEN').length;

  return (
    <div className="voter-content">
      <header className="voter-hero">
        <div className="swiss-bar" />
        <div className="voter-hero-row">
          <div>
            <h2 className="voter-hero-title">Tus <em>postulaciones</em></h2>
            <p className="voter-hero-sub">
              Aquí aparecen las convocatorias abiertas para ti. Llena el formulario, adjunta tus
              documentos y sigue el estado de tu candidatura.
            </p>
          </div>
          <div className="voter-hero-meta">
            <div className="voter-hero-stat">
              <span className="voter-hero-stat-value">{openCount}</span>
              <span className="voter-hero-stat-label">
                {openCount === 1 ? 'Abierta ahora' : 'Abiertas ahora'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="postulacion-field-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <Loader />
      ) : forms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '1rem' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
          </svg>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Sin postulaciones disponibles</h3>
          <p>No hay convocatorias abiertas para ti en este momento.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {forms.map((form) => (
            <div key={form.id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 500 }}>
                      {form.title}
                    </h3>
                    {form.application_status && (
                      <ApplicationStatusBadge status={form.application_status} size="sm" />
                    )}
                  </div>

                  {form.description && (
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
                      {form.description}
                    </p>
                  )}

                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.65rem' }}>
                    {form.status === 'OPEN'
                      ? `Cierra el ${formatDateTime(form.end_time)}`
                      : 'Convocatoria cerrada'}
                  </div>

                  {form.application_status === 'DRAFT' && (
                    <div
                      className={`postulacion-banner ${form.can_edit ? 'conditioned' : 'rejected'}`}
                      style={{ marginTop: '0.75rem' }}
                    >
                      <div className="postulacion-banner-title">
                        {form.can_edit ? 'Borrador sin enviar' : 'Borrador no enviado a tiempo'}
                      </div>
                      {form.can_edit
                        ? 'Todavía no has enviado esta postulación. Mientras no la envíes no entra a revisión.'
                        : 'La convocatoria cerró y este borrador nunca se envió, así que no entró a revisión.'}
                    </div>
                  )}

                  {form.application_status === 'CONDITIONED' && (
                    <div className="postulacion-banner conditioned" style={{ marginTop: '0.75rem' }}>
                      <div className="postulacion-banner-title">Debes corregir tu postulación</div>
                      {form.review_comment && <div>{form.review_comment}</div>}
                      <div style={{ marginTop: '0.35rem', fontSize: '0.8125rem' }}>
                        Tienes hasta el {formatDateTime(form.correction_deadline)}
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href={`/mis-postulaciones/${form.id}`}
                  className={form.can_edit ? 'btn btn-accent' : 'btn btn-outline'}
                  style={{ flexShrink: 0 }}
                >
                  {callToAction(form)}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
