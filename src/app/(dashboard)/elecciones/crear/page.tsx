'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import ImmediateStartConfig, {
  formatImmediateDuration,
  getImmediateDurationMinutes,
  type ImmediateDurationUnit,
} from '@/components/elections/ImmediateStartConfig';
import TagMembersEditor from '@/components/tags/TagMembersEditor';
import TagSelector from '@/components/tags/TagSelector';
import type { TagStudent } from '@/types/tags';

interface ElectionForm {
  title: string;
  description: string;
  is_anonymous: boolean;
  voter_source: 'FULL_PADRON' | 'MANUAL' | 'TAG';
  tag_id: string | null;
  start_immediately: boolean;
  immediate_duration_value: string;
  immediate_duration_unit: ImmediateDurationUnit;
  start_time: string;
  end_time: string;
}

interface OptionForm {
  id: string;
  label: string;
  description: string;
}

type Student = TagStudent;

interface AdminSummary {
  id: string;
}

type KeyRequirementMode = 'COUNT' | 'PERCENTAGE';

const SECTION_ITEMS = [
  { id: 'informacion', label: 'Información', description: 'Detalles y horario' },
  { id: 'votantes', label: 'Votantes', description: 'Padron elegible' },
  { id: 'opciones', label: 'Opciones', description: 'Boleta electoral' },
  { id: 'seguridad', label: 'Seguridad', description: 'Privacidad y escrutinio' },
] as const;

type SectionId = (typeof SECTION_ITEMS)[number]['id'];

const VOTER_SOURCE_OPTIONS: Array<{
  value: ElectionForm['voter_source'];
  title: string;
  description: string;
  badge: string;
}> = [
  {
    value: 'FULL_PADRON',
    title: 'Padrón completo',
    description: 'Todos los estudiantes activos del padrón pueden votar.',
    badge: 'General',
  },
  {
    value: 'MANUAL',
    title: 'Selección por filtros',
    description: 'Combina búsqueda individual con sede, carrera y agregar todos los resultados.',
    badge: 'Segmentado + curado',
  },
  {
    value: 'TAG',
    title: 'Grupo por tag',
    description: 'Usa una tag guardada para definir rápidamente quiénes pueden votar.',
    badge: 'Reutilizable',
  },
];

const KEY_REQUIREMENT_OPTIONS: Array<{
  value: KeyRequirementMode;
  title: string;
  description: string;
  badge: string;
}> = [
  {
    value: 'COUNT',
    title: 'Cantidad fija',
    description: 'Define directamente cuántas llaves de administradores se necesitan.',
    badge: 'Cantidad',
  },
  {
    value: 'PERCENTAGE',
    title: 'Porcentaje',
    description: 'Calcula el mínimo requerido con base en el total actual de administradores.',
    badge: 'Porcentaje',
  },
];

const CREATE_VOTER_EDITOR_COPY = {
  helperText: 'Busca por nombre o carnet, o filtra por sede y carrera. Puedes agregar personas individuales o todos los resultados.',
  resultsSubtitle: 'Personas encontradas en el padrón',
  selectedSubtitle: 'Personas que podrán votar en esta elección',
  searchPrompt: 'Aplica filtros y presiona Buscar para ver personas del padrón',
  selectedEmpty: 'Todavía no has agregado votantes',
  addAllTitle: 'Agrega todas las personas que cumplen con los filtros actuales al padrón de la votación',
};

const DEFAULT_IMMEDIATE_DURATION_VALUE = '15';
const DEFAULT_IMMEDIATE_DURATION_UNIT: ImmediateDurationUnit = 'minutes';
const DEFAULT_KEY_COUNT = '1';
const DEFAULT_KEY_PERCENTAGE = '50';

function isScheduledWindowValid(startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return end > start;
}

function getVoterSummary(form: ElectionForm, selectedStudents: Student[]) {
  switch (form.voter_source) {
    case 'FULL_PADRON':
      return 'Padrón completo';
    case 'MANUAL':
      return selectedStudents.length > 0
        ? `${selectedStudents.length} persona${selectedStudents.length === 1 ? '' : 's'} seleccionada${selectedStudents.length === 1 ? '' : 's'}`
        : 'Selección por filtros pendiente';
    case 'TAG':
      return form.tag_id ? 'Tag seleccionada' : 'Falta seleccionar la tag';
    default:
      return 'Sin definir';
  }
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parsePercentage(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

function getPercentageMinKeys(totalAdmins: number, percentage: number) {
  return Math.max(1, Math.ceil((totalAdmins * percentage) / 100));
}

function formatKeysLabel(count: number) {
  return `${count} llave${count === 1 ? '' : 's'}`;
}

function SelectionCard({
  selected,
  badge,
  title,
  description,
  onClick,
  children,
}: {
  selected: boolean;
  badge: string;
  title: string;
  description: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`create-election-choice-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className="create-election-choice-card__header">
        <span className="create-election-choice-card__badge">{badge}</span>
        <span className="create-election-choice-card__indicator" aria-hidden="true" />
      </div>
      <div className="create-election-choice-card__title">{title}</div>
      <div className="create-election-choice-card__description">{description}</div>
      {children ? <div className="create-election-choice-card__footer">{children}</div> : null}
    </button>
  );
}

function ToggleCard({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`create-election-toggle-card ${checked ? 'selected' : ''}`}>
      <div className="create-election-toggle-card__copy">
        <div className="create-election-toggle-card__title">{title}</div>
        <div className="create-election-toggle-card__description">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={title}
      />
    </label>
  );
}

export default function CrearEleccionPage() {
  const router = useRouter();
  const optionCounterRef = useRef(2);
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    informacion: null,
    votantes: null,
    opciones: null,
    seguridad: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('informacion');
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [adminCountLoading, setAdminCountLoading] = useState(true);
  const [adminCountError, setAdminCountError] = useState<string | null>(null);

  const [form, setForm] = useState<ElectionForm>({
    title: '',
    description: '',
    is_anonymous: true,
    voter_source: 'FULL_PADRON',
    tag_id: null,
    start_immediately: false,
    immediate_duration_value: DEFAULT_IMMEDIATE_DURATION_VALUE,
    immediate_duration_unit: DEFAULT_IMMEDIATE_DURATION_UNIT,
    start_time: '',
    end_time: '',
  });

  const [options, setOptions] = useState<OptionForm[]>([
    { id: 'option-1', label: '', description: '' },
    { id: 'option-2', label: '', description: '' },
  ]);

  const [includeBlank, setIncludeBlank] = useState(true);
  const [includeNull, setIncludeNull] = useState(true);
  const [requiresKeys, setRequiresKeys] = useState(false);
  const [keyRequirementMode, setKeyRequirementMode] = useState<KeyRequirementMode>('COUNT');
  const [keyCount, setKeyCount] = useState(DEFAULT_KEY_COUNT);
  const [keyPercentage, setKeyPercentage] = useState(DEFAULT_KEY_PERCENTAGE);

  useEffect(() => {
    let cancelled = false;

    async function fetchAdminCount() {
      try {
        const admins = await apiClient<AdminSummary[]>('/api/users/admins');
        if (!cancelled) {
          setAdminCount(admins.length);
          setAdminCountError(null);
        }
      } catch (err) {
        console.error('Error fetching admins:', err);
        if (!cancelled) {
          setAdminCount(null);
          setAdminCountError('No se pudo cargar el total de administradores');
        }
      } finally {
        if (!cancelled) setAdminCountLoading(false);
      }
    }

    fetchAdminCount();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio);

        if (visibleEntries.length === 0) {
          return;
        }

        const nextSection = visibleEntries[0].target.getAttribute('data-section-id') as SectionId | null;
        if (nextSection) {
          setActiveSection(nextSection);
        }
      },
      {
        rootMargin: '-18% 0px -52% 0px',
        threshold: [0.15, 0.35, 0.6],
      }
    );

    SECTION_ITEMS.forEach(({ id }) => {
      const node = sectionRefs.current[id];
      if (node) observer.observe(node);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  function setSectionRef(sectionId: SectionId, node: HTMLElement | null) {
    sectionRefs.current[sectionId] = node;
  }

  function scrollToSection(sectionId: SectionId) {
    setActiveSection(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateForm<K extends keyof ElectionForm>(key: K, value: ElectionForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setVoterSource(source: ElectionForm['voter_source']) {
    setError(null);
    setForm((prev) => ({
      ...prev,
      voter_source: source,
      tag_id: source === 'TAG' ? prev.tag_id : null,
    }));
  }

  function handleScheduleChange(next: {
    startTime?: string;
    endTime?: string;
    startsImmediately?: boolean;
    durationValue?: string;
    durationUnit?: ImmediateDurationUnit;
  }) {
    setError(null);
    setForm((prev) => {
      const nextForm: ElectionForm = {
        ...prev,
        start_immediately: next.startsImmediately ?? prev.start_immediately,
        start_time: next.startTime ?? prev.start_time,
        end_time: next.endTime ?? prev.end_time,
        immediate_duration_value: next.durationValue ?? prev.immediate_duration_value,
        immediate_duration_unit: next.durationUnit ?? prev.immediate_duration_unit,
      };

      if (next.startsImmediately === true) {
        nextForm.start_time = '';
        nextForm.end_time = '';
        if (!nextForm.immediate_duration_value) {
          nextForm.immediate_duration_value = DEFAULT_IMMEDIATE_DURATION_VALUE;
        }
      }

      return nextForm;
    });
  }

  function addOption() {
    optionCounterRef.current += 1;
    setOptions((prev) => [...prev, { id: `option-${optionCounterRef.current}`, label: '', description: '' }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateOption(index: number, field: keyof OptionForm, value: string) {
    setOptions((prev) =>
      prev.map((option, currentIndex) => (
        currentIndex === index ? { ...option, [field]: value } : option
      ))
    );
  }

  function resolveMinKeysForSubmit() {
    if (!requiresKeys) {
      return 1;
    }

    if (keyRequirementMode === 'COUNT') {
      const parsedCount = parsePositiveInteger(keyCount);
      if (parsedCount === null) {
        throw new Error('Define una cantidad válida de llaves de escrutinio');
      }

      if (adminCount !== null && adminCount > 0 && parsedCount > adminCount) {
        throw new Error('La cantidad de llaves no puede superar el total de administradores');
      }

      return parsedCount;
    }

    const parsedPercentage = parsePercentage(keyPercentage);
    if (parsedPercentage === null) {
      throw new Error('Define un porcentaje de administradores entre 1 y 100');
    }

    if (adminCount === null) {
      throw new Error(
        adminCountLoading
          ? 'Espera a que cargue el total de administradores'
          : 'No se pudo calcular el mínimo por porcentaje porque no se cargó el total de administradores'
      );
    }

    return getPercentageMinKeys(adminCount, parsedPercentage);
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      setError(null);

      const trimmedTitle = form.title.trim();
      const candidateOptions = options
        .map((option) => ({
          label: option.label.trim(),
          description: option.description.trim(),
        }))
        .filter((option) => option.label);

      const uniqueCandidateLabels = new Set(candidateOptions.map((option) => option.label.toLowerCase()));
      const immediateMinutes = form.start_immediately
        ? getImmediateDurationMinutes(form.immediate_duration_value, form.immediate_duration_unit)
        : null;

      if (!trimmedTitle) {
        throw new Error('Escribe un título para la votación');
      }

      if (candidateOptions.length < 2) {
        throw new Error('Agrega al menos 2 opciones de voto');
      }

      if (uniqueCandidateLabels.size !== candidateOptions.length) {
        throw new Error('Las opciones de voto no pueden repetirse');
      }

      if (form.voter_source === 'MANUAL' && selectedStudents.length === 0) {
        throw new Error('Selecciona al menos una persona del padrón para esta votación');
      }

      if (form.voter_source === 'TAG' && !form.tag_id) {
        throw new Error('Selecciona una tag para la votación');
      }

      if (form.start_immediately && !immediateMinutes) {
        throw new Error('Selecciona una duración válida para el inicio inmediato');
      }

      if (!form.start_immediately) {
        if (!form.start_time || !form.end_time) {
          throw new Error('Selecciona la fecha y hora de apertura y cierre');
        }

        if (!isScheduledWindowValid(form.start_time, form.end_time)) {
          throw new Error('La fecha de cierre debe ser posterior a la fecha de apertura');
        }
      }

      const minKeys = resolveMinKeysForSubmit();

      const allOptions: Array<{ label: string; option_type: string; description?: string }> = candidateOptions.map((option) => ({
        label: option.label,
        description: option.description || undefined,
        option_type: 'CANDIDATE',
      }));

      if (includeBlank) {
        allOptions.push({ label: 'Voto en blanco', option_type: 'BLANK' });
      }

      if (includeNull) {
        allOptions.push({ label: 'Voto nulo', option_type: 'NULL_VOTE' });
      }

      const electionData: Record<string, unknown> = {
        title: trimmedTitle,
        description: form.description.trim() || null,
        is_anonymous: form.is_anonymous,
        voter_source: form.voter_source,
        tag_id: form.voter_source === 'TAG' ? form.tag_id : null,
        starts_immediately: form.start_immediately,
        immediate_minutes: immediateMinutes,
        requires_keys: requiresKeys,
        min_keys: minKeys,
        options: allOptions.map((option, index) => ({
          label: option.label,
          option_type: option.option_type,
          description: option.description,
          display_order: index + 1,
        })),
        status: 'AUTO',
      };

      if (!form.start_immediately) {
        electionData.start_time = form.start_time;
        electionData.end_time = form.end_time;
      }

      if (form.voter_source === 'MANUAL') {
        electionData.populate = {
          student_ids: selectedStudents.map((student) => student.id),
        };
      }
      if (form.voter_source === 'TAG' && form.tag_id) {
        electionData.populate = {
          tag_id: form.tag_id,
        };
      }

      await apiClient('/api/elections', {
        method: 'POST',
        body: JSON.stringify(electionData),
      });

      router.push('/elecciones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la votación');
    } finally {
      setSaving(false);
    }
  }

  const candidateOptionsCount = options.filter((option) => option.label.trim()).length;
  const scheduleIsValid = !form.start_immediately && Boolean(form.start_time && form.end_time)
    ? isScheduledWindowValid(form.start_time, form.end_time)
    : false;
  const immediateSummary = formatImmediateDuration(form.immediate_duration_value, form.immediate_duration_unit);
  const parsedKeyCount = parsePositiveInteger(keyCount);
  const parsedKeyPercentage = parsePercentage(keyPercentage);
  const percentageMinKeys = adminCount !== null && parsedKeyPercentage !== null
    ? getPercentageMinKeys(adminCount, parsedKeyPercentage)
    : null;
  const minKeysPreview = !requiresKeys
    ? null
    : keyRequirementMode === 'COUNT'
      ? parsedKeyCount
      : percentageMinKeys;
  const adminCountLabel = adminCountLoading
    ? 'Cargando administradores'
    : adminCount === null
      ? 'Administradores no disponibles'
      : `${adminCount} administrador${adminCount === 1 ? '' : 'es'}`;
  const countExceedsAdmins = requiresKeys
    && keyRequirementMode === 'COUNT'
    && adminCount !== null
    && adminCount > 0
    && parsedKeyCount !== null
    && parsedKeyCount > adminCount;
  const keyRequirementSummary = !requiresKeys
    ? 'Sin llaves de escrutinio'
    : countExceedsAdmins
      ? 'Cantidad supera administradores'
      : minKeysPreview !== null
      ? `${formatKeysLabel(minKeysPreview)} requeridas`
      : keyRequirementMode === 'PERCENTAGE'
        ? 'Porcentaje pendiente'
        : 'Cantidad pendiente';
  const securitySummary = `${form.is_anonymous ? 'Voto anónimo' : 'Voto identificable'} - ${keyRequirementSummary}`;

  const sectionStates: Record<SectionId, { complete: boolean; summary: string }> = {
    informacion: {
      complete: Boolean(form.title.trim()) && (form.start_immediately ? Boolean(immediateSummary) : scheduleIsValid),
      summary: form.start_immediately
        ? (immediateSummary ? `Inmediata por ${immediateSummary}` : 'Falta definir la duración')
        : (scheduleIsValid ? 'Programada con apertura y cierre' : 'Falta configurar el horario'),
    },
    votantes: {
      complete: form.voter_source === 'MANUAL'
        ? selectedStudents.length > 0
        : form.voter_source === 'TAG'
          ? Boolean(form.tag_id)
          : true,
      summary: getVoterSummary(form, selectedStudents),
    },
    opciones: {
      complete: candidateOptionsCount >= 2,
      summary: `${candidateOptionsCount} opci${candidateOptionsCount === 1 ? 'ón' : 'ones'} configurada${candidateOptionsCount === 1 ? '' : 's'}`,
    },
    seguridad: {
      complete: !requiresKeys || (minKeysPreview !== null && !countExceedsAdmins),
      summary: securitySummary,
    },
  };

  const completionCount = SECTION_ITEMS.filter((section) => sectionStates[section.id].complete).length;

  return (
    <div className="create-election-page">
      <div className="card create-election-hero">
        <div className="create-election-hero__content">
          <div>
            <div className="overline create-election-hero__overline">Nueva votación</div>
            <h2 className="create-election-hero__title">Crear proceso electoral</h2>
            <p className="create-election-hero__description">
              Configura toda la votacion en una sola vista. Usa la navegacion lateral para saltar entre
              bloques sin perder contexto.
            </p>
          </div>

          <div className="create-election-hero__stats">
            <div className="create-election-hero__stat">
              <span>Progreso</span>
              <strong>{completionCount}/4</strong>
            </div>
            <div className="create-election-hero__stat">
              <span>Opciones</span>
              <strong>{candidateOptionsCount}</strong>
            </div>
            <div className="create-election-hero__stat">
              <span>Votantes</span>
              <strong>{form.voter_source === 'MANUAL' ? selectedStudents.length : 'Auto'}</strong>
            </div>
            <div className="create-election-hero__stat">
              <span>Modalidad</span>
              <strong>{form.start_immediately ? 'Inmediata' : 'Programada'}</strong>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="create-election-error">
          {error}
        </div>
      )}

      <div className="create-election-layout">
        <div className="create-election-main">
          <section
            id="informacion"
            data-section-id="informacion"
            ref={(node) => setSectionRef('informacion', node)}
            className="card create-election-section"
          >
            <div className="create-election-section__header">
              <div className="create-election-section__eyebrow">1. Información</div>
              <h3 className="create-election-section__title">Define la base del proceso electoral</h3>
              <p className="create-election-section__description">
                Título, descripción y modo de apertura. Solo eliges una modalidad: programada o inmediata.
              </p>
            </div>

            <div className="create-election-field-stack">
              <div className="input-group">
                <label>Título de la votación</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Elección Consejo Ejecutivo FITEC 2026"
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Descripción</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Postulaciones a la Vicepresidencia del Directorio"
                  value={form.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                />
              </div>

              <ImmediateStartConfig
                startTime={form.start_time}
                endTime={form.end_time}
                startsImmediately={form.start_immediately}
                durationValue={form.immediate_duration_value}
                durationUnit={form.immediate_duration_unit}
                onChange={handleScheduleChange}
              />
            </div>
          </section>
          <section
            id="votantes"
            data-section-id="votantes"
            ref={(node) => setSectionRef('votantes', node)}
            className="card create-election-section"
          >
            <div className="create-election-section__header">
              <div className="create-election-section__eyebrow">2. Votantes</div>
              <h3 className="create-election-section__title">Define quién puede participar</h3>
              <p className="create-election-section__description">
                Escoge una sola estrategia para construir el padrón elegible.
              </p>
            </div>

            <div className="create-election-choice-grid">
              {VOTER_SOURCE_OPTIONS.map((option) => (
                <SelectionCard
                  key={option.value}
                  selected={form.voter_source === option.value}
                  badge={option.badge}
                  title={option.title}
                  description={option.description}
                  onClick={() => setVoterSource(option.value)}
                >
                  {form.voter_source === option.value ? 'Seleccionado' : 'Haz clic para usar esta opción'}
                </SelectionCard>
              ))}
            </div>

            {form.voter_source === 'TAG' && (
              <TagSelector
                value={form.tag_id}
                onChange={(tagId) => updateForm('tag_id', tagId)}
                allowClear={false}
                helperText="Selecciona el grupo que se usará como padrón elegible para esta votación."
              />
            )}

            {form.voter_source === 'MANUAL' && (
              <div className="create-election-manual-stack">
                <TagMembersEditor
                  value={selectedStudents}
                  onChange={(members) => {
                    setError(null);
                    setSelectedStudents(members);
                  }}
                  copy={CREATE_VOTER_EDITOR_COPY}
                />

                <div className="create-election-helper">
                  Esta modalidad reemplaza el filtrado segmentado y la selección curada: puedes escoger personas una
                  por una o agregar de una vez a todas las que coincidan con sede, carrera o búsqueda.
                </div>
              </div>
            )}
          </section>
          <section
            id="opciones"
            data-section-id="opciones"
            ref={(node) => setSectionRef('opciones', node)}
            className="card create-election-section"
          >
            <div className="create-election-section__header">
              <div className="create-election-section__eyebrow">3. Opciones</div>
              <h3 className="create-election-section__title">Construye la boleta</h3>
              <p className="create-election-section__description">
                Agrega las opciones de voto y activa las variantes especiales si las necesitas.
              </p>
            </div>

            <div className="create-election-option-stack">
              {options.map((option, index) => (
                <div key={option.id} className="create-election-option-card">
                  <div className="create-election-option-card__header">
                    <div className="create-election-option-card__index create-election-option-card__index--candidate">
                      Opción {index + 1}
                    </div>
                    {options.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeOption(index)}
                        style={{ color: 'var(--muted)' }}
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  <div className="create-election-field-grid">
                    <div className="input-group">
                      <label>Nombre</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Ej: Candidatura A"
                        value={option.label}
                        onChange={(event) => updateOption(index, 'label', event.target.value)}
                      />
                    </div>

                    <div className="input-group">
                      <label>Descripción</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Descripcion corta opcional"
                        value={option.description}
                        onChange={(event) => updateOption(index, 'description', event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={addOption}
              style={{ alignSelf: 'flex-start' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Agregar opción
            </button>

            <div className="create-election-toggle-grid">
              <ToggleCard
                checked={includeBlank}
                title='Incluir "Voto en blanco"'
                description="Agrega una alternativa explicita para emitir voto en blanco."
                onChange={setIncludeBlank}
              />
              <ToggleCard
                checked={includeNull}
                title='Incluir "Voto nulo"'
                description="Agrega una opcion para contemplar votos anulados en la boleta."
                onChange={setIncludeNull}
              />
            </div>
          </section>

          <section
            id="seguridad"
            data-section-id="seguridad"
            ref={(node) => setSectionRef('seguridad', node)}
            className="card create-election-section"
          >
            <div className="create-election-section__header">
              <div className="create-election-section__eyebrow">4. Seguridad</div>
              <h3 className="create-election-section__title">Ajusta privacidad y escrutinio</h3>
              <p className="create-election-section__description">
                Mantiene visible la configuracion sensible de la votacion antes de publicarla.
              </p>
            </div>

            <div className="create-election-toggle-grid">
              <ToggleCard
                checked={form.is_anonymous}
                title="Voto anónimo"
                description="Separa criptográficamente la identidad del votante del voto emitido."
                onChange={(checked) => updateForm('is_anonymous', checked)}
              />
              <ToggleCard
                checked={requiresKeys}
                title="Requiere llaves de escrutinio"
                description="Los resultados se revelan cuando se alcanzan las llaves necesarias."
                onChange={(checked) => {
                  setError(null);
                  setRequiresKeys(checked);
                }}
              />
            </div>

            {requiresKeys && (
              <div className="create-election-option-stack">
                <div className="create-election-choice-grid">
                  {KEY_REQUIREMENT_OPTIONS.map((option) => (
                    <SelectionCard
                      key={option.value}
                      selected={keyRequirementMode === option.value}
                      badge={option.badge}
                      title={option.title}
                      description={option.description}
                      onClick={() => {
                        setError(null);
                        setKeyRequirementMode(option.value);
                      }}
                    >
                      {option.value === 'COUNT' ? 'Cantidad manual' : adminCountLabel}
                    </SelectionCard>
                  ))}
                </div>

                <div className="create-election-option-card">
                  <div className="create-election-option-card__header">
                    <div className="create-election-option-card__index">Llaves requeridas</div>
                    <div className="create-election-list-card__count">{adminCountLabel}</div>
                  </div>

                  <div className="create-election-field-grid">
                    {keyRequirementMode === 'COUNT' ? (
                      <div className="input-group">
                        <label>Cantidad de administradores</label>
                        <input
                          type="number"
                          className="input"
                          min={1}
                          max={adminCount ?? undefined}
                          step={1}
                          value={keyCount}
                          onChange={(event) => {
                            setError(null);
                            setKeyCount(event.target.value);
                          }}
                        />
                        <p className="create-election-inline-help">
                          {countExceedsAdmins
                            ? 'No puede superar el total actual de administradores.'
                            : 'Cantidad minima de llaves para revelar resultados.'}
                        </p>
                      </div>
                    ) : (
                      <div className="input-group">
                        <label>Porcentaje de administradores</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            className="input"
                            min={1}
                            max={100}
                            step={1}
                            value={keyPercentage}
                            onChange={(event) => {
                              setError(null);
                              setKeyPercentage(event.target.value);
                            }}
                            style={{ paddingRight: '2.4rem' }}
                          />
                          <span
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              right: '0.85rem',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: 'var(--muted)',
                              fontWeight: 700,
                            }}
                          >
                            %
                          </span>
                        </div>
                        <p className="create-election-inline-help">
                          {percentageMinKeys !== null
                            ? `Mínimo calculado: ${formatKeysLabel(percentageMinKeys)}.`
                            : 'El mínimo se calculará cuando carguen los administradores.'}
                        </p>
                      </div>
                    )}

                    <div className="input-group">
                      <label>Total de administradores</label>
                      <input
                        type="text"
                        className="input"
                        value={adminCountLabel}
                        readOnly
                      />
                      <p className="create-election-inline-help">
                        Total cargado desde la lista actual de administradores.
                      </p>
                    </div>
                  </div>

                  {adminCountError && keyRequirementMode === 'PERCENTAGE' && (
                    <div className="create-election-helper" style={{ color: 'var(--error)' }}>
                      {adminCountError}. No se puede calcular un porcentaje sin ese dato.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <div className="card create-election-submit-card">
            <div>
              <div className="create-election-submit-card__title">Listo para crear la votación</div>
              <div className="create-election-submit-card__description">
                Revisa el resumen lateral. Si algo falta, salta al bloque correspondiente y ajustalo.
              </div>
            </div>
            <button type="button" className="btn btn-accent" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creando...' : 'Crear votación'}
            </button>
          </div>
        </div>

        <aside className="create-election-sidebar">
          <div className="card create-election-sidebar-card">
            <div className="create-election-sidebar-card__header">
              <div className="overline">Navegación</div>
              <p>Salta a cualquier bloque del formulario.</p>
            </div>

            <div className="create-election-nav-list">
              {SECTION_ITEMS.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  className={`create-election-nav-item ${activeSection === section.id ? 'active' : ''} ${sectionStates[section.id].complete ? 'complete' : ''}`}
                  onClick={() => scrollToSection(section.id)}
                >
                  <div className="create-election-nav-item__index">
                    {sectionStates[section.id].complete ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : index + 1}
                  </div>
                  <div className="create-election-nav-item__copy">
                    <div className="create-election-nav-item__label">{section.label}</div>
                    <div className="create-election-nav-item__description">{section.description}</div>
                    <div className="create-election-nav-item__summary">{sectionStates[section.id].summary}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card create-election-sidebar-card">
            <div className="create-election-sidebar-card__header">
              <div className="overline">Resumen</div>
              <p>Estado actual de la configuracion.</p>
            </div>

            <div className="create-election-summary-list">
              <div className="create-election-summary-item">
                <span>Título</span>
                <strong>{form.title.trim() || 'Pendiente'}</strong>
              </div>
              <div className="create-election-summary-item">
                <span>Horario</span>
                <strong>{sectionStates.informacion.summary}</strong>
              </div>
              <div className="create-election-summary-item">
                <span>Padrón</span>
                <strong>{sectionStates.votantes.summary}</strong>
              </div>
              <div className="create-election-summary-item">
                <span>Boleta</span>
                <strong>
                  {candidateOptionsCount} opci{candidateOptionsCount === 1 ? 'ón' : 'ones'}
                </strong>
              </div>
              <div className="create-election-summary-item">
                <span>Privacidad</span>
                <strong>{form.is_anonymous ? 'Anónima' : 'No anónima'}</strong>
              </div>
              <div className="create-election-summary-item">
                <span>Escrutinio</span>
                <strong>{keyRequirementSummary}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
