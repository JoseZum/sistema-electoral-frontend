/**
 * Suite objetivo: src/lib/auth-context.tsx
 *
 * Casos de prueba:
 * - estado inicial del provider
 * - restauracion de sesion desde localStorage
 * - login con token valido del backend
 * - logout y limpieza de estado local
 * - traduccion de errores tecnicos a mensajes de UI
 */


import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestAuthProvider, useAuth } from '../../../src/lib/auth-context';

// Este archivo contiene pruebas unitarias e integración ligera para el
// contexto de autenticación (`AuthProvider` / `TestAuthProvider`).
// Comentarios dentro del archivo explican el propósito de cada bloque
// y por qué se usan mocks de MSAL y del cliente HTTP.

function Consumer() {
	const { isAuthenticated, isLoading, user, token, error } = useAuth();
	return (
		<div>
			{/* isLoading: indica si el provider aún está leyendo/hidratando sesión */}
			<span data-testid="loading">{String(isLoading)}</span>
			{/* isAuthenticated: true cuando hay token + user en estado */}
			<span data-testid="auth">{String(isAuthenticated)}</span>
			{/* user/email y token: datos que normalmente se guardan en localStorage */}
			<span data-testid="user">{user ? (user as any).email : 'no-user'}</span>
			<span data-testid="token">{token ?? 'no-token'}</span>
			{/* error: mensaje traducido por getAuthErrorMessage en caso de fallo */}
			<span data-testid="error">{error ?? 'no-error'}</span>
		</div>
	);
}

describe('Auth context - TestAuthProvider', () => {
	beforeEach(() => {
		localStorage.clear();
	});
	// Caso: provider de pruebas inicia con isLoading true y luego pasa a false
	it('inicia y termina el proceso de carga (isLoading -> false)', async () => {
		render(
			<TestAuthProvider>
				<Consumer />
			</TestAuthProvider>,
		);

		await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
		expect(screen.getByTestId('auth').textContent).toBe('false');
		expect(screen.getByTestId('user').textContent).toBe('no-user');
	});

	// Caso: si existen `tee_token` y `tee_user` en localStorage, el provider
	// debe hidratar el estado y exponer isAuthenticated=true
	it('restaura sesion desde localStorage cuando hay token y user', async () => {
		const user = { email: 'test@example.com', name: 'Test User', role: 'user' };
		localStorage.setItem('tee_token', 'token-123');
		localStorage.setItem('tee_user', JSON.stringify(user));

		render(
			<TestAuthProvider>
				<Consumer />
			</TestAuthProvider>,
		);

		await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
		expect(screen.getByTestId('auth').textContent).toBe('true');
		expect(screen.getByTestId('user').textContent).toBe('test@example.com');
		expect(screen.getByTestId('token').textContent).toBe('token-123');
	});

	// Caso: el hook `useAuth` debe lanzar si se usa fuera de un Provider
	it('useAuth lanza si se usa fuera del provider', () => {
		// Renderizar el `Consumer` sin envoltorio del provider provoca error
		expect(() => render(<Consumer />)).toThrow();
	});
});

// ----------------------------
// Mocks para AuthProvider (MSAL + api-client)
// - Mockeamos `@azure/msal-react` para controlar `instance` y `accounts`.
// - Mockeamos `api-client` para simular respuestas del backend (éxito/fallo).
// Estos mocks permiten probar la lógica de `AuthProvider` sin llamadas reales.
// ----------------------------
vi.mock('@azure/msal-react', () => ({
	useMsal: vi.fn(),
	useIsAuthenticated: vi.fn(),
}));

vi.mock('../../../src/lib/api-client', () => ({
	apiClient: vi.fn(),
	ApiError: class ApiError extends Error {
		constructor(message: string, status = 500, code = 'ERROR', details: any = null) {
			super(message);
			(this as any).status = status;
			(this as any).code = code;
			(this as any).details = details;
		}
	},
}));

describe('Auth context - AuthProvider (integración con MSAL + backend)', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
	});

	it('envía token MSAL al backend y guarda sesión en localStorage', async () => {
		// Preparación:
		// - `acquireTokenSilent` devuelve un idToken simulado
		// - `apiClient` devuelve una respuesta válida con token + user
		// Comportamiento esperado:
		// - el provider llama a `acquireTokenSilent`, envía el idToken al backend,
		//   y guarda `tee_token`/`tee_user` en localStorage.
		const mockAcquireTokenSilent = vi.fn(() => Promise.resolve({ idToken: 'id-token-123' }));
		const mockLoginRedirect = vi.fn();
		const mockLogoutRedirect = vi.fn();

		const msal = await import('@azure/msal-react');
		(msal.useMsal as any).mockImplementation(() => ({
			instance: {
				acquireTokenSilent: mockAcquireTokenSilent,
				loginRedirect: mockLoginRedirect,
				logoutRedirect: mockLogoutRedirect,
			},
			accounts: [{ username: 'user@example.com', homeAccountId: 'home-1' }],
		}));
		(msal.useIsAuthenticated as any).mockImplementation(() => true);

		const api = await import('../../../src/lib/api-client');
		(api.apiClient as any).mockResolvedValue({ token: 'token-123', user: { email: 'user@example.com', name: 'User', role: 'user' } });

		const { AuthProvider, useAuth: useAuthFromModule } = await import('../../../src/lib/auth-context');

		function Consumer2() {
			const { isAuthenticated, isLoading, user, token } = useAuthFromModule();
			return (
				<div>
					<span data-testid="loading2">{String(isLoading)}</span>
					<span data-testid="auth2">{String(isAuthenticated)}</span>
					<span data-testid="user2">{user ? (user as any).email : 'no-user'}</span>
					<span data-testid="token2">{token ?? 'no-token'}</span>
				</div>
			);
		}

		const { render } = await import('@testing-library/react');

		render(
			<AuthProvider>
				<Consumer2 />
			</AuthProvider>,
		);

		await waitFor(() => expect(screen.getByTestId('loading2').textContent).toBe('false'));
		expect(screen.getByTestId('auth2').textContent).toBe('true');
		expect(screen.getByTestId('user2').textContent).toBe('user@example.com');
		expect(localStorage.getItem('tee_token')).toBe('token-123');
		expect(localStorage.getItem('tee_user')).toBe(JSON.stringify({ email: 'user@example.com', name: 'User', role: 'user' }));
	});

	it('maneja errores del backend y traduce mensajes', async () => {
		// Caso de fallo: `apiClient` rechaza con ApiError tipo NETWORK_ERROR.
		// El provider debe establecer `error` con un mensaje traducido.
		const mockAcquireTokenSilent = vi.fn(() => Promise.resolve({ idToken: 'id-token-123' }));

		const msal = await import('@azure/msal-react');
		(msal.useMsal as any).mockImplementation(() => ({
			instance: { acquireTokenSilent: mockAcquireTokenSilent },
			accounts: [{ username: 'user@example.com', homeAccountId: 'home-1' }],
		}));
		(msal.useIsAuthenticated as any).mockImplementation(() => true);

		const api = await import('../../../src/lib/api-client');
		const ApiError = (api as any).ApiError;
		(api.apiClient as any).mockRejectedValue(new ApiError('Network down', 0, 'NETWORK_ERROR'));

		const { AuthProvider, useAuth: useAuthFromModule } = await import('../../../src/lib/auth-context');

		function Consumer3() {
			const { isLoading, error } = useAuthFromModule();
			return (
				<div>
					<span data-testid="loading3">{String(isLoading)}</span>
					<span data-testid="error3">{error ?? 'no-error'}</span>
				</div>
			);
		}

		const { render } = await import('@testing-library/react');

		render(
			<AuthProvider>
				<Consumer3 />
			</AuthProvider>,
		);

		await waitFor(() => expect(screen.getByTestId('loading3').textContent).toBe('false'));
		expect(screen.getByTestId('error3').textContent).toContain('No se pudo conectar con el servidor');
	});

	it('loginWithMicrosoft llama loginRedirect y logout limpia sesion y llama logoutRedirect', async () => {
		// Verificamos que `loginWithMicrosoft` invoque `instance.loginRedirect`
		// y que `logout` limpie `localStorage` y llame `instance.logoutRedirect`.
		const mockAcquireTokenSilent = vi.fn(() => Promise.resolve({ idToken: 'id-token-123' }));
		const mockLoginRedirect = vi.fn();
		const mockLogoutRedirect = vi.fn();

		const msal = await import('@azure/msal-react');
		(msal.useMsal as any).mockImplementation(() => ({
			instance: {
				acquireTokenSilent: mockAcquireTokenSilent,
				loginRedirect: mockLoginRedirect,
				logoutRedirect: mockLogoutRedirect,
			},
			accounts: [{ username: 'user@example.com', homeAccountId: 'home-1' }],
		}));
		(msal.useIsAuthenticated as any).mockImplementation(() => false);

		const api = await import('../../../src/lib/api-client');
		(api.apiClient as any).mockResolvedValue({ token: 'token-123', user: { email: 'user@example.com', name: 'User', role: 'user' } });

		const { AuthProvider, useAuth: useAuthFromModule } = await import('../../../src/lib/auth-context');

		function Consumer4() {
			const { loginWithMicrosoft, logout } = useAuthFromModule();
			return (
				<div>
					<button data-testid="login" onClick={loginWithMicrosoft} />
					<button data-testid="logout" onClick={logout} />
				</div>
			);
		}

		const { render } = await import('@testing-library/react');
		const userEvent = (await import('@testing-library/user-event')).default;

		render(
			<AuthProvider>
				<Consumer4 />
			</AuthProvider>,
		);

		await userEvent.click(screen.getByTestId('login'));
		expect(mockLoginRedirect).toHaveBeenCalled();

		// Simular sesión guardada y luego logout
		localStorage.setItem('tee_token', 'token-123');
		localStorage.setItem('tee_user', JSON.stringify({ email: 'user@example.com' }));

		await userEvent.click(screen.getByTestId('logout'));
		expect(localStorage.getItem('tee_token')).toBeNull();
		expect(localStorage.getItem('tee_user')).toBeNull();
		expect(mockLogoutRedirect).toHaveBeenCalled();
	});
});
