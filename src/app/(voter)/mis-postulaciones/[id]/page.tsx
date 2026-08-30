'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Loader from '@/components/Loader';
import ApplicationStatusBadge from '@/components/postulaciones/ApplicationStatusBadge';
import FileField from '@/components/postulaciones/FileField';
import FileViewer from '@/components/postulaciones/FileViewer';
import {
  deleteMyFile,
  getMyApplication,
  getMyFileUrl,
  saveMyApplication,
  submitMyApplication,
  uploadMyFile,
} from '@/lib/postulaciones-api';
import {
  FILE_FIELDS,
  POSITION_FIELD,
  SELECT_FIELDS,
  TEXT_FIELDS,
  formatDateTime,
} from '@/lib/postulaciones-fields';
import type {
  ApplicationFieldKey,
  ApplicationFileMeta,
  FileFieldKey,
  MyApplicationDetail,
  SaveApplicationPayload,
} from '@/types/postulaciones';

type DataFieldKey = keyof SaveApplicationPayload | 'email';
type FormValues = Record<DataFieldKey, string>;

const EMPTY_VALUES: FormValues = {
  last_name_1: '',
  last_name_2: '',
  first_name: '',
  email: '',
  national_id: '',
  carnet: '',
  phone: '',
  sede: '',
  career: '',
  position_id: '',
};

/**
 * Toma lo ya guardado y, para lo que aún está vacío, la sugerencia del padrón.
 * Así un borrador a medias no pierde lo escrito pero el resto llega prellenado.
 */
function buildValues(detail: MyApplicationDetail): FormValues {
  const { application, prefill } = detail;

  const pick = (key: DataFieldKey): string => {
    const saved = application ? (application[key as keyof typeof application] as string | null) : null;
    if (saved !== null && saved !== undefined && saved !== '') return saved;
    return (prefill[key as keyof typeof prefill] as string) ?? '';
  };

  return {
    last_name_1: pick('last_name_1'),
    last_name_2: pick('last_name_2'),
    first_name: pick('first_name'),
    email: prefill.email,
    national_id: pick('national_id'),
    carnet: pick('carnet'),
    phone: pick('phone'),
    sede: pick('sede'),
    career: pick('career'),
    // El puesto no tiene sugerencia del padrón: o está elegido o está vacío.
    position_id: application?.position_id ?? '',
  };
}

export default function LlenarPostulacionPage() {
  const params = useParams();
  const router = useRouter();
  const formId = String(params.id);

  const [detail, setDetail] = useState<MyApplicationDetail | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<FileFieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<ApplicationFileMeta | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMyApplication(formId);
      setDetail(data);
      setValues(buildValues(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el formulario');
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = useMemo(
    () => new Set<ApplicationFieldKey>(detail?.editable_fields ?? []),
    [detail]
  );

  const filesByField = useMemo(() => {
    const map = new Map<string, ApplicationFileMeta[]>();
    for (const file of detail?.files ?? []) {
      map.set(file.field_key, [...(map.get(file.field_key) ?? []), file]);
    }
    return map;
  }, [detail]);

  function update(key: DataFieldKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** Se manda solo lo editable: el backend descarta el resto de todas formas. */
  function editablePayload(): SaveApplicationPayload {
    const payload: SaveApplicationPayload = {};
    for (const key of Object.keys(values) as DataFieldKey[]) {
      if (key !== 'email' && editable.has(key as ApplicationFieldKey)) {
        payload[key as keyof SaveApplicationPayload] = values[key] || null;
      }
    }
    return payload;
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await saveMyApplication(formId, editablePayload());
      setDetail(data);
      setNotice('Borrador guardado. Puedes volver más tarde para terminar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el borrador');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      // Se guarda primero para que el servidor valide la completitud contra
      // lo que el estudiante tiene en pantalla, no contra el último borrador.
      await saveMyApplication(formId, editablePayload());
      const data = await submitMyApplication(formId);
      setDetail(data);
      setValues(buildValues(data));
      setNotice('Tu postulación fue enviada. Recibirás la resolución en esta misma pantalla.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la postulación');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(fieldKey: FileFieldKey, file: File) {
    setUploadingField(fieldKey);
    setError(null);
    try {
      await uploadMyFile(formId, fieldKey, file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el archivo');
    } finally {
      setUploadingField(null);
    }
  }

  async function handleRemoveFile(fileId: string) {
    setError(null);
    try {
      await deleteMyFile(formId, fileId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el archivo');
    }
  }

  if (loading) return <Loader />;

  if (!detail) {
    return (
      <div className="voter-content">
        <div className="postulacion-banner rejected">
          {error || 'Este formulario no está disponible'}
        </div>
        <button type="button" className="btn btn-outline" onClick={() => router.push('/mis-postulaciones')}>
          Volver
        </button>
      </div>
    );
  }

  const { form, application } = detail;
  const canEdit = form.can_edit;
  const isConditioned = application?.status === 'CONDITIONED';
  const visibleFileFields = FILE_FIELDS.filter(
    (field) => field.key !== 'other' || form.allow_other_documents
  );

  return (
    <div className="voter-content">
      <header className="voter-hero">
        <div className="swiss-bar" />
        <Link href="/mis-postulaciones" className="btn btn-ghost btn-sm" style={{ marginBottom: '0.5rem' }}>
          ← Mis postulaciones
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <h2 className="voter-hero-title" style={{ fontSize: '1.6rem' }}>{form.title}</h2>
          {application && <ApplicationStatusBadge status={application.status} />}
        </div>
        {form.description && <p className="voter-hero-sub">{form.description}</p>}
        {form.status === 'OPEN' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
            Cierra el {formatDateTime(form.end_time)}
          </p>
        )}
      </header>

      {/* Resolución del administrador */}
      {isConditioned && (
        <div className="postulacion-banner conditioned" style={{ marginBottom: '1rem' }}>
          <div className="postulacion-banner-title">Tu postulación fue condicionada</div>
          {form.review_comment && <div>{form.review_comment}</div>}
          <div style={{ marginTop: '0.35rem', fontSize: '0.8125rem' }}>
            Solo puedes editar los campos señalados. Tienes hasta el{' '}
            {formatDateTime(form.correction_deadline)}.
          </div>
        </div>
      )}

      {application?.status === 'APPROVED' && (
        <div className="postulacion-banner approved" style={{ marginBottom: '1rem' }}>
          <div className="postulacion-banner-title">Postulación aprobada</div>
          {application.review_comment && <div>{application.review_comment}</div>}
        </div>
      )}

      {application?.status === 'REJECTED' && (
        <div className="postulacion-banner rejected" style={{ marginBottom: '1rem' }}>
          <div className="postulacion-banner-title">Postulación denegada</div>
          {application.review_comment && <div>{application.review_comment}</div>}
        </div>
      )}

      {application?.status === 'SUBMITTED' && (
        <div className="postulacion-banner info" style={{ marginBottom: '1rem' }}>
          <div className="postulacion-banner-title">Postulación enviada</div>
          Enviada el {formatDateTime(application.submitted_at)}. Está en revisión, así que no se
          puede modificar por ahora.
        </div>
      )}

      {notice && (
        <div className="postulacion-banner approved" style={{ marginBottom: '1rem' }}>{notice}</div>
      )}
      {error && (
        <div className="postulacion-banner rejected" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        {/* Puesto: solo aparece si el formulario define alguno */}
        {detail.positions.length > 0 && (
          <section className="card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
            <div className="overline">Puesto</div>
            {(() => {
              const locked = !canEdit || !editable.has(POSITION_FIELD.key);
              return (
                <div className="input-group">
                  <label htmlFor={POSITION_FIELD.key}>
                    {POSITION_FIELD.label}
                    {locked && <span style={{ color: 'var(--muted-light)' }}> · bloqueado</span>}
                  </label>
                  <select
                    id={POSITION_FIELD.key}
                    className={`input ${locked ? 'postulacion-input-locked' : ''}`}
                    value={values.position_id}
                    disabled={locked}
                    onChange={(event) => update(POSITION_FIELD.key, event.target.value)}
                  >
                    <option value="">{POSITION_FIELD.placeholder}</option>
                    {detail.positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                    Elige el puesto al que quieres presentarte
                  </span>
                </div>
              );
            })()}
          </section>
        )}

        {/* Información personal */}
        <section className="card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">Información personal</div>

          <div className="postulacion-grid-2">
            {TEXT_FIELDS.map((field) => {
              const locked = field.key === 'email' || !canEdit || !editable.has(field.key);
              return (
                <div key={field.key} className="input-group">
                  <label htmlFor={field.key}>
                    {field.label}
                    {locked && <span style={{ color: 'var(--muted-light)' }}> · bloqueado</span>}
                  </label>
                  <input
                    id={field.key}
                    className={`input ${locked ? 'postulacion-input-locked' : ''}`}
                    value={values[field.key]}
                    inputMode={field.inputMode}
                    disabled={locked}
                    onChange={(event) => {
                      // Los campos numéricos filtran en el propio input para
                      // que el usuario vea de inmediato que no van guiones.
                      const raw = event.target.value;
                      update(field.key, field.numeric ? raw.replace(/[^0-9]/g, '') : raw);
                    }}
                  />
                  {field.hint && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                      {field.hint}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Sede y carrera */}
        <section className="card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">Sede y carrera</div>

          <div className="postulacion-grid-2">
            {SELECT_FIELDS.map((field) => {
              const locked = !canEdit || !editable.has(field.key);
              const options = field.key === 'sede' ? detail.sedes : detail.careers;
              return (
                <div key={field.key} className="input-group">
                  <label htmlFor={field.key}>
                    {field.label}
                    {locked && <span style={{ color: 'var(--muted-light)' }}> · bloqueado</span>}
                  </label>
                  <select
                    id={field.key}
                    className={`input ${locked ? 'postulacion-input-locked' : ''}`}
                    value={values[field.key]}
                    disabled={locked}
                    onChange={(event) => update(field.key, event.target.value)}
                  >
                    <option value="">{field.placeholder}</option>
                    {/* Si el padrón trae un valor que ya no está en el catálogo,
                        se añade para no perder lo que el estudiante tenía. */}
                    {!options.includes(values[field.key]) && values[field.key] && (
                      <option value={values[field.key]}>{values[field.key]}</option>
                    )}
                    {options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>

        {/* Documentos */}
        <section className="card" style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
          <div className="overline">Documentos</div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
            Solo se aceptan PDF o imágenes, hasta 4 MB por archivo.
          </p>

          {visibleFileFields.map((field) => (
            <FileField
              key={field.key}
              label={
                field.key === 'other' && form.other_documents_label
                  ? form.other_documents_label
                  : field.label
              }
              hint={field.hint}
              files={filesByField.get(field.key) ?? []}
              editable={canEdit && editable.has(field.key)}
              multiple={field.multiple}
              required={!field.optional}
              uploading={uploadingField === field.key}
              onUpload={(file) => handleUpload(field.key, file)}
              onRemove={handleRemoveFile}
              onView={setViewingFile}
            />
          ))}
        </section>

        {canEdit && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
            >
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </button>
            <button type="submit" className="btn btn-accent" disabled={saving || submitting}>
              {submitting ? 'Enviando…' : isConditioned ? 'Reenviar postulación' : 'Enviar postulación'}
            </button>
          </div>
        )}
      </form>

      <FileViewer file={viewingFile} loadUrl={getMyFileUrl} onClose={() => setViewingFile(null)} />
    </div>
  );
}
