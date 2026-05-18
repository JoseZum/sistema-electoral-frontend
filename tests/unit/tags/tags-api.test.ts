/**
 * Suite objetivo: src/lib/tags-api.ts
 *
 * Pendiente:
 * - listar tags
 * - obtener detalle
 * - crear, actualizar y eliminar
 * - propagacion correcta de errores del cliente API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
} from '@/lib/tags-api';
import * as apiClientModule from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}));

const mockTagSummary = {
  id: 'tag-1',
  name: 'Engineering',
  description: 'Engineering team',
  color: '#C62828',
  member_count: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockTagDetail = {
  ...mockTagSummary,
  members: [
    {
      id: 'student-1',
      carnet: 'A001',
      full_name: 'John Doe',
      sede: 'Main',
      career: 'Engineering',
      degree_level: 'Bachelor',
      is_active: true,
    },
  ],
};

describe('tags-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listTags', () => {
    it('calls apiClient with correct endpoint', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce([mockTagSummary]);

      await listTags();

      expect(apiClient).toHaveBeenCalledWith('/api/tags');
    });

    it('returns array of tag summaries', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce([mockTagSummary]);

      const result = await listTags();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].id).toBe('tag-1');
      expect(result[0].name).toBe('Engineering');
    });

    it('returns empty array when no tags', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce([]);

      const result = await listTags();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('propagates API errors', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      const error = new Error('API Error');
      apiClient.mockRejectedValueOnce(error);

      await expect(listTags()).rejects.toThrow('API Error');
    });

    it('handles multiple tags', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      const mockTags = [
        mockTagSummary,
        { ...mockTagSummary, id: 'tag-2', name: 'Design' },
      ];
      apiClient.mockResolvedValueOnce(mockTags);

      const result = await listTags();

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Engineering');
      expect(result[1].name).toBe('Design');
    });
  });

  describe('getTag', () => {
    it('calls apiClient with correct endpoint and id', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      await getTag('tag-1');

      expect(apiClient).toHaveBeenCalledWith('/api/tags/tag-1');
    });

    it('returns tag detail with members', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const result = await getTag('tag-1');

      expect(result.id).toBe('tag-1');
      expect(result.members).toBeDefined();
      expect(Array.isArray(result.members)).toBe(true);
      expect(result.members.length).toBeGreaterThan(0);
    });

    it('includes all tag summary fields in detail', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const result = await getTag('tag-1');

      expect(result.name).toBe('Engineering');
      expect(result.description).toBe('Engineering team');
      expect(result.color).toBe('#C62828');
      expect(result.member_count).toBe(5);
    });

    it('propagates API errors with id', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      const error = new Error('Tag not found');
      apiClient.mockRejectedValueOnce(error);

      await expect(getTag('non-existent')).rejects.toThrow('Tag not found');
    });

    it('handles empty members array', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      const emptyTag = { ...mockTagDetail, members: [] };
      apiClient.mockResolvedValueOnce(emptyTag);

      const result = await getTag('tag-1');

      expect(result.members).toEqual([]);
    });
  });

  describe('createTag', () => {
    it('calls apiClient with POST method', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const payload = {
        name: 'Engineering',
        description: 'Engineering team',
        color: '#C62828',
        student_ids: ['student-1'],
      };

      await createTag(payload);

      expect(apiClient).toHaveBeenCalledWith(
        '/api/tags',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });

    it('returns created tag detail', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const payload = {
        name: 'Engineering',
        color: '#C62828',
      };

      const result = await createTag(payload);

      expect(result.id).toBe('tag-1');
      expect(result.name).toBe('Engineering');
    });

    it('serializes payload as JSON', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const payload = {
        name: 'Test',
        description: null,
        student_ids: ['id-1', 'id-2'],
      };

      await createTag(payload);

      const callArgs = apiClient.mock.calls[0][1];
      expect(callArgs?.body).toBe(JSON.stringify(payload));
    });

    it('propagates API errors on create', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      const error = new Error('Validation error');
      apiClient.mockRejectedValueOnce(error);

      const payload = { name: 'Test' };
      await expect(createTag(payload)).rejects.toThrow('Validation error');
    });

    it('handles optional fields', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const payload = {
        name: 'Test Tag',
      };

      await createTag(payload);

      const callArgs = apiClient.mock.calls[0][1];
      expect(callArgs?.body).toContain('"name":"Test Tag"');
    });
  });

  describe('updateTag', () => {
    it('calls apiClient with PUT method', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const payload = {
        name: 'Updated Engineering',
        color: '#1565C0',
      };

      await updateTag('tag-1', payload);

      expect(apiClient).toHaveBeenCalledWith(
        '/api/tags/tag-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      );
    });

    it('returns updated tag detail', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      const updatedTag = { ...mockTagDetail, name: 'Updated' };
      apiClient.mockResolvedValueOnce(updatedTag);

      const payload = { name: 'Updated' };
      const result = await updateTag('tag-1', payload);

      expect(result.name).toBe('Updated');
    });

    it('passes id in URL path', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const payload = { name: 'Test' };
      await updateTag('custom-id', payload);

      expect(apiClient).toHaveBeenCalledWith(
        '/api/tags/custom-id',
        expect.any(Object)
      );
    });

    it('propagates API errors on update', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      const error = new Error('Not found');
      apiClient.mockRejectedValueOnce(error);

      const payload = { name: 'Test' };
      await expect(updateTag('non-existent', payload)).rejects.toThrow('Not found');
    });

    it('handles partial updates', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce(mockTagDetail);

      const payload = {
        description: 'New description',
      };

      await updateTag('tag-1', payload);

      const callArgs = apiClient.mock.calls[0][1];
      expect(callArgs?.body).toContain('"description":"New description"');
    });
  });

  describe('deleteTag', () => {
    it('calls apiClient with DELETE method', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce({ success: true });

      await deleteTag('tag-1');

      expect(apiClient).toHaveBeenCalledWith(
        '/api/tags/tag-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('returns success response', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce({ success: true });

      const result = await deleteTag('tag-1');

      expect(result.success).toBe(true);
    });

    it('passes id in URL path', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce({ success: true });

      await deleteTag('delete-me-id');

      expect(apiClient).toHaveBeenCalledWith(
        '/api/tags/delete-me-id',
        expect.any(Object)
      );
    });

    it('propagates API errors on delete', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      const error = new Error('Cannot delete');
      apiClient.mockRejectedValueOnce(error);

      await expect(deleteTag('tag-1')).rejects.toThrow('Cannot delete');
    });

    it('does not send a body with DELETE', async () => {
      const apiClient = vi.mocked(apiClientModule.apiClient);
      apiClient.mockResolvedValueOnce({ success: true });

      await deleteTag('tag-1');

      const callArgs = apiClient.mock.calls[0][1];
      expect(callArgs?.body).toBeUndefined();
    });
  });
});
