/**
 * Suite objetivo: src/lib/api-client.ts
 *
 * Pendiente:
 * - inclusion del token en Authorization
 * - parseo de errores JSON y texto
 * - limpieza de sesion en 401 y 403
 * - manejo de fallos de red
 * - upload con FormData
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, apiUpload } from '@/lib/api-client';

function jsonResponse<T>(body: T, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			'content-type': 'application/json',
			...(init.headers || {}),
		},
	});
}

function textResponse(body: string, init: ResponseInit = {}): Response {
	return new Response(body, init);
}

describe('api-client', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('includes the bearer token and returns the parsed response', async () => {
		localStorage.setItem('tee_token', 'token-123');

		const payload = { ok: true };
		vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload));

		const result = await apiClient<typeof payload>('/api/health');

		expect(result).toEqual(payload);
		expect(fetch).toHaveBeenCalledWith(
			'http://localhost:3001/api/health',
			expect.objectContaining({
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
					Authorization: 'Bearer token-123',
				}),
			})
		);
	});

	it('merges custom headers with the default json headers', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }));

		await apiClient('/api/custom', {
			headers: {
				'X-Request-Id': 'request-1',
			},
		});

		expect(fetch).toHaveBeenCalledWith(
			'http://localhost:3001/api/custom',
			expect.objectContaining({
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
					'X-Request-Id': 'request-1',
				}),
			})
		);
	});

	it('parses JSON error payloads into ApiError', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const errorPayload = {
			error: 'Validation failed',
			code: 'INVALID_DATA',
			details: { field: 'email' },
		};
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse(errorPayload, { status: 400, statusText: 'Bad Request' })
		);

		await expect(apiClient('/api/error')).rejects.toMatchObject({
			name: 'ApiError',
			endpoint: '/api/error',
			status: 400,
			message: 'Validation failed',
			code: 'INVALID_DATA',
			details: { field: 'email' },
		});

		expect(consoleSpy).toHaveBeenCalledWith(
			'[API details]',
			expect.objectContaining({
				endpoint: '/api/error',
				status: 400,
				code: 'INVALID_DATA',
				details: { field: 'email' },
			})
		);
		consoleSpy.mockRestore();
	});

	it('does not log empty error detail objects', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse(
				{
					error: 'Validation failed',
					code: 'INVALID_DATA',
					details: {},
				},
				{ status: 400, statusText: 'Bad Request' }
			)
		);

		await expect(apiClient('/api/error-empty-details')).rejects.toBeInstanceOf(ApiError);

		expect(consoleSpy).not.toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it('allows callers to suppress detail logs for expected API fallbacks', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse(
				{
					error: 'Legacy route fallback',
					code: 'DB_INVALID_INPUT',
					details: { message: 'invalid input syntax for type uuid' },
				},
				{ status: 400, statusText: 'Bad Request' }
			)
		);

		await expect(
			apiClient('/api/elections/suboption-presets', {
				suppressErrorDetailLog: true,
			})
		).rejects.toMatchObject({
			code: 'DB_INVALID_INPUT',
		});

		expect(consoleSpy).not.toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it('parses text error payloads when the response is not json', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			textResponse('Service unavailable', {
				status: 503,
				headers: { 'content-type': 'text/plain' },
			})
		);

		await expect(apiClient('/api/error-text')).rejects.toMatchObject({
			name: 'ApiError',
			endpoint: '/api/error-text',
			status: 503,
			message: 'Service unavailable',
		});
	});

	it.each([401, 403])('cleans the session on %s responses', async (status) => {
		localStorage.setItem('tee_token', 'token-123');
		localStorage.setItem('tee_user', '{"id":"user-1"}');

		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse({ error: 'Unauthorized' }, { status })
		);

		await expect(apiClient('/api/dashboard')).rejects.toBeInstanceOf(ApiError);

		expect(localStorage.getItem('tee_token')).toBeNull();
		expect(localStorage.getItem('tee_user')).toBeNull();
		expect(window.location.href).toBe('http://localhost:3000/');
	});

	it('does not clear the session for auth endpoints', async () => {
		localStorage.setItem('tee_token', 'token-123');
		localStorage.setItem('tee_user', '{"id":"user-1"}');

		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse({ error: 'Unauthorized' }, { status: 401 })
		);

		await expect(apiClient('/api/auth/login')).rejects.toBeInstanceOf(ApiError);

		expect(localStorage.getItem('tee_token')).toBe('token-123');
		expect(localStorage.getItem('tee_user')).toBe('{"id":"user-1"}');
	});

	it('wraps network failures in an ApiError', async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));

		await expect(apiClient('/api/network')).rejects.toMatchObject({
			name: 'ApiError',
			endpoint: '/api/network',
			status: 0,
			code: 'NETWORK_ERROR',
			message: 'No se pudo conectar con el servidor.',
			details: 'network down',
		});
	});

	it('uploads FormData without forcing a json content type', async () => {
		localStorage.setItem('tee_token', 'token-123');
		const formData = new FormData();
		formData.append('file', new Blob(['content'], { type: 'text/plain' }), 'file.txt');

		const payload = { uploaded: true };
		vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload));

		const result = await apiUpload<typeof payload>('/api/upload', formData);

		expect(result).toEqual(payload);
		expect(fetch).toHaveBeenCalledWith(
			'http://localhost:3001/api/upload',
			expect.objectContaining({
				method: 'POST',
				body: formData,
				headers: expect.objectContaining({
					Authorization: 'Bearer token-123',
				}),
			})
		);

		const callOptions = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
		expect(callOptions.headers).not.toEqual(
			expect.objectContaining({
				'Content-Type': 'application/json',
			})
		);
	});
});
