'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Loader from '@/components/Loader';
import ApplicationStatusBadge, { FormStatusBadge } from '@/components/postulaciones/ApplicationStatusBadge';
import FileViewer from '@/components/postulaciones/FileViewer';
import PositionsEditor from '@/components/postulaciones/PositionsEditor';
import {
  getAdminFileUrl,
  getApplication,
  getForm,
  listApplications,
  reviewApplication,
} from '@/lib/postulaciones-api';
import {
  FIELD_LABELS,
  FILE_FIELDS,
  SELECT_FIELDS,
  TEXT_FIELDS,
  UNLOCKABLE_FIELDS,
  formatDateTime,
  formatFileSize,
} from '@/lib/postulaciones-fields';
import type {
  ApplicationDetail,
  ApplicationFieldKey,
  ApplicationFileMeta,
  ApplicationFormWithStats,
  ApplicationSummary,
  ReviewDecision,
} from '@/types/postulaciones';

type FeedbackState = { tone: 'success' | 'error'; message: string } | null;

const DECISIONS: Array<{ value: ReviewDecision; label: string; className: string }> = [
  { value: 'APPROVED', label: 'Aprobado', className: 'approved' },
  { value: 'CONDITIONED', label: 'Condicionado', className: 'conditioned' },
  { value: 'REJECTED', label: 'Denegado', className: 'rejected' },
];

/** Por defecto se le dan 72 horas al postulante para corregir. */
function defaultDeadline(): string {
  const date = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function RevisarPostulacionesPage() {
  const params = useParams();
  const formId = String(params.id);

  const [form, setForm] = useState<ApplicationFormWithStats | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [viewingFile, setViewingFile] = useState<ApplicationFileMeta | null>(null);

  // Estado del panel de decisión
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [comment, setComment] = useState('');
  const [unlocked, setUnlocked] = useState<Set<ApplicationFieldKey>>(new Set());
  const [deadline, setDeadline] = useState(defaultDeadline);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [formData, apps] = await Promise.all([getForm(formId), listApplications(formId)]);
      setForm(formData);
      setApplications(apps);
      setSelectedId((current) => current ?? apps[0]?.id ?? null);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'No se pudieron cargar las postulaciones',
      });
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    getApplication(selectedId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        // Se parte del estado actual de la postulación para que el admin vea
        // qué se decidió la última vez en vez de un panel en blanco.
        setDecision(null);
        setComment('');
        setUnlocked(new Set(data.unlocked_fields ?? []));
        setDeadline(defaultDeadline());
      })
      .catch((error) => {
        if (!cancelled) {
          setFeedback({
            tone: 'error',
            message: error instanceof Error ? error.message : 'No se pudo cargar la postulación',
          });
        }
      })
      .finally(() => !cancelled && setDetailLoading(false));

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filesByField = useMemo(() => {
    const map = new Map<string, ApplicationFileMeta[]>();
    for (const file of detail?.files ?? []) {
      map.set(file.field_key, [...(map.get(file.field_key) ?? []), file]);
    }
    return map;
  }, [detail]);

  function toggleUnlocked(field: ApplicationFieldKey) {
    setUnlocked((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  async function handleReview() {
    if (!detail || !decision) return;

    setSaving(true);
    setFeedback(null);
    try {
      const updated = await reviewApplication(detail.id, {
        decision,
        comment: comment.trim() || null,
        unlocked_fields: decision === 'CONDITIONED' ? Array.from(unlocked) : undefined,
        correction_deadline:
          decision === 'CONDITIONED' ? new Date(deadline).toISOString() : undefined,
      });

      setDetail(updated);
      setDecision(null);
      setComment('');
      setFeedback({
        tone: 'success',
        message: `Postulación de ${updated.student_full_name} marcada como ${
          decision === 'APPROVED' ? 'Aprobada' : decision === 'CONDITIONED' ? 'Condicionada' : 'Denegada'
        }`,
      });
      await loadAll();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'No se pudo guardar la revisión',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader />;

  const canReview = detail && detail.status !== 'DRAFT';
  const otherEnabled = form?.allow_other_documents ?? false;
  const visibleFileFields = FILE_FIELDS.filter((field) => field.key !== 'other' || otherEnabled);

  return (
    <div className="view-enter">
      <div style={{ marginBottom: '1.25rem' }}>
        <Link href="/postulaciones" className="btn btn-ghost btn-sm" style={{ marginBottom: '0.75rem' }}>
          ← Formularios
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500 }}>
            {form?.title}
          </h2>
          {form && <FormStatusBadge status={form.status} />}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
          {applications.length} postulación(es) · {form?.eligible_count} estudiantes elegibles ·
          cierra {formatDateTime(form?.end_time)}
        </p>
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

      {applications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Sin postulaciones todavía</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Aquí aparecerán las respuestas conforme los estudiantes envíen el formulario.
          </p>
        </div>
      ) : (
        <div className="postulacion-layout">
          {/* Puestos + lista de respuestas */}
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              <div className="overline">Puestos</div>
              <PositionsEditor formId={formId} onChange={loadAll} />
            </section>

            <div className="postulacion-list">
              {applications.map((application) => (
                <button
                  key={application.id}
                  type="button"
                  className={`postulacion-list-item ${application.id === selectedId ? 'selected' : ''}`}
                  onClick={() => setSelectedId(application.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="postulacion-list-name">{application.student_full_name}</span>
                    <ApplicationStatusBadge status={application.status} size="sm" />
                  </div>
                  <span className="postulacion-list-meta">
                    {application.position_name && (
                      <>
                        <strong>{application.position_name}</strong>
                        {' · '}
                      </>
                    )}
                    {application.student_carnet} · {application.files_count} archivo(s)
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Detalle + revisión */}
          <div style={{ display: 'grid', gap: '1rem' }}>
            {detailLoading && <Loader />}

            {!detailLoading && detail && (
              <>
                {/* Resolución vigente */}
                {detail.status !== 'SUBMITTED' && detail.status !== 'DRAFT' && (
                  <div
                    className={`postulacion-banner ${
                      detail.status === 'APPROVED' ? 'approved' : detail.status === 'CONDITIONED' ? 'conditioned' : 'rejected'
                    }`}
                  >
                    <div className="postulacion-banner-title">
                      {detail.status === 'APPROVED' && 'Aprobado'}
                      {detail.status === 'CONDITIONED' && 'Condicionado'}
                      {detail.status === 'REJECTED' && 'Denegado'}
                      {detail.reviewed_at && ` · ${formatDateTime(detail.reviewed_at)}`}
                    </div>
                    {detail.review_comment && <div>{detail.review_comment}</div>}
                    {detail.status === 'CONDITIONED' && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.8125rem' }}>
                        Puede corregir hasta {formatDateTime(detail.correction_deadline)} ·
                        Campos reabiertos:{' '}
                        {(detail.unlocked_fields ?? []).map((f) => FIELD_LABELS[f]).join(', ') || '—'}
                      </div>
                    )}
                  </div>
                )}

                {/* Datos del postulante */}
                <section className="card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="overline">Datos del postulante</div>
                    <ApplicationStatusBadge status={detail.status} />
                  </div>

                  {detail.position_name && (
                    <div className="postulacion-banner info" style={{ borderColor: 'var(--accent)' }}>
                      <div className="postulacion-banner-title">Se postula a</div>
                      {detail.position_name}
                    </div>
                  )}

                  <div className="postulacion-data-grid">
                    {[...TEXT_FIELDS, ...SELECT_FIELDS].map((field) => (
                      <div key={field.key} className="postulacion-data-item">
                        <span className="postulacion-data-label">{field.label}</span>
                        <span className="postulacion-data-value">
                          {(detail[field.key as keyof ApplicationDetail] as string) || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Adjuntos */}
                <section className="card" style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
                  <div className="overline">Documentos adjuntos</div>

                  {visibleFileFields.map((field) => {
                    const files = filesByField.get(field.key) ?? [];
                    return (
                      <div key={field.key} className="postulacion-file-field">
                        <div className="postulacion-file-head">
                          <span className="postulacion-file-label">{field.label}</span>
                        </div>
                        {files.length === 0 ? (
                          <div className="postulacion-file-empty">Sin archivo adjunto</div>
                        ) : (
                          files.map((file) => (
                            <div key={file.id} className="postulacion-file-chip">
                              <span className="postulacion-file-chip-name" title={file.file_name}>
                                {file.file_name}
                              </span>
                              <span className="postulacion-file-chip-size">
                                {formatFileSize(file.size_bytes)}
                              </span>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setViewingFile(file)}
                              >
                                Ver
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </section>

                {/* Panel de decisión */}
                <section className="card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
                  <div className="overline">Resolver postulación</div>

                  {!canReview ? (
                    <div className="postulacion-banner info">
                      El estudiante todavía no ha enviado esta postulación, así que no se puede
                      resolver.
                    </div>
                  ) : (
                    <>
                      <div className="postulacion-decisions">
                        {DECISIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`postulacion-decision-btn ${option.className} ${decision === option.value ? 'active' : ''}`}
                            onClick={() => setDecision(option.value)}
                            disabled={saving}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      {decision === 'CONDITIONED' && (
                        <>
                          <div className="input-group">
                            <label>Campos que el estudiante podrá corregir</label>
                            <div className="postulacion-unlock-grid">
                              {UNLOCKABLE_FIELDS.filter(
                                (field) => field !== 'other' || otherEnabled
                              ).map((field) => (
                                <label
                                  key={field}
                                  className={`postulacion-unlock-item ${unlocked.has(field) ? 'checked' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={unlocked.has(field)}
                                    onChange={() => toggleUnlocked(field)}
                                  />
                                  {FIELD_LABELS[field]}
                                </label>
                              ))}
                            </div>
                            {unlocked.size === 0 && (
                              <div className="postulacion-field-error">
                                Marca al menos un campo para que el estudiante pueda corregir
                              </div>
                            )}
                          </div>

                          <div className="input-group" style={{ maxWidth: 320 }}>
                            <label htmlFor="deadline">Plazo para corregir</label>
                            <input
                              id="deadline"
                              type="datetime-local"
                              className="input"
                              value={deadline}
                              onChange={(e) => setDeadline(e.target.value)}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                              Es independiente del cierre del formulario.
                            </span>
                          </div>
                        </>
                      )}

                      <div className="input-group">
                        <label htmlFor="comment">Comentario para el postulante</label>
                        <textarea
                          id="comment"
                          className="input"
                          rows={3}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Ej. El carné está borroso, súbalo de nuevo."
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-accent"
                          onClick={handleReview}
                          disabled={
                            saving ||
                            !decision ||
                            (decision === 'CONDITIONED' && (unlocked.size === 0 || !deadline))
                          }
                        >
                          {saving ? 'Guardando…' : 'Enviar resolución'}
                        </button>
                      </div>
                    </>
                  )}

                  {detail.reviews.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                      <div className="postulacion-data-label" style={{ marginBottom: '0.5rem' }}>
                        Historial de revisiones
                      </div>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {detail.reviews.map((review) => (
                          <div key={review.id} style={{ fontSize: '0.8125rem' }}>
                            <ApplicationStatusBadge status={review.decision} size="sm" />
                            <span style={{ color: 'var(--muted)', marginLeft: '0.5rem' }}>
                              {formatDateTime(review.created_at)}
                              {review.reviewer_name && ` · ${review.reviewer_name}`}
                            </span>
                            {review.comment && (
                              <div style={{ color: 'var(--ink-soft)', marginTop: '0.15rem' }}>
                                {review.comment}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}

      <FileViewer
        file={viewingFile}
        loadUrl={getAdminFileUrl}
        onClose={() => setViewingFile(null)}
      />
    </div>
  );
}
