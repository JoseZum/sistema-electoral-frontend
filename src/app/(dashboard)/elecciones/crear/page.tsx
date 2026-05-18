'use client';

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { prepareBallotImage } from '@/lib/ballot-image-upload';
import ImmediateStartConfig, {
  formatImmediateDuration,
  getImmediateDurationMinutes,
  type ImmediateDurationUnit,
} from '@/components/elections/ImmediateStartConfig';
import { getSuffrageLabel } from '@/lib/suffrage';
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

interface BallotImageFormState {
  image_url: string;
  image_input: string;
  image_name: string;
}

interface SuboptionForm extends BallotImageFormState {
  id: string;
  label: string;
  description: string;
}

interface OptionForm extends BallotImageFormState {
  id: string;
  label: string;
  description: string;
  suboptions: SuboptionForm[];
}

type Student = TagStudent;

interface AdminSummary {
  id: string;
}

type KeyRequirementMode = 'COUNT' | 'PERCENTAGE';

interface CreateElectionPayloadOption {
  label: string;
  option_type: string;
  description?: string;
  image_url?: string;
  display_order: number;
  suboptions?: CreateElectionPayloadOption[];
}

const SECTION_ITEMS = [
  { id: 'informacion', label: 'Información', description: 'Detalles y horario' },
  { id: 'votantes', label: 'Votantes', description: 'Padron elegible' },
  { id: 'opciones', label: 'Opciones', description: 'Boleta electoral' },
  { id: 'sufragio', label: 'Sufragio', description: 'Modalidad del voto' },
  { id: 'seguridad', label: 'Seguridad', description: 'Llaves de escrutinio' },
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

const SUFFRAGE_OPTIONS: Array<{
  value: boolean;
  title: string;
  description: string;
  badge: string;
}> = [
  {
    value: false,
    title: 'Sufragio público',
    description: 'La opcion elegida queda visible por persona en resultados y reportes.',
    badge: 'Nominal',
  },
  {
    value: true,
    title: 'Sufragio por papeleta',
    description: 'El reporte solo muestra si la persona participo o no, sin revelar la opcion elegida.',
    badge: 'Reservado',
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
const EMPTY_BALLOT_IMAGE = {
  image_url: '',
  image_input: '',
  image_name: '',
} as const;

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

function BallotImageField({
  imageUrl,
  imageInput,
  imageName,
  uploading,
  urlAriaLabel,
  uploadAriaLabel,
  onUrlChange,
  onFileChange,
  onClear,
}: {
  imageUrl: string;
  imageInput: string;
  imageName: string;
  uploading: boolean;
  urlAriaLabel: string;
  uploadAriaLabel: string;
  onUrlChange: (value: string) => void;
  onFileChange: (file: File | null) => Promise<void> | void;
  onClear: () => void;
}) {
  const hasImage = Boolean(imageUrl);
  const sourceLabel = imageName
    ? `Archivo cargado: ${imageName}`
    : imageInput.trim()
      ? 'URL configurada'
      : 'Sin imagen seleccionada';

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    await onFileChange(file);
    input.value = '';
  }

  return (
    <div className="input-group create-election-image-field">
      <label>Imagen</label>

      <div className="create-election-image-field__stack">
        {hasImage ? (
          <div className="create-election-image-preview">
            <img src={imageUrl} alt="" className="create-election-image-preview__media" />
            <div className="create-election-image-preview__meta">
              <strong>Vista previa lista</strong>
              <span>{sourceLabel}</span>
            </div>
          </div>
        ) : (
          <div className="create-election-image-placeholder">Todavía no has cargado una foto para esta boleta.</div>
        )}

        <div className="create-election-image-actions">
          <label className={`create-election-upload-button ${uploading ? 'is-busy' : ''}`}>
            <input
              type="file"
              accept="image/*"
              aria-label={uploadAriaLabel}
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              disabled={uploading}
            />
            {uploading ? 'Procesando...' : hasImage ? 'Reemplazar foto' : 'Subir foto'}
          </label>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClear}
            disabled={!hasImage || uploading}
          >
            Quitar
          </button>
        </div>

        <input
          type="url"
          className="input"
          aria-label={urlAriaLabel}
          placeholder="https://.../imagen.jpg"
          value={imageInput}
          onChange={(event) => onUrlChange(event.target.value)}
        />
        <p className="create-election-inline-help">
          Sube la imagen desde tu dispositivo o, si ya existe, pega una URL. La vista previa usará la versión que
          quede guardada en la boleta.
        </p>
      </div>
    </div>
  );
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
  const suboptionCounterRef = useRef(4);
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    informacion: null,
    votantes: null,
    opciones: null,
    sufragio: null,
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
    {
      id: 'option-1',
      label: '',
      description: '',
      ...EMPTY_BALLOT_IMAGE,
      suboptions: [
        { id: 'suboption-1', label: '', description: '', ...EMPTY_BALLOT_IMAGE },
        { id: 'suboption-2', label: '', description: '', ...EMPTY_BALLOT_IMAGE },
      ],
    },
    {
      id: 'option-2',
      label: '',
      description: '',
      ...EMPTY_BALLOT_IMAGE,
      suboptions: [
        { id: 'suboption-3', label: '', description: '', ...EMPTY_BALLOT_IMAGE },
        { id: 'suboption-4', label: '', description: '', ...EMPTY_BALLOT_IMAGE },
      ],
    },
  ]);

  const [allowSuboptions, setAllowSuboptions] = useState(false);
  const [includeBlank, setIncludeBlank] = useState(true);
  const [includeNull, setIncludeNull] = useState(true);
  const [requiresKeys, setRequiresKeys] = useState(false);
  const [keyRequirementMode, setKeyRequirementMode] = useState<KeyRequirementMode>('COUNT');
  const [keyCount, setKeyCount] = useState(DEFAULT_KEY_COUNT);
  const [keyPercentage, setKeyPercentage] = useState(DEFAULT_KEY_PERCENTAGE);
  const [uploadingImageIds, setUploadingImageIds] = useState<string[]>([]);

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

  function createSuboption(): SuboptionForm {
    suboptionCounterRef.current += 1;
    return {
      id: `suboption-${suboptionCounterRef.current}`,
      label: '',
      description: '',
      ...EMPTY_BALLOT_IMAGE,
    };
  }

  function setImageUploading(targetId: string, uploading: boolean) {
    setUploadingImageIds((prev) => {
      if (uploading) {
        return prev.includes(targetId) ? prev : [...prev, targetId];
      }

      return prev.filter((currentId) => currentId !== targetId);
    });
  }

  function addOption() {
    optionCounterRef.current += 1;
    const nextOptionId = `option-${optionCounterRef.current}`;
    const nextSuboptions = [createSuboption(), createSuboption()];
    setOptions((prev) => [
      ...prev,
      {
        id: nextOptionId,
        label: '',
        description: '',
        ...EMPTY_BALLOT_IMAGE,
        suboptions: nextSuboptions,
      },
    ]);
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

  function updateOptionImageInput(index: number, value: string) {
    setOptions((prev) =>
      prev.map((option, currentIndex) => (
        currentIndex === index
          ? { ...option, image_input: value, image_url: value, image_name: '' }
          : option
      ))
    );
  }

  function clearOptionImage(index: number) {
    setOptions((prev) =>
      prev.map((option, currentIndex) => (
        currentIndex === index ? { ...option, ...EMPTY_BALLOT_IMAGE } : option
      ))
    );
  }

  async function uploadOptionImage(index: number, file: File | null) {
    if (!file) {
      return;
    }

    const optionId = options[index]?.id;
    if (!optionId) {
      return;
    }

    try {
      setError(null);
      setImageUploading(optionId, true);
      const storedImage = await prepareBallotImage(file);

      setOptions((prev) =>
        prev.map((option, currentIndex) => (
          currentIndex === index
            ? {
                ...option,
                image_url: storedImage,
                image_input: '',
                image_name: file.name,
              }
            : option
        ))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen seleccionada');
    } finally {
      setImageUploading(optionId, false);
    }
  }

  function addSuboption(optionIndex: number) {
    const nextSuboption = createSuboption();
    setOptions((prev) =>
      prev.map((option, currentIndex) => (
        currentIndex === optionIndex
          ? { ...option, suboptions: [...option.suboptions, nextSuboption] }
          : option
      ))
    );
  }

  function removeSuboption(optionIndex: number, suboptionIndex: number) {
    setOptions((prev) =>
      prev.map((option, currentIndex) => (
        currentIndex === optionIndex
          ? {
              ...option,
              suboptions: option.suboptions.filter((_, currentSuboptionIndex) => (
                currentSuboptionIndex !== suboptionIndex
              )),
            }
          : option
      ))
    );
  }

  function updateSuboption(
    optionIndex: number,
    suboptionIndex: number,
    field: keyof SuboptionForm,
    value: string,
  ) {
    setOptions((prev) =>
      prev.map((option, currentIndex) => (
        currentIndex === optionIndex
          ? {
              ...option,
              suboptions: option.suboptions.map((suboption, currentSuboptionIndex) => (
                currentSuboptionIndex === suboptionIndex ? { ...suboption, [field]: value } : suboption
              )),
            }
          : option
      ))
    );
  }

  function updateSuboptionImageInput(optionIndex: number, suboptionIndex: number, value: string) {
    setOptions((prev) =>
      prev.map((option, currentIndex) => (
        currentIndex === optionIndex
          ? {
              ...option,
              suboptions: option.suboptions.map((suboption, currentSuboptionIndex) => (
                currentSuboptionIndex === suboptionIndex
                  ? { ...suboption, image_input: value, image_url: value, image_name: '' }
                  : suboption
              )),
            }
          : option
      ))
    );
  }

  function clearSuboptionImage(optionIndex: number, suboptionIndex: number) {
    setOptions((prev) =>
      prev.map((option, currentIndex) => (
        currentIndex === optionIndex
          ? {
              ...option,
              suboptions: option.suboptions.map((suboption, currentSuboptionIndex) => (
                currentSuboptionIndex === suboptionIndex
                  ? { ...suboption, ...EMPTY_BALLOT_IMAGE }
                  : suboption
              )),
            }
          : option
      ))
    );
  }

  async function uploadSuboptionImage(optionIndex: number, suboptionIndex: number, file: File | null) {
    if (!file) {
      return;
    }

    const suboptionId = options[optionIndex]?.suboptions[suboptionIndex]?.id;
    if (!suboptionId) {
      return;
    }

    try {
      setError(null);
      setImageUploading(suboptionId, true);
      const storedImage = await prepareBallotImage(file);

      setOptions((prev) =>
        prev.map((option, currentIndex) => (
          currentIndex === optionIndex
            ? {
                ...option,
                suboptions: option.suboptions.map((suboption, currentSuboptionIndex) => (
                  currentSuboptionIndex === suboptionIndex
                    ? {
                        ...suboption,
                        image_url: storedImage,
                        image_input: '',
                        image_name: file.name,
                      }
                    : suboption
                )),
              }
            : option
        ))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen seleccionada');
    } finally {
      setImageUploading(suboptionId, false);
    }
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
      const normalizedOptions = options
        .map((option) => ({
          label: option.label.trim(),
          description: option.description.trim(),
          image_url: option.image_url.trim(),
          suboptions: option.suboptions
            .map((suboption) => ({
              label: suboption.label.trim(),
              description: suboption.description.trim(),
              image_url: suboption.image_url.trim(),
            }))
            .filter((suboption) => suboption.label),
        }));
      const candidateOptions = normalizedOptions.filter((option) => option.label);
      const parentOptions = normalizedOptions.filter((option) => option.label || option.suboptions.length > 0);

      const uniqueCandidateLabels = new Set(candidateOptions.map((option) => option.label.toLowerCase()));
      const uniqueParentLabels = new Set(parentOptions.map((option) => option.label.toLowerCase()));
      const immediateMinutes = form.start_immediately
        ? getImmediateDurationMinutes(form.immediate_duration_value, form.immediate_duration_unit)
        : null;

      if (!trimmedTitle) {
        throw new Error('Escribe un título para la votación');
      }

      if (allowSuboptions) {
        if (parentOptions.length === 0) {
          throw new Error('Agrega al menos un grupo de votación con subopciones');
        }

        if (parentOptions.some((option) => !option.label)) {
          throw new Error('Cada grupo de subopciones debe tener un nombre');
        }

        if (uniqueParentLabels.size !== parentOptions.length) {
          throw new Error('Los grupos de subopciones no pueden repetirse');
        }

        const parentWithoutEnoughSuboptions = parentOptions.find((option) => option.suboptions.length < 2);
        if (parentWithoutEnoughSuboptions) {
          throw new Error(`Agrega al menos 2 subopciones para ${parentWithoutEnoughSuboptions.label}`);
        }

        const parentWithRepeatedSuboptions = parentOptions.find((option) => {
          const suboptionLabels = option.suboptions.map((suboption) => suboption.label.toLowerCase());
          return new Set(suboptionLabels).size !== suboptionLabels.length;
        });
        if (parentWithRepeatedSuboptions) {
          throw new Error(`Las subopciones de ${parentWithRepeatedSuboptions.label} no pueden repetirse`);
        }
      } else {
        if (candidateOptions.length < 2) {
          throw new Error('Agrega al menos 2 opciones de voto');
        }

        if (uniqueCandidateLabels.size !== candidateOptions.length) {
          throw new Error('Las opciones de voto no pueden repetirse');
        }
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

      const allOptions: CreateElectionPayloadOption[] = allowSuboptions
        ? parentOptions.map((option, index) => {
            const suboptions: CreateElectionPayloadOption[] = option.suboptions.map((suboption, suboptionIndex) => ({
              label: suboption.label,
              option_type: 'CANDIDATE',
              description: suboption.description || undefined,
              image_url: suboption.image_url || undefined,
              display_order: suboptionIndex + 1,
            }));

            if (includeBlank) {
              suboptions.push({
                label: 'Voto en blanco',
                option_type: 'BLANK',
                display_order: suboptions.length + 1,
              });
            }

            if (includeNull) {
              suboptions.push({
                label: 'Voto nulo',
                option_type: 'NULL_VOTE',
                display_order: suboptions.length + 1,
              });
            }

            return {
              label: option.label,
              option_type: 'CANDIDATE',
              description: option.description || undefined,
              image_url: option.image_url || undefined,
              display_order: index + 1,
              suboptions,
            };
          })
        : candidateOptions.map((option, index) => ({
            label: option.label,
            description: option.description || undefined,
            image_url: option.image_url || undefined,
            option_type: 'CANDIDATE',
            display_order: index + 1,
          }));

      if (!allowSuboptions && includeBlank) {
        allOptions.push({
          label: 'Voto en blanco',
          option_type: 'BLANK',
          display_order: allOptions.length + 1,
        });
      }

      if (!allowSuboptions && includeNull) {
        allOptions.push({
          label: 'Voto nulo',
          option_type: 'NULL_VOTE',
          display_order: allOptions.length + 1,
        });
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
        allow_suboptions: allowSuboptions,
        options: allOptions,
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
  const configuredParentOptions = options.filter((option) => (
    option.label.trim() || option.suboptions.some((suboption) => suboption.label.trim())
  ));
  const suboptionsCount = options.reduce(
    (total, option) => total + option.suboptions.filter((suboption) => suboption.label.trim()).length,
    0,
  );
  const suboptionsReady = configuredParentOptions.length > 0
    && configuredParentOptions.every((option) => (
      Boolean(option.label.trim())
      && option.suboptions.filter((suboption) => suboption.label.trim()).length >= 2
    ));
  const ballotSummary = allowSuboptions
    ? `${configuredParentOptions.length} grupo${configuredParentOptions.length === 1 ? '' : 's'} / ${suboptionsCount} subopci${suboptionsCount === 1 ? 'ón' : 'ones'}`
    : `${candidateOptionsCount} opci${candidateOptionsCount === 1 ? 'ón' : 'ones'} configurada${candidateOptionsCount === 1 ? '' : 's'}`;
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
  const suffrageSummary = getSuffrageLabel(form.is_anonymous);

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
      complete: allowSuboptions ? suboptionsReady : candidateOptionsCount >= 2,
      summary: ballotSummary,
    },
    sufragio: {
      complete: true,
      summary: suffrageSummary,
    },
    seguridad: {
      complete: !requiresKeys || (minKeysPreview !== null && !countExceedsAdmins),
      summary: keyRequirementSummary,
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
              <strong>{completionCount}/{SECTION_ITEMS.length}</strong>
            </div>
            <div className="create-election-hero__stat">
              <span>Opciones</span>
              <strong>{allowSuboptions ? `${configuredParentOptions.length}/${suboptionsCount}` : candidateOptionsCount}</strong>
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
                  aria-label="Titulo de la votacion"
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
                  aria-label="Descripcion de la votacion"
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

            <div className="create-election-toggle-grid">
              <ToggleCard
                checked={allowSuboptions}
                title="Usar subopciones"
                description="Permite crear grupos como cargos o preguntas, cada uno con sus propias opciones."
                onChange={(checked) => {
                  setError(null);
                  setAllowSuboptions(checked);
                }}
              />
            </div>

            <div className="create-election-option-stack">
              {options.map((option, index) => (
                <div key={option.id} className="create-election-option-card">
                  <div className="create-election-option-card__header">
                    <div className="create-election-option-card__index create-election-option-card__index--candidate">
                      {allowSuboptions ? 'Grupo' : 'Opción'} {index + 1}
                    </div>
                    {options.length > (allowSuboptions ? 1 : 2) && (
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
                      <label>{allowSuboptions ? 'Nombre del grupo' : 'Nombre'}</label>
                      <input
                        type="text"
                        className="input"
                        aria-label={`Nombre de la opcion ${index + 1}`}
                        placeholder={allowSuboptions ? 'Ej: Presidencia' : 'Ej: Candidatura A'}
                        value={option.label}
                        onChange={(event) => updateOption(index, 'label', event.target.value)}
                      />
                    </div>

                    <div className="input-group">
                      <label>Descripción</label>
                      <input
                        type="text"
                        className="input"
                        aria-label={`Descripcion de la opcion ${index + 1}`}
                        placeholder="Descripcion corta opcional"
                        value={option.description}
                        onChange={(event) => updateOption(index, 'description', event.target.value)}
                      />
                    </div>

                    <BallotImageField
                      imageUrl={option.image_url}
                      imageInput={option.image_input}
                      imageName={option.image_name}
                      uploading={uploadingImageIds.includes(option.id)}
                      urlAriaLabel={`URL de imagen de la opcion ${index + 1}`}
                      uploadAriaLabel={`Subir imagen de la opcion ${index + 1}`}
                      onUrlChange={(value) => updateOptionImageInput(index, value)}
                      onFileChange={(file) => uploadOptionImage(index, file)}
                      onClear={() => clearOptionImage(index)}
                    />
                  </div>

                  {allowSuboptions && (
                    <div className="create-election-suboptions">
                      <div className="create-election-suboptions__header">
                        <div>
                          <div className="create-election-suboptions__title">Subopciones</div>
                          <p className="create-election-inline-help">
                            Cada votante elegira una subopcion dentro de este grupo.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => addSuboption(index)}
                        >
                          Agregar subopcion
                        </button>
                      </div>

                      <div className="create-election-suboption-list">
                        {option.suboptions.map((suboption, suboptionIndex) => (
                          <div key={suboption.id} className="create-election-suboption-row">
                            <div className="create-election-suboption-row__index">
                              {suboptionIndex + 1}
                            </div>
                            <div className="create-election-suboption-row__fields">
                              <div className="input-group">
                                <label>Nombre de subopcion</label>
                                <input
                                  type="text"
                                  className="input"
                                  aria-label={`Nombre de la subopcion ${suboptionIndex + 1} del grupo ${index + 1}`}
                                  placeholder="Ej: Formula A"
                                  value={suboption.label}
                                  onChange={(event) => updateSuboption(index, suboptionIndex, 'label', event.target.value)}
                                />
                              </div>

                              <div className="input-group">
                                <label>Descripcion</label>
                                <input
                                  type="text"
                                  className="input"
                                  aria-label={`Descripcion de la subopcion ${suboptionIndex + 1} del grupo ${index + 1}`}
                                  placeholder="Descripcion corta opcional"
                                  value={suboption.description}
                                  onChange={(event) => updateSuboption(index, suboptionIndex, 'description', event.target.value)}
                                />
                              </div>

                              <BallotImageField
                                imageUrl={suboption.image_url}
                                imageInput={suboption.image_input}
                                imageName={suboption.image_name}
                                uploading={uploadingImageIds.includes(suboption.id)}
                                urlAriaLabel={`URL de imagen de la subopcion ${suboptionIndex + 1} del grupo ${index + 1}`}
                                uploadAriaLabel={`Subir imagen de la subopcion ${suboptionIndex + 1} del grupo ${index + 1}`}
                                onUrlChange={(value) => updateSuboptionImageInput(index, suboptionIndex, value)}
                                onFileChange={(file) => uploadSuboptionImage(index, suboptionIndex, file)}
                                onClear={() => clearSuboptionImage(index, suboptionIndex)}
                              />
                            </div>
                            {option.suboptions.length > 2 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeSuboption(index, suboptionIndex)}
                                style={{ color: 'var(--muted)' }}
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
              {allowSuboptions ? 'Agregar grupo' : 'Agregar opción'}
            </button>

            <div className="create-election-toggle-grid">
              <ToggleCard
                checked={includeBlank}
                title='Incluir "Voto en blanco"'
                description={allowSuboptions
                  ? 'Agrega voto en blanco como subopcion en cada grupo.'
                  : 'Agrega una alternativa explicita para emitir voto en blanco.'}
                onChange={setIncludeBlank}
              />
              <ToggleCard
                checked={includeNull}
                title='Incluir "Voto nulo"'
                description={allowSuboptions
                  ? 'Agrega voto nulo como subopcion en cada grupo.'
                  : 'Agrega una opcion para contemplar votos anulados en la boleta.'}
                onChange={setIncludeNull}
              />
            </div>
          </section>

          <section
            id="sufragio"
            data-section-id="sufragio"
            ref={(node) => setSectionRef('sufragio', node)}
            className="card create-election-section"
          >
            <div className="create-election-section__header">
              <div className="create-election-section__eyebrow">4. Sufragio</div>
              <h3 className="create-election-section__title">Define la modalidad del sufragio</h3>
              <p className="create-election-section__description">
                Elige si el reporte mostrara la opcion elegida por persona o solo la participacion.
              </p>
            </div>

            <div className="create-election-choice-grid">
              {SUFFRAGE_OPTIONS.map((option) => (
                <SelectionCard
                  key={String(option.value)}
                  selected={form.is_anonymous === option.value}
                  badge={option.badge}
                  title={option.title}
                  description={option.description}
                  onClick={() => updateForm('is_anonymous', option.value)}
                >
                  {form.is_anonymous === option.value ? 'Seleccionado' : 'Haz clic para usar esta modalidad'}
                </SelectionCard>
              ))}
            </div>
          </section>

          <section
            id="seguridad"
            data-section-id="seguridad"
            ref={(node) => setSectionRef('seguridad', node)}
            className="card create-election-section"
          >
            <div className="create-election-section__header">
              <div className="create-election-section__eyebrow">5. Seguridad</div>
              <h3 className="create-election-section__title">Configura el escrutinio</h3>
              <p className="create-election-section__description">
                Define si la publicacion de resultados requiere llaves de escrutinio.
              </p>
            </div>

            <div className="create-election-toggle-grid">
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
                          aria-label="Cantidad de administradores requerida para el escrutinio"
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
                            aria-label="Porcentaje de administradores requerido para el escrutinio"
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
                        aria-label="Total de administradores disponibles"
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
                <strong>{ballotSummary}</strong>
              </div>
              <div className="create-election-summary-item">
                <span>Sufragio</span>
                <strong>{suffrageSummary}</strong>
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
