export const TAG_COLOR_OPTIONS = [
  { value: '#C62828', label: 'Rojo intenso' },
  { value: '#AD1457', label: 'Magenta fuerte' },
  { value: '#6A1B9A', label: 'Morado oscuro' },
  { value: '#4527A0', label: 'Violeta profundo' },
  { value: '#283593', label: 'Indigo fuerte' },
  { value: '#1565C0', label: 'Azul intenso' },
  { value: '#006064', label: 'Cian oscuro' },
  { value: '#00695C', label: 'Verde azulado' },
  { value: '#2E7D32', label: 'Verde bosque' },
  { value: '#BF360C', label: 'Naranja quemado' },
  { value: '#5D4037', label: 'Cafe oscuro' },
  { value: '#37474F', label: 'Gris acero' },
] as const;

export const TAG_COLOR_VALUES = TAG_COLOR_OPTIONS.map((option) => option.value);
export const DEFAULT_TAG_COLOR = TAG_COLOR_OPTIONS[0].value;

export function normalizeTagColor(color?: string | null): string | null {
  if (!color) {
    return null;
  }

  const normalized = color.trim().toUpperCase();
  return (TAG_COLOR_VALUES as readonly string[]).includes(normalized) ? normalized : null;
}

export function getFallbackTagColor(tagName: string): string {
  const hash = Array.from(tagName).reduce(
    (acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0,
    17
  );

  return TAG_COLOR_VALUES[hash % TAG_COLOR_VALUES.length] || DEFAULT_TAG_COLOR;
}

export function resolveTagColor(tagName: string, color?: string | null): string {
  return normalizeTagColor(color) ?? getFallbackTagColor(tagName);
}
