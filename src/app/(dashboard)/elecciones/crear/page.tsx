'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface ElectionForm {
  title: string;
  description: string;
  is_anonymous: boolean;
  voter_source: 'FULL_PADRON' | 'FILTERED' | 'MANUAL';
  voter_filter_sede: string;
  voter_filter_career: string;
  start_time: string;
  end_time: string;
}

interface OptionForm {
  label: string;
  description: string;
}

interface Student {
  id: string;
  carnet: string;
  full_name: string;
  email: string;
  sede: string;
  career: string;
}

interface StudentsResponse {
  students: Student[];
  total: number;
}

interface StudentCatalogResponse {
  sedes: string[];
  careers: string[];
}

const STEPS = ['Informacion', 'Votantes', 'Opciones', 'Seguridad'];

export default function CrearEleccionPage() {
  const router = useRouter();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalog, setCatalog] = useState<StudentCatalogResponse>({ sedes: [], careers: [] });
  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<Student[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);

  const [form, setForm] = useState<ElectionForm>({
    title: '',
    description: '',
    is_anonymous: true,
    voter_source: 'FULL_PADRON',
    voter_filter_sede: '',
    voter_filter_career: '',
    start_time: '',
    end_time: '',
  });

  const [options, setOptions] = useState<OptionForm[]>([
    { label: '', description: '' },
    { label: '', description: '' },
  ]);

  const [includeBlank, setIncludeBlank] = useState(true);
  const [includeNull, setIncludeNull] = useState(true);
  const [requiresKeys, setRequiresKeys] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchCatalog() {
      try {
        const response = await apiClient<StudentCatalogResponse>('/api/users/students/catalog');
        if (!cancelled) {
          setCatalog({
            sedes: response.sedes || [],
            careers: response.careers || [],
          });
        }
      } catch (err) {
        console.error('Error fetching student catalog:', err);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    fetchCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (form.voter_source !== 'MANUAL') {
      setManualResults([]);
      setManualSearching(false);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      return;
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (manualSearch.trim().length < 2) {
      setManualResults([]);
      setManualSearching(false);
      return;
    }

    let cancelled = false;

    searchTimerRef.current = setTimeout(async () => {
      setManualSearching(true);
      try {
        const params = new URLSearchParams();
        params.set('search', manualSearch.trim());
        params.set('limit', '10');
        if (form.voter_filter_sede) params.set('sede', form.voter_filter_sede);
        if (form.voter_filter_career) params.set('career', form.voter_filter_career);

        const response = await apiClient<StudentsResponse>(`/api/users/students?${params.toString()}`);
        const selectedIds = new Set(selectedStudents.map((student) => student.id));

        if (!cancelled) {
          setManualResults((response.students || []).filter((student) => !selectedIds.has(student.id)));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error searching students:', err);
          setManualResults([]);
        }
      } finally {
        if (!cancelled) setManualSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [form.voter_filter_career, form.voter_filter_sede, form.voter_source, manualSearch, selectedStudents]);

  function updateForm<K extends keyof ElectionForm>(key: K, value: ElectionForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setVoterSource(source: ElectionForm['voter_source']) {
    setError(null);
    updateForm('voter_source', source);
  }

  function addOption() {
    setOptions((prev) => [...prev, { label: '', description: '' }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOption(index: number, field: keyof OptionForm, value: string) {
    setOptions((prev) => prev.map((option, i) => (i === index ? { ...option, [field]: value } : option)));
  }

  function addManualStudent(student: Student) {
    setSelectedStudents((prev) => (prev.some((current) => current.id === student.id) ? prev : [...prev, student]));
  }

  function removeManualStudent(studentId: string) {
    setSelectedStudents((prev) => prev.filter((student) => student.id !== studentId));
  }

  function nextStep() {
    if (step < 4) setStep(step + 1);
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  async function handleSubmit(asDraft: boolean) {
    try {
      setSaving(true);
      setError(null);

      if (!asDraft && form.voter_source === 'MANUAL' && selectedStudents.length === 0) {
        throw new Error('Selecciona al menos una persona del padron para una votacion manual');
      }

      const electionData: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        is_anonymous: form.is_anonymous,
        voter_source: form.voter_source,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      };

      if (form.voter_source === 'FILTERED') {
        const filter: Record<string, string> = {};
        if (form.voter_filter_sede) filter.sede = form.voter_filter_sede;
        if (form.voter_filter_career) filter.career = form.voter_filter_career;
        electionData.voter_filter = filter;
      }

      const created = await apiClient<{ id: string }>('/api/elections', {
        method: 'POST',
        body: JSON.stringify(electionData),
      });

      const electionId = created.id;
      const allOptions: Array<{ label: string; option_type: string }> = options
        .filter((option) => option.label.trim())
        .map((option) => ({ label: option.label, option_type: 'CANDIDATE' }));

      if (includeBlank) allOptions.push({ label: 'Voto en blanco', option_type: 'BLANK' });
      if (includeNull) allOptions.push({ label: 'Voto nulo', option_type: 'NULL_VOTE' });

      for (let i = 0; i < allOptions.length; i += 1) {
        await apiClient(`/api/elections/${electionId}/options`, {
          method: 'POST',
          body: JSON.stringify({
            label: allOptions[i].label,
            option_type: allOptions[i].option_type,
            display_order: i + 1,
          }),
        });
      }

      const populateBody: Record<string, unknown> = {};
      if (form.voter_source === 'FILTERED') {
        if (form.voter_filter_sede) populateBody.sede = form.voter_filter_sede;
        if (form.voter_filter_career) populateBody.career = form.voter_filter_career;
      }
      if (form.voter_source === 'MANUAL') {
        populateBody.student_ids = selectedStudents.map((student) => student.id);
      }

      await apiClient(`/api/elections/${electionId}/voters/populate`, {
        method: 'POST',
        body: JSON.stringify(populateBody),
      });

      if (!asDraft && form.start_time) {
        await apiClient(`/api/elections/${electionId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'SCHEDULED' }),
        });
      }

      router.push('/elecciones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la votacion');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div className="overline" style={{ marginBottom: '0.75rem' }}>Nueva votacion</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}>Crear proceso electoral</h2>
        <p style={{ color: 'var(--muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          Configura los detalles de la votacion paso a paso.
        </p>
      </div>

      <div className="wizard-steps">
        {STEPS.map((label, index) => {
          const stepNum = index + 1;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;

          return (
            <div key={label} style={{ display: 'contents' }}>
              {index > 0 && <div className={`wizard-step-line ${isCompleted ? 'completed' : ''}`} />}
              <div className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                <div className="wizard-step-num">{isCompleted ? 'OK' : stepNum}</div>
                <div className="wizard-step-label">{label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--error-light)',
            border: '1px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            color: 'var(--error)',
          }}
        >
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label>Titulo de la votacion</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Eleccion Consejo Ejecutivo FITEC 2026"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Descripcion (opcional)</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Postulaciones a la Vicepresidencia del Directorio..."
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="input-group">
                <label>Fecha y hora de apertura</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.start_time}
                  onChange={(event) => updateForm('start_time', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Fecha y hora de cierre</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.end_time}
                  onChange={(event) => updateForm('end_time', event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label>Origen de los votantes</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  className={`radio-label ${form.voter_source === 'FULL_PADRON' ? 'selected' : ''}`}
                  onClick={() => setVoterSource('FULL_PADRON')}
                >
                  <input
                    type="radio"
                    name="voter-source"
                    checked={form.voter_source === 'FULL_PADRON'}
                    readOnly
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Padron completo</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      Todos los estudiantes activos del padron pueden votar.
                    </div>
                  </div>
                </div>

                <div
                  className={`radio-label ${form.voter_source === 'FILTERED' ? 'selected' : ''}`}
                  onClick={() => setVoterSource('FILTERED')}
                >
                  <input
                    type="radio"
                    name="voter-source"
                    checked={form.voter_source === 'FILTERED'}
                    readOnly
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Filtrar por sede o carrera</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      Usa las carreras y sedes reales cargadas en la base de datos.
                    </div>
                  </div>
                </div>

                <div
                  className={`radio-label ${form.voter_source === 'MANUAL' ? 'selected' : ''}`}
                  onClick={() => setVoterSource('MANUAL')}
                >
                  <input
                    type="radio"
                    name="voter-source"
                    checked={form.voter_source === 'MANUAL'}
                    readOnly
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Seleccion manual</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      Busca personas del padron y agregalas una por una, igual que en Admin Manager.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(form.voter_source === 'FILTERED' || form.voter_source === 'MANUAL') && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div className="input-group">
                  <label>Sede</label>
                  <select
                    className="input"
                    value={form.voter_filter_sede}
                    onChange={(event) => updateForm('voter_filter_sede', event.target.value)}
                    disabled={catalogLoading}
                  >
                    <option value="">Todas las sedes</option>
                    {catalog.sedes.map((sede) => (
                      <option key={sede} value={sede}>
                        {sede}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label>Carrera</label>
                  <select
                    className="input"
                    value={form.voter_filter_career}
                    onChange={(event) => updateForm('voter_filter_career', event.target.value)}
                    disabled={catalogLoading}
                  >
                    <option value="">Todas las carreras</option>
                    {catalog.careers.map((career) => (
                      <option key={career} value={career}>
                        {career}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {form.voter_source === 'FILTERED' && (
              <div
                style={{
                  padding: '0.875rem 1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  fontSize: '0.8125rem',
                  color: 'var(--muted)',
                }}
              >
                Puedes combinar sede y carrera. Si dejas ambos filtros vacios, la eleccion usara el padron completo.
              </div>
            )}

            {form.voter_source === 'MANUAL' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                  <label>Buscar personas del padron</label>
                  <div style={{ position: 'relative' }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--muted)"
                      strokeWidth="2"
                      style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      className="input"
                      placeholder="Nombre, carnet o correo..."
                      value={manualSearch}
                      onChange={(event) => setManualSearch(event.target.value)}
                      style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    />
                    {manualSearching && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2"
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          animation: 'spin 1s linear infinite',
                        }}
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                    Busca igual que en Admin Manager. Tambien puedes filtrar antes por sede o carrera.
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                        <div style={{ fontWeight: 600 }}>Resultados</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Personas encontradas en el padron</div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{manualResults.length}</div>
                    </div>

                    <div style={{ minHeight: 240, maxHeight: 360, overflowY: 'auto' }}>
                      {manualSearch.trim().length < 2 ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2.5rem 1rem',
                            color: 'var(--muted)',
                            textAlign: 'center',
                          }}
                        >
                          <p style={{ fontSize: '0.875rem' }}>Escribe al menos 2 caracteres para buscar</p>
                        </div>
                      ) : manualResults.length === 0 && !manualSearching ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2.5rem 1rem',
                            color: 'var(--muted)',
                            textAlign: 'center',
                          }}
                        >
                          <p style={{ fontSize: '0.875rem' }}>No se encontraron estudiantes</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                            Ajusta la busqueda o cambia los filtros
                          </p>
                        </div>
                      ) : (
                        manualResults.map((student) => (
                          <div
                            key={student.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.875rem 1.25rem',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{student.full_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                {student.carnet} · {student.email}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                                {student.sede} · {student.career}
                              </div>
                            </div>

                            <button
                              className="btn btn-accent btn-sm"
                              onClick={() => addManualStudent(student)}
                              style={{ flexShrink: 0 }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              Agregar
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                        <div style={{ fontWeight: 600 }}>Seleccionadas</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          Personas que podran ver y votar esta eleccion
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{selectedStudents.length}</div>
                    </div>

                    <div style={{ minHeight: 240, maxHeight: 360, overflowY: 'auto' }}>
                      {selectedStudents.length === 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2.5rem 1rem',
                            color: 'var(--muted)',
                            textAlign: 'center',
                          }}
                        >
                          <p style={{ fontSize: '0.875rem' }}>Todavia no has agregado personas</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                            Usa la busqueda para seleccionar votantes individuales
                          </p>
                        </div>
                      ) : (
                        selectedStudents.map((student) => (
                          <div
                            key={student.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.875rem 1.25rem',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{student.full_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                {student.carnet} · {student.email}
                              </div>
                            </div>

                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeManualStudent(student.id)}
                              style={{ color: 'var(--error)', flexShrink: 0 }}
                            >
                              Quitar
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label>Opciones de voto</label>
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Agrega las opciones que apareceran en la boleta.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {options.map((option, index) => (
                  <div key={index} className="option-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, width: 20 }}>
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        className="input"
                        placeholder="Nombre candidato"
                        value={option.label}
                        onChange={(event) => updateOption(index, 'label', event.target.value)}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="Descripcion (Opcional)"
                        value={option.description}
                        onChange={(event) => updateOption(index, 'description', event.target.value)}
                        style={{ flex: 2 }}
                      />
                    </div>

                    {options.length > 2 && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => removeOption(index)}
                        style={{ width: 28, height: 28, color: 'var(--muted)', padding: 0 }}
                      >
                        X
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button className="btn btn-outline btn-sm" onClick={addOption} style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar opcion
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={includeBlank}
                  onChange={(event) => setIncludeBlank(event.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Incluir &quot;Voto en blanco&quot;
              </label>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={includeNull}
                  onChange={(event) => setIncludeNull(event.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Incluir &quot;Voto nulo&quot;
              </label>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={form.is_anonymous}
                  onChange={(event) => updateForm('is_anonymous', event.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Voto anonimo (secreto)
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem', marginLeft: '1.5rem' }}>
                El voto se separa criptograficamente de la identidad del votante.
              </p>
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={requiresKeys}
                  onChange={(event) => setRequiresKeys(event.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Requiere llaves de escrutinio
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem', marginLeft: '1.5rem' }}>
                Los resultados solo se revelan cuando la mayoria del directorio ingresa su llave.
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
        <div>
          {step === 1 ? (
            <button className="btn btn-outline" onClick={() => handleSubmit(true)} disabled={saving || !form.title.trim()}>
              Guardar como borrador
            </button>
          ) : (
            <button className="btn btn-outline" onClick={prevStep}>
              Anterior
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {step > 1 && (
            <button className="btn btn-outline" onClick={() => handleSubmit(true)} disabled={saving || !form.title.trim()}>
              Guardar como borrador
            </button>
          )}

          {step < 4 ? (
            <button className="btn btn-accent" onClick={nextStep} disabled={step === 1 && !form.title.trim()}>
              Siguiente
            </button>
          ) : (
            <button className="btn btn-accent" onClick={() => handleSubmit(false)} disabled={saving}>
              {saving ? 'Creando...' : 'Crear votacion'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
