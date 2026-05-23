/**
 * Suite objetivo: src/components/auth/LoginCard.tsx
 *
 * Casos de prueba:
 * - render basico
 * - visualizacion de contenido informativo
 * - invocacion del callback de login
 * - estado de carga/bloqueo del boton de Microsoft
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
	state: {
		isLoading: false,
		loginWithMicrosoft: vi.fn(),
		error: null as string | null,
	},
}));

// Mockear usando el alias que usa el componente (`@/lib/auth-context`) para
// asegurar que tanto `LoginCard` como `MicrosoftLoginButton` reciban el mismo
// mock del hook `useAuth`.
vi.mock('@/lib/auth-context', () => ({
	useAuth: () => authMock.state,
}));

import LoginCard from '../../../src/components/auth/LoginCard';

describe('LoginCard - render y delegación', () => {
	beforeEach(() => {
		authMock.state.isLoading = false;
		authMock.state.loginWithMicrosoft = vi.fn();
		authMock.state.error = null;
	});

	it('muestra los textos informativos principales', () => {
		// Renderizamos el componente y comprobamos que los textos estáticos
		// (título, subtítulo y nota de pie) aparecen en la UI.
		render(<LoginCard />);

		expect(screen.getByText('Tribunal Electoral Estudiantil')).toBeDefined();
		expect(screen.getByText(/Portal\ de\ votaci[oó]n/i)).toBeDefined();
		expect(screen.getByText(/Ingresa con tu cuenta institucional/i)).toBeDefined();
		expect(screen.getByText('Acceso institucional del TEE')).toBeDefined();
		expect(screen.getByRole('button', { name: 'Continuar con Microsoft' })).toBeDefined();
	});

	it('incluye el componente MicrosoftLoginButton y delega el click', async () => {
		// Sustituimos el handler global por un spy y verificamos que al
		// hacer click en el botón mockeado el spy es invocado.
		const user = userEvent.setup();
		const loginSpy = vi.fn();
		authMock.state.loginWithMicrosoft = loginSpy;

		render(<LoginCard />);

		const btn = screen.getByRole('button', { name: 'Continuar con Microsoft' });
		await user.click(btn);

		expect(loginSpy).toHaveBeenCalled();
	});

	it('bloquea el boton y muestra el estado de carga cuando isLoading=true', async () => {
		authMock.state.isLoading = true;
		const user = userEvent.setup();
		const loginSpy = vi.fn();
		authMock.state.loginWithMicrosoft = loginSpy;

		render(<LoginCard />);

		const btn = screen.getByRole('button', { name: 'Conectando...' });
		expect(btn).toBeDisabled();

		await user.click(btn);
		expect(loginSpy).not.toHaveBeenCalled();
	});
});

