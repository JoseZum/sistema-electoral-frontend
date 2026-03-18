const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function handleResponse<T>(response: Response, endpoint: string): Promise<T> {
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !endpoint.includes('/api/auth')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tee_token');
        localStorage.removeItem('tee_user');
        window.location.href = '/';
      }
    }
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    const message = error.error || `HTTP ${response.status}`;
    if (error.details) console.error('[API details]', error.details);
    throw new Error(message);
  }
  return response.json();
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tee_token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  return handleResponse<T>(response, endpoint);
}

export async function apiUpload<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tee_token') : null;

  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  return handleResponse<T>(response, endpoint);
}
