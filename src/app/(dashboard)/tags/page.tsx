'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import TagBadge from '@/components/tags/TagBadge';
import TagMembersEditor from '@/components/tags/TagMembersEditor';
import { DEFAULT_TAG_COLOR, TAG_COLOR_OPTIONS } from '@/lib/tag-colors';
import { createTag, deleteTag, getTag, listTags, updateTag } from '@/lib/tags-api';
import type { TagStudent, TagSummary } from '@/types/tags';
import Loader from '@/components/Loader';

type TagFormState = {
  name: string;
  description: string;
  color: string;
  members: TagStudent[];
};

type TagFormErrors = {
  name?: string;
  members?: string;
};

const EMPTY_FORM: TagFormState = {
  name: '',
  description: '',
  color: DEFAULT_TAG_COLOR,
  members: [],
};

const EMPTY_TOUCHED_STATE = {
  name: false,
  members: false,
};

function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function validateTagForm(form: TagFormState, tags: TagSummary[], selectedTagId: string | null): TagFormErrors {
  const errors: TagFormErrors = {};
  const normalizedName = normalizeTagName(form.name);

  if (!normalizedName) {
    errors.name = 'Ingresa un nombre para la tag';
  } else {
    const duplicateName = tags.some(
      (tag) => tag.id !== selectedTagId && normalizeTagName(tag.name).toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
    );

    if (duplicateName) {
      errors.name = 'Ya existe una tag con ese nombre';
    }
  }

  if (form.members.length === 0) {
    errors.members = 'Selecciona al menos una persona del padrón';
  }

  return errors;
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [form, setForm] = useState<TagFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState(EMPTY_TOUCHED_STATE);

  const validationErrors = validateTagForm(form, tags, selectedTagId);
  const isFormValid = Object.keys(validationErrors).length === 0;
  const showNameError = Boolean(validationErrors.name && (submitAttempted || touched.name));
  const showMembersError = Boolean(validationErrors.members && (submitAttempted || touched.members));

  const resetValidationState = useCallback(() => {
    setSubmitAttempted(false);
    setTouched(EMPTY_TOUCHED_STATE);
  }, []);

  const loadTags = useCallback(async (nextSelectedId?: string | null) => {
    const data = await listTags();
    setTags(data || []);

    const resolvedId = nextSelectedId === undefined ? selectedTagId : nextSelectedId;
    if (!resolvedId) {
      return;
    }

    const exists = (data || []).some((tag) => tag.id === resolvedId);
    if (!exists) {
      setSelectedTagId(null);
      setForm(EMPTY_FORM);
      resetValidationState();
    }
  }, [resetValidationState, selectedTagId]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setLoading(true);
        const data = await listTags();
        if (!cancelled) {
          setTags(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading tags:', err);
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las tags');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSelectTag(tagId: string) {
    try {
      setError(null);
      setDetailLoading(true);
      const detail = await getTag(tagId);
      setSelectedTagId(detail.id);
      setForm({
        name: detail.name,
        description: detail.description || '',
        color: detail.color || DEFAULT_TAG_COLOR,
        members: detail.members,
      });
      resetValidationState();
    } catch (err) {
      console.error('Error loading tag detail:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar la tag');
    } finally {
      setDetailLoading(false);
    }
  }

  function handleCreateNew() {
    setError(null);
    setSelectedTagId(null);
    setForm(EMPTY_FORM);
    resetValidationState();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setTouched({ name: true, members: true });

    if (!isFormValid) {
      setError('Revisa los campos marcados antes de guardar la tag');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: normalizeTagName(form.name),
        description: form.description.trim() || null,
        color: form.color,
        student_ids: form.members.map((member) => member.id),
      };

      if (selectedTagId) {
        const updated = await updateTag(selectedTagId, payload);
        await loadTags(updated.id);
        await handleSelectTag(updated.id);
      } else {
        const created = await createTag(payload);
        await loadTags(created.id);
        await handleSelectTag(created.id);
      }
    } catch (err) {
      console.error('Error saving tag:', err);
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tag');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedTagId) return;

    const confirmed = window.confirm('Esta acción eliminará la tag y su configuración de miembros. ¿Deseas continuar?');
    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);
      await deleteTag(selectedTagId);
      setSelectedTagId(null);
      setForm(EMPTY_FORM);
      resetValidationState();
      await loadTags(null);
    } catch (err) {
      console.error('Error deleting tag:', err);
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la tag');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div className="overline" style={{ marginBottom: '0.75rem' }}>Padrón segmentado</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}>Tags de votantes</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Guarda grupos selectos del padrón para reutilizarlos al crear votaciones.
          </p>
        </div>

        <button className="btn btn-accent" onClick={handleCreateNew} disabled={saving}>
          Nueva tag
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--error-light)',
            border: '1px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            color: 'var(--error)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)', gap: '1.5rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Tags disponibles</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Grupos reutilizables del padrón</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{tags.length}</div>
          </div>

          <div style={{ minHeight: 320, maxHeight: 560, overflowY: 'auto' }}>
            {loading ? (
              <Loader />
            ) : tags.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
                Todavía no has creado tags.
              </div>
            ) : (
              tags.map((tag) => {
                const isActive = selectedTagId === tag.id;

                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleSelectTag(tag.id)}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: isActive ? 'var(--surface)' : 'transparent',
                      textAlign: 'left',
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    <TagBadge label={tag.name} color={tag.color} size="sm" className="tag-badge--table" leadingIcon="tag" />
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {tag.member_count} integrante{tag.member_count === 1 ? '' : 's'}
                    </div>
                    {tag.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted-light)', marginTop: '0.35rem' }}>
                        {tag.description}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <form className="card" style={{ padding: '1.5rem' }} onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                {selectedTagId ? 'Editar tag' : 'Nueva tag'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                {selectedTagId
                  ? 'Actualiza el nombre, la descripción y las personas incluidas en este grupo.'
                  : 'Crea una configuración reutilizable con personas específicas del padrón.'}
              </div>
              {form.name.trim() && (
                <div style={{ marginTop: '0.85rem' }}>
                  <TagBadge label={form.name.trim()} color={form.color} className="tag-badge--table" leadingIcon="tag" />
                </div>
              )}
            </div>

            <div className="input-group">
              <label>Nombre</label>
              <input
                className="input"
                placeholder="Ej: AGE-21-04-25"
                value={form.name}
                onChange={(event) => {
                  setError(null);
                  setForm((prev) => ({ ...prev, name: event.target.value }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                disabled={saving || detailLoading}
              />
              {showNameError && (
                <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.4rem' }}>
                  {validationErrors.name}
                </p>
              )}
            </div>

            <div className="input-group">
              <label>Descripción (opcional)</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Describe para qué se usa este grupo"
                value={form.description}
                onChange={(event) => {
                  setError(null);
                  setForm((prev) => ({ ...prev, description: event.target.value }));
                }}
                disabled={saving || detailLoading}
              />
            </div>

            <div className="input-group">
              <label>Color</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {TAG_COLOR_OPTIONS.map((option) => {
                  const isSelected = form.color === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isSelected}
                      title={option.label}
                      onClick={() => {
                        setError(null);
                        setForm((prev) => ({ ...prev, color: option.value }));
                      }}
                      disabled={saving || detailLoading}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '999px',
                        border: isSelected ? '3px solid var(--ink)' : '1px solid rgba(15, 23, 42, 0.18)',
                        background: option.value,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: saving || detailLoading ? 'not-allowed' : 'pointer',
                        boxShadow: isSelected ? '0 0 0 4px rgba(15, 23, 42, 0.08)' : 'none',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.45rem' }}>
                El color que elijas se mantendrá en todos los lugares donde aparezca esta tag.
              </p>
            </div>

            {detailLoading ? (
              <Loader />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <TagMembersEditor
                  value={form.members}
                  onChange={(members) => {
                    setError(null);
                    setTouched((prev) => ({ ...prev, members: true }));
                    setForm((prev) => ({ ...prev, members }));
                  }}
                />
                {showMembersError && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--error)', margin: 0 }}>
                    {validationErrors.members}
                  </p>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', maxWidth: 420 }}>
              Las tags no crean la votación por sí solas. Deben tener nombre único y al menos una persona del padrón.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {selectedTagId && (
                <button type="button" className="btn btn-outline" onClick={handleDelete} disabled={saving}>
                  Eliminar
                </button>
              )}
              <button type="submit" className="btn btn-accent" disabled={saving || detailLoading}>
                {saving ? 'Guardando...' : selectedTagId ? 'Guardar cambios' : 'Crear tag'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
