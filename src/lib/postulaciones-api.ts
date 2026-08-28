import { apiClient, apiUpload, ApiError } from './api-client';
import { buildApiUrl } from './api-url';
import type {
  ApplicationDetail,
  ApplicationFileMeta,
  ApplicationFormWithStats,
  ApplicationSummary,
  CreateApplicationFormPayload,
  FileFieldKey,
  MyApplicationDetail,
  MyApplicationFormSummary,
  ReviewApplicationPayload,
  SaveApplicationPayload,
  UpdateApplicationFormPayload,
} from '@/types/postulaciones';

// ============================================
// ADMIN — /api/postulaciones
// ============================================

export async function listForms() {
  return apiClient<ApplicationFormWithStats[]>('/api/postulaciones/formularios');
}

export async function getForm(id: string) {
  return apiClient<ApplicationFormWithStats>(`/api/postulaciones/formularios/${id}`);
}

export async function createForm(payload: CreateApplicationFormPayload) {
  return apiClient<ApplicationFormWithStats>('/api/postulaciones/formularios', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateForm(id: string, payload: UpdateApplicationFormPayload) {
  return apiClient<ApplicationFormWithStats>(`/api/postulaciones/formularios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteForm(id: string) {
  return apiClient<{ success: boolean }>(`/api/postulaciones/formularios/${id}`, {
    method: 'DELETE',
  });
}

export async function listApplications(formId: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiClient<ApplicationSummary[]>(
    `/api/postulaciones/formularios/${formId}/respuestas${query}`
  );
}

export async function getApplication(id: string) {
  return apiClient<ApplicationDetail>(`/api/postulaciones/respuestas/${id}`);
}

export async function reviewApplication(id: string, payload: ReviewApplicationPayload) {
  return apiClient<ApplicationDetail>(`/api/postulaciones/respuestas/${id}/revision`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ============================================
// ESTUDIANTE — /api/mis-postulaciones
// ============================================

export async function listMyForms() {
  return apiClient<MyApplicationFormSummary[]>('/api/mis-postulaciones');
}

export async function getMyApplication(formId: string) {
  return apiClient<MyApplicationDetail>(`/api/mis-postulaciones/${formId}`);
}

export async function saveMyApplication(formId: string, payload: SaveApplicationPayload) {
  return apiClient<MyApplicationDetail>(`/api/mis-postulaciones/${formId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function submitMyApplication(formId: string) {
  return apiClient<MyApplicationDetail>(`/api/mis-postulaciones/${formId}/enviar`, {
    method: 'POST',
  });
}

export async function uploadMyFile(formId: string, fieldKey: FileFieldKey, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiUpload<ApplicationFileMeta>(
    `/api/mis-postulaciones/${formId}/archivos/${fieldKey}`,
    formData
  );
}

export async function deleteMyFile(formId: string, fileId: string) {
  return apiClient<{ success: boolean }>(`/api/mis-postulaciones/${formId}/archivos/${fileId}`, {
    method: 'DELETE',
  });
}

// ============================================
// VISOR DE ADJUNTOS
// ============================================

/**
 * Descarga un adjunto y devuelve un object URL para mostrarlo.
 *
 * No se puede apuntar un `<iframe src>` directamente al endpoint porque la
 * ruta exige la cabecera `Authorization`, que un iframe no envía. Se baja el
 * binario con fetch y se envuelve en un blob local.
 *
 * Quien llame DEBE liberar el URL con `URL.revokeObjectURL` al desmontar.
 */
async function fetchFileObjectUrl(endpoint: string): Promise<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tee_token') : null;

  const response = await fetch(buildApiUrl(endpoint), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new ApiError({
      endpoint,
      status: response.status,
      message: 'No se pudo abrir el archivo',
    });
  }

  return URL.createObjectURL(await response.blob());
}

/** Adjunto visto por el administrador durante la revisión. */
export async function getAdminFileUrl(fileId: string) {
  return fetchFileObjectUrl(`/api/postulaciones/archivos/${fileId}`);
}

/** Adjunto propio, visto por el estudiante. */
export async function getMyFileUrl(fileId: string) {
  return fetchFileObjectUrl(`/api/mis-postulaciones/archivos/${fileId}`);
}
