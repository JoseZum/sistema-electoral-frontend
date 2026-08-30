'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TagSelector from '@/components/tags/TagSelector';
import { apiClient } from '@/lib/api-client';
import { createForm, updateForm } from '@/lib/postulaciones-api';
import { FILE_FIELDS } from '@/lib/postulaciones-fields';
import type { Election } from '@/types/elections';
import type {
  ApplicationFormWithStats,
  CreateApplicationFormPayload,
  VoterSource,
} from '@/types/postulaciones';
import PositionsEditor from './PositionsEditor';

interface FormState {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  allow_other_documents: boolean;
  other_documents_label: string;
  voter_source: VoterSource;
  sede: string;
  career: string;
  tag_id: string | null;
  election_id: string;
  positions: string[];
}

interface FormErrors {
  title?: string;
  end_time?: string;
  audience?: string;
}

interface ApplicationFormEditorProps {
  initialForm?: ApplicationFormWithStats;
}

const AUDIENCE_OPTIONS: Array<{ value: VoterSource; label: string; description: string }> = [
  {
    value: 'FULL_PADRON',
    label: 'Todo el padrón',
    description: 'Cualquier estudiante activo puede postularse.',
  },
  {
    value: 'FILTERED',
    label: 'Por sede o carrera',
    description: 'Solo quienes coincidan con el filtro. Útil para puestos de una asociación concreta.',
  },
  {
    value: 'TAG',
    label: 'Por tag',
    description: 'Reutiliza un grupo del padrón que ya tengas guardado.',
  },
];

function emptyForm(): FormState {
  return {
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    allow_other_documents: false,
    other_documents_label: '',
    voter_source: 'FULL_PADRON',
    sede: '',
    career: '',
    tag_id: null,
    election_id: '',
    positions: [],
  };
}

/** Convierte un ISO a la hora local que espera datetime-local. */
function toLocalDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromExisting(existing: ApplicationFormWithStats): FormState {
  const filter = existing.voter_filter as { sede?: unknown; career?: unknown } | null;
  return {
    title: existing.title,
    description: existing.description ?? '',
    start_time: toLocalDateTime(existing.start_time),
    end_time: toLocalDateTime(existing.end_time),
    allow_other_documents: existing.allow_other_documents,
    other_documents_label: existing.other_documents_label ?? '',
    voter_source: existing.voter_source,
    sede: typeof filter?.sede === 'string' ? filter.sede : '',
    career: typeof filter?.career === 'string' ? filter.career : '',
    tag_id: existing.tag_id,
    election_id: existing.election_id ?? '',
    // En edicion los puestos tienen CRUD propio y se cargan desde el servidor.
    positions: [],
  };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.title.trim()) errors.title = 'El formulario necesita un título';
  if (form.start_time && form.end_time && new Date(form.end_time) <= new Date(form.start_time)) {
    errors.end_time = 'El cierre debe ser posterior a la apertura';
  }
  if (form.voter_source === 'FILTERED' && !form.sede && !form.career) {
    errors.audience = 'Elige al menos una sede o una carrera';
  }
  if (form.voter_source === 'TAG' && !form.tag_id) {
    errors.audience = 'Selecciona la tag a la que va dirigido';
  }

  return errors;
}

/** El input datetime-local no lleva zona; se envía como ISO en la del navegador. */
function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export default function ApplicationFormEditor({ initialForm }: ApplicationFormEditorProps) {
  const router = useRouter();
  const editing = Boolean(initialForm);
  const draft = !initialForm || initialForm.status === 'DRAFT';
  const [form, setForm] = useState<FormState>(() =>
    initialForm ? fromExisting(initialForm) : emptyForm()
  );
  const [nuevoPuesto, setNuevoPuesto] = useState('');
  const [catalog, setCatalog] = useState<{ sedes: string[]; careers: string[] }>({
    sedes: [],
    careers: [],
  });
  const [elections, setElections] = useState<Election[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [savingAction, setSavingAction] = useState<'DRAFT' | 'OPEN' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const errors = validate(form);
  const cancelHref = initialForm ? `/postulaciones/${initialForm.id}` : '/postulaciones';

  useEffect(() => {
    let cancelled = false;

    apiClient<{ sedes: string[]; careers: string[] }>('/api/users/students/catalog')
      .then((data) => !cancelled && setCatalog(data))
      .catch(() => undefined);
    apiClient<Election[]>('/api/elections')
      .then((data) => !cancelled && setElections(data))
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function payload(status: 'DRAFT' | 'OPEN'): CreateApplicationFormPayload {
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status,
      start_time: toIso(form.start_time),
      end_time: toIso(form.end_time),
      allow_other_documents: form.allow_other_documents,
      other_documents_label: form.allow_other_documents
        ? form.other_documents_label.trim() || null
        : null,
      voter_source: form.voter_source,
      voter_filter:
        form.voter_source === 'FILTERED'
          ? { sede: form.sede || undefined, career: form.career || undefined }
          : null,
      tag_id: form.voter_source === 'TAG' ? form.tag_id : null,
      election_id: form.election_id || null,
      positions: editing ? undefined : form.positions,
    };
  }

  async function save(status: 'DRAFT' | 'OPEN') {
    setSubmitAttempted(true);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setSavingAction(status);
    try {
      const saved = initialForm
        ? await updateForm(initialForm.id, payload(status))
        : await createForm(payload(status));
      router.push(`/postulaciones/${saved.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el formulario');
      setSavingAction(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save('OPEN');
  }

  const showError = (key: keyof FormErrors) => submitAttempted && errors[key];

  return (
    <div className="view-enter">
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="overline" style={{ marginBottom: '0.75rem' }}>
          {editing ? 'Editar formulario' : 'Nuevo formulario'}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500 }}>
          {editing ? 'Editar formulario de postulación' : 'Crear formulario de postulación'}
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Define el título, la ventana de tiempo y a quién va dirigido. Los campos que llena el
          postulante son fijos.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: '860px' }}>
        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">1. Información</div>
          <div className="input-group">
            <label htmlFor="title">Título del formulario</label>
            <input
              id="title"
              className="input"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Ej. Postulación al Tribunal Electoral Estudiantil 2026"
            />
            {showError('title') && <div className="postulacion-field-error">{errors.title}</div>}
          </div>
          <div className="input-group">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              className="input"
              rows={3}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Explica brevemente de qué se trata la convocatoria"
            />
          </div>
        </section>

        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">2. Tiempo en que estará abierto</div>
          <div className="postulacion-grid-2">
            <div className="input-group">
              <label htmlFor="start_time">Apertura</label>
              <input
                id="start_time"
                type="datetime-local"
                className="input"
                value={form.start_time}
                onChange={(event) => update('start_time', event.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                Si lo dejas vacío, abre de inmediato al publicar
              </span>
            </div>
            <div className="input-group">
              <label htmlFor="end_time">Cierre</label>
              <input
                id="end_time"
                type="datetime-local"
                className="input"
                value={form.end_time}
                onChange={(event) => update('end_time', event.target.value)}
              />
              {showError('end_time') && (
                <div className="postulacion-field-error">{errors.end_time}</div>
              )}
            </div>
          </div>
          <div className="postulacion-banner info" style={{ margin: 0 }}>
            <div className="postulacion-banner-title">
              {draft ? 'El borrador permanece oculto hasta que lo publiques' : 'Formulario programado'}
            </div>
            {draft
              ? 'Puedes guardarlo y volver a editarlo. Al publicar, se abrirá o programará según la fecha indicada.'
              : 'Al guardar, seguirá programado mientras la fecha de apertura permanezca en el futuro.'}
          </div>
        </section>

        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">3. Quién puede postularse</div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {AUDIENCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`postulacion-unlock-item ${form.voter_source === option.value ? 'checked' : ''}`}
                style={{ alignItems: 'flex-start', padding: '0.75rem' }}
              >
                <input
                  type="radio"
                  name="voter_source"
                  checked={form.voter_source === option.value}
                  onChange={() => update('voter_source', option.value)}
                  style={{ marginTop: '0.2rem' }}
                />
                <span>
                  <span style={{ fontWeight: 600, display: 'block' }}>{option.label}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {form.voter_source === 'FILTERED' && (
            <div className="postulacion-grid-2">
              <div className="input-group">
                <label htmlFor="sede">Sede</label>
                <select
                  id="sede"
                  className="input"
                  value={form.sede}
                  onChange={(event) => update('sede', event.target.value)}
                >
                  <option value="">Todas las sedes</option>
                  {catalog.sedes.map((sede) => (
                    <option key={sede} value={sede}>{sede}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="career">Carrera</label>
                <select
                  id="career"
                  className="input"
                  value={form.career}
                  onChange={(event) => update('career', event.target.value)}
                >
                  <option value="">Todas las carreras</option>
                  {catalog.careers.map((career) => (
                    <option key={career} value={career}>{career}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {form.voter_source === 'TAG' && (
            <TagSelector
              value={form.tag_id}
              onChange={(tagId) => update('tag_id', tagId)}
              label="Tag destinataria"
              helperText="Solo los miembros de esta tag verán el formulario"
            />
          )}
          {showError('audience') && (
            <div className="postulacion-field-error">{errors.audience}</div>
          )}
        </section>

        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">4. Puestos disponibles</div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
            El postulante tendrá que elegir uno al enviar. Si no agregas ninguno, no se le
            preguntará.
            {editing && ' Los cambios de esta sección se guardan inmediatamente.'}
          </p>
          {initialForm ? (
            <PositionsEditor formId={initialForm.id} />
          ) : (
            <>
              {form.positions.length > 0 && (
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  {form.positions.map((puesto, index) => (
                    <div key={`${puesto}-${index}`} className="postulacion-position-row">
                      <span className="postulacion-position-name">{puesto}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          update('positions', form.positions.filter((_, candidate) => candidate !== index))
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  value={nuevoPuesto}
                  placeholder="Ej. Presidencia, Tesorería…"
                  aria-label="Nombre del puesto"
                  onChange={(event) => setNuevoPuesto(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const name = nuevoPuesto.trim();
                      if (name && !form.positions.includes(name)) {
                        update('positions', [...form.positions, name]);
                        setNuevoPuesto('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={!nuevoPuesto.trim() || form.positions.includes(nuevoPuesto.trim())}
                  onClick={() => {
                    update('positions', [...form.positions, nuevoPuesto.trim()]);
                    setNuevoPuesto('');
                  }}
                >
                  Agregar
                </button>
              </div>
            </>
          )}
        </section>

        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">5. Documentos solicitados</div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
            Estos adjuntos son obligatorios y no se pueden cambiar:
          </p>
          <ul style={{ fontSize: '0.8125rem', color: 'var(--ink-soft)', paddingLeft: '1.1rem', display: 'grid', gap: '0.2rem' }}>
            {FILE_FIELDS.filter((field) => !field.optional).map((field) => (
              <li key={field.key}>{field.label}</li>
            ))}
          </ul>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={form.allow_other_documents}
              onChange={(event) => update('allow_other_documents', event.target.checked)}
            />
            Pedir también otros documentos (opcional para el postulante)
          </label>
          {form.allow_other_documents && (
            <div className="input-group">
              <label htmlFor="other_documents_label">Etiqueta del campo adicional</label>
              <input
                id="other_documents_label"
                className="input"
                value={form.other_documents_label}
                onChange={(event) => update('other_documents_label', event.target.value)}
                placeholder="Ej. Currículum, plan de trabajo…"
              />
            </div>
          )}
        </section>

        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">6. Votación asociada (opcional)</div>
          <div className="input-group">
            <label htmlFor="election_id">Votación</label>
            <select
              id="election_id"
              className="input"
              value={form.election_id}
              onChange={(event) => update('election_id', event.target.value)}
            >
              <option value="">Sin asociar</option>
              {elections.map((election) => (
                <option key={election.id} value={election.id}>{election.title}</option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
              Sirve para dejar constancia de a qué proceso electoral pertenecen estas candidaturas.
            </span>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              background: 'var(--error-light)',
              border: '1px solid var(--error)',
              color: 'var(--error)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Link href={cancelHref} className="btn btn-ghost">Cancelar</Link>
          {draft && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={savingAction !== null}
              onClick={() => void save('DRAFT')}
            >
              {savingAction === 'DRAFT' ? 'Guardando…' : 'Guardar borrador'}
            </button>
          )}
          <button type="submit" className="btn btn-accent" disabled={savingAction !== null}>
            {savingAction === 'OPEN'
              ? 'Guardando…'
              : draft
                ? 'Publicar formulario'
                : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
