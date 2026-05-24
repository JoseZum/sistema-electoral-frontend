import { buildApiUrl } from './api-url';

interface ErrorPayload {
  error?: string;
  code?: string;
  details?: unknown;
}

interface ApiErrorOptions {
  endpoint: string;
  message: string;
  status: number;
  code?: string;
  details?: unknown;
}

interface ApiClientOptions extends RequestInit {
  suppressErrorDetailLog?: boolean;
}

export class ApiError extends Error {
  readonly endpoint: string;
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor({ endpoint, message, status, code, details }: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.endpoint = endpoint;
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

async function readErrorPayload(response: Response): Promise<ErrorPayload> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => '');
  return text ? { error: text } : {};
}

function hasMeaningfulErrorDetails(details: unknown): boolean {
  if (details == null) {
    return false;
  }

  if (typeof details === 'string') {
    return details.trim().length > 0;
  }

  if (Array.isArray(details)) {
    return details.length > 0;
  }

  if (typeof details === 'object') {
    return Object.keys(details as Record<string, unknown>).length > 0;
  }

  return true;
}

async function handleResponse<T>(
  response: Response,
  endpoint: string,
  options: ApiClientOptions = {},
): Promise<T> {
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !endpoint.includes('/api/auth')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tee_token');
        localStorage.removeItem('tee_user');
        window.location.href = '/';
      }
    }

    const error = await readErrorPayload(response);
    const message = error.error || `HTTP ${response.status}`;

    if (!options.suppressErrorDetailLog && hasMeaningfulErrorDetails(error.details)) {
      console.error('[API details]', {
        endpoint,
        status: response.status,
        code: error.code,
        details: error.details,
      });
    }

    throw new ApiError({
      endpoint,
      message,
      status: response.status,
      code: error.code,
      details: error.details,
    });
  }

  return response.json();
}

async function performRequest(endpoint: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(buildApiUrl(endpoint), options);
  } catch (error) {
    throw new ApiError({
      endpoint,
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'No se pudo conectar con el servidor.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tee_token') : null;
  const { suppressErrorDetailLog, ...requestOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...requestOptions.headers,
  };

  const response = await performRequest(endpoint, {
    ...requestOptions,
    headers,
  });

  return handleResponse<T>(response, endpoint, { suppressErrorDetailLog });
}

export async function apiUpload<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tee_token') : null;

  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await performRequest(endpoint, {
    method: 'POST',
    headers,
    body: formData,
  });

  return handleResponse<T>(response, endpoint);
}
