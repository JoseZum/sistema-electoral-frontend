/**
 * Suite objetivo: src/components/auth/MicrosoftLoginButton.tsx
 *
 * Casos de prueba:
 * - render del boton
 * - click del usuario
 * - delegacion hacia el handler de autenticacion
 * - estados disabled/loading si existen
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock del hook `useAuth` que exporta `src/lib/auth-context`.
// Usamos el alias '@/lib/auth-context' tal como lo importa el componente,
// Vitest respeta los alias definidos en `vitest.config.ts`.
vi.mock('@/lib/auth-context', () => ({
	useAuth: vi.fn(),
}));

import MicrosoftLoginButton from '../../../src/components/auth/MicrosoftLoginButton';

/**
 * Documentación de las pruebas:
 * - Objetivo: verificar que el botón muestra el texto correcto según
 *   el estado `isLoading` y que delega la acción de inicio de sesión
 *   al handler `loginWithMicrosoft` provisto por el hook `useAuth`.
 * - Estrategia: reemplazar `useAuth` por un mock y controlar las propiedades
 *   `isLoading` y `loginWithMicrosoft` para comprobar render y eventos.
 */
describe('MicrosoftLoginButton - comportamiento', () => {
	beforeEach(async () => {
		vi.resetModules();
		// limpiar implementación previa del mock usando import dinámico
		const auth = await import('@/lib/auth-context');
		if ((auth.useAuth as any)?.mockReset) (auth.useAuth as any).mockReset();
	});

	it('muestra el texto de continuación y llama loginWithMicrosoft al hacer click', async () => {
		// Preparamos el mock para usar en este test (import dinámico para resolver alias)
		const auth = await import('@/lib/auth-context');
		const mockLogin = vi.fn();
		(auth.useAuth as any).mockReturnValue({ loginWithMicrosoft: mockLogin, isLoading: false });

		render(<MicrosoftLoginButton />);

		// Verificamos que el texto por defecto aparece
		expect(screen.getByRole('button')).toHaveTextContent('Continuar con Microsoft');
		expect(screen.getByRole('button')).not.toBeDisabled();

		// Interacción: al click debe invocar al handler proporcionado por useAuth
		await userEvent.click(screen.getByRole('button'));
		expect(mockLogin).toHaveBeenCalled();
	});

	it('muestra estado de carga y deshabilita el botón cuando isLoading=true', async () => {
		const auth = await import('@/lib/auth-context');
		(auth.useAuth as any).mockReturnValue({ loginWithMicrosoft: vi.fn(), isLoading: true });

		render(<MicrosoftLoginButton />);

		expect(screen.getByRole('button')).toHaveTextContent('Conectando...');
		expect(screen.getByRole('button')).toBeDisabled();
	});
});

