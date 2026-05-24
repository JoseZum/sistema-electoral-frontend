const DEFAULT_API_URL = 'http://localhost:3001';

export function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  return baseUrl.trim().replace(/\/+$/, '');
}

export function buildApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();

  if (!endpoint) {
    return baseUrl;
  }

  if (endpoint.startsWith('/') || endpoint.startsWith('?')) {
    return `${baseUrl}${endpoint}`;
  }

  return `${baseUrl}/${endpoint}`;
}
