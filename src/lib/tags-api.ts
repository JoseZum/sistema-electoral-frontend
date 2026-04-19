import { apiClient } from './api-client';
import type { CreateTagPayload, TagDetail, TagSummary, UpdateTagPayload } from '@/types/tags';

export async function listTags() {
  return apiClient<TagSummary[]>('/api/tags');
}

export async function getTag(id: string) {
  return apiClient<TagDetail>(`/api/tags/${id}`);
}

export async function createTag(payload: CreateTagPayload) {
  return apiClient<TagDetail>('/api/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTag(id: string, payload: UpdateTagPayload) {
  return apiClient<TagDetail>(`/api/tags/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTag(id: string) {
  return apiClient<{ success: true }>(`/api/tags/${id}`, {
    method: 'DELETE',
  });
}
