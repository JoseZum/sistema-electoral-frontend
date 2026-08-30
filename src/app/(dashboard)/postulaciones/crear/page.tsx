'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TagSelector from '@/components/tags/TagSelector';
import { apiClient } from '@/lib/api-client';
import { createForm } from '@/lib/postulaciones-api';
import { FILE_FIELDS } from '@/lib/postulaciones-fields';
import type { Election } from '@/types/elections';
import type { VoterSource } from '@/types/postulaciones';

interface FormState {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  publish: boolean;
  allow_other_documents: boolean;
  other_documents_label: string;
  voter_source: VoterSource;
  sede: string;
  career: string;
  tag_id: string | null;
  election_id: string;
  /** Puestos a crear junto con el formulario; se pueden editar después. */
  positions: string[];
}

interface FormErrors {
  title?: string;
  end_time?: string;
  audience?: string;
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

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.title.trim()) {
    errors.title = 'El formulario necesita un título';
  }

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

export default function CrearPostulacionPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    publish: true,
    allow_other_documents: false,
    other_documents_label: '',
    voter_source: 'FULL_PADRON',
    sede: '',
    career: '',
    tag_id: null,
    election_id: '',
    positions: [],
  });
  const [nuevoPuesto, setNuevoPuesto] = useState('');

  const [catalog, setCatalog] = useState<{ sedes: string[]; careers: string[] }>({
    sedes: [],
    careers: [],
  });
  const [elections, setElections] = useState<Election[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validate(form);

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
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setError(null);

    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const created = await createForm({
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.publish ? 'OPEN' : 'DRAFT',
        start_time: toIso(form.start_time),
        end_time: toIso(form.end_time),
        allow_other_documents: form.allow_other_documents,
        other_documents_label: form.other_documents_label.trim() || null,
        voter_source: form.voter_source,
        voter_filter:
          form.voter_source === 'FILTERED'
            ? { sede: form.sede || undefined, career: form.career || undefined }
            : null,
        tag_id: form.voter_source === 'TAG' ? form.tag_id : null,
        election_id: form.election_id || null,
        positions: form.positions,
      });

      router.push(`/postulaciones/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el formulario');
      setSaving(false);
    }
  }

  const showError = (key: keyof FormErrors) => submitAttempted && errors[key];

  return (
    <div className="view-enter">
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="overline" style={{ marginBottom: '0.75rem' }}>Nuevo formulario</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 500 }}>
          Crear formulario de postulación
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Define el título, la ventana de tiempo y a quién va dirigido. Los campos que llena el
          postulante son fijos.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 820 }}>
        {/* 1. Información */}
        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">1. Información</div>

          <div className="input-group">
            <label htmlFor="title">Título del formulario</label>
            <input
              id="title"
              className="input"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
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
              onChange={(e) => update('description', e.target.value)}
              placeholder="Explica brevemente de qué se trata la convocatoria"
            />
          </div>
        </section>

        {/* 2. Ventana de tiempo */}
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
                onChange={(e) => update('start_time', e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                Si lo dejas vacío, abre de inmediato
              </span>
            </div>

            <div className="input-group">
              <label htmlFor="end_time">Cierre</label>
              <input
                id="end_time"
                type="datetime-local"
                className="input"
                value={form.end_time}
                onChange={(e) => update('end_time', e.target.value)}
              />
              {showError('end_time') && (
                <div className="postulacion-field-error">{errors.end_time}</div>
              )}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={form.publish}
              onChange={(e) => update('publish', e.target.checked)}
            />
            Publicar ahora (si lo desmarcas queda como borrador y nadie lo verá)
          </label>
        </section>

        {/* 3. Audiencia */}
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
                  onChange={(e) => update('sede', e.target.value)}
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
                  onChange={(e) => update('career', e.target.value)}
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

        {/* 4. Puestos */}
        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">4. Puestos disponibles</div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
            El postulante tendrá que elegir uno al enviar. Si no agregas ninguno, no se le
            preguntará. Podrás añadir o quitar puestos después, aunque el formulario ya esté
            abierto.
          </p>

          {form.positions.length > 0 && (
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {form.positions.map((puesto, indice) => (
                <div key={`${puesto}-${indice}`} className="postulacion-position-row">
                  <span className="postulacion-position-name">{puesto}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      update('positions', form.positions.filter((_, i) => i !== indice))
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
              onChange={(e) => setNuevoPuesto(e.target.value)}
              onKeyDown={(e) => {
                // Enter agrega el puesto en vez de enviar el formulario entero.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const nombre = nuevoPuesto.trim();
                  if (nombre && !form.positions.includes(nombre)) {
                    update('positions', [...form.positions, nombre]);
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
        </section>

        {/* 5. Documentos */}
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
              onChange={(e) => update('allow_other_documents', e.target.checked)}
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
                onChange={(e) => update('other_documents_label', e.target.value)}
                placeholder="Ej. Currículum, plan de trabajo…"
              />
            </div>
          )}
        </section>

        {/* 6. Votación asociada */}
        <section className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div className="overline">6. Votación asociada (opcional)</div>

          <div className="input-group">
            <label htmlFor="election_id">Votación</label>
            <select
              id="election_id"
              className="input"
              value={form.election_id}
              onChange={(e) => update('election_id', e.target.value)}
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

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Link href="/postulaciones" className="btn btn-ghost">Cancelar</Link>
          <button type="submit" className="btn btn-accent" disabled={saving}>
            {saving ? 'Creando…' : 'Crear formulario'}
          </button>
        </div>
      </form>
    </div>
  );
}
