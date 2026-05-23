/**
 * Suite objetivo: src/components/elections/ImmediateStartConfig.tsx
 *
 * Pendiente:
 * - activacion/desactivacion del modo inmediato
 * - validacion de duracion
 * - sincronizacion con el formulario padre
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ImmediateStartConfig, {
    formatImmediateDuration,
    getImmediateDurationMinutes,
} from '@/components/elections/ImmediateStartConfig';

describe('ImmediateStartConfig', () => {
    const mockOnChange = vi.fn();

    const defaultProps = {
        startTime: '2026-06-01T08:00',
        endTime: '2026-06-01T18:00',
        startsImmediately: false,
        durationValue: '15',
        durationUnit: 'minutes' as const,
        onChange: mockOnChange,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders scheduled and immediate options', () => {
        render(<ImmediateStartConfig {...defaultProps} />);

        expect(screen.getByText('Elegir apertura y cierre')).toBeInTheDocument();
        expect(screen.getByText('Iniciar cuando se cree')).toBeInTheDocument();
    });

    it('enables date fields when scheduled mode is active', () => {
        render(<ImmediateStartConfig {...defaultProps} />);

        expect(screen.getByLabelText(/Fecha y hora de apertura/i)).not.toBeDisabled();
        expect(screen.getByLabelText(/Fecha y hora de cierre/i)).not.toBeDisabled();
    });

    it('disables immediate duration fields when scheduled mode is active', () => {
        render(<ImmediateStartConfig {...defaultProps} />);

        expect(screen.getByLabelText(/duraci[oó]n\ de\ la\ votaci[oó]n\ inmediata/i)).toBeDisabled();
        expect(screen.getByLabelText(/Unidad de duraci[oó]n/i)).toBeDisabled();
    });

    it('calls onChange when selecting immediate mode', async () => {
        const user = userEvent.setup();

        render(<ImmediateStartConfig {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: /Iniciar cuando se cree/i }));

        expect(mockOnChange).toHaveBeenCalledWith({
            startsImmediately: true,
        });
    });

    it('calls onChange when selecting scheduled mode', async () => {
        const user = userEvent.setup();

        render(
            <ImmediateStartConfig
                {...defaultProps}
                startsImmediately={true}
            />
        );

        await user.click(screen.getByRole('button', { name: /Elegir apertura y cierre/i }));

        expect(mockOnChange).toHaveBeenCalledWith({
            startsImmediately: false,
        });
    });

    it('disables date fields when immediate mode is active', () => {
        render(
            <ImmediateStartConfig
                {...defaultProps}
                startsImmediately={true}
            />
        );

        expect(screen.getByLabelText(/Fecha y hora de apertura/i)).toBeDisabled();
        expect(screen.getByLabelText(/Fecha y hora de cierre/i)).toBeDisabled();
    });

    it('enables duration fields when immediate mode is active', () => {
        render(
            <ImmediateStartConfig
                {...defaultProps}
                startsImmediately={true}
            />
        );

        expect(screen.getByLabelText(/duraci[oó]n\ de\ la\ votaci[oó]n\ inmediata/i)).not.toBeDisabled();
        expect(
            screen.getByLabelText(/Unidad\ de\ duraci[oó]n\ de\ la\ votaci[oó]n\ inmediata/i)
        ).not.toBeDisabled();
    });

    it('syncs start time with parent form', async () => {
        const user = userEvent.setup();

        render(<ImmediateStartConfig {...defaultProps} startTime="" />);

        const input = screen.getByLabelText(/Fecha y hora de apertura/i);

        await user.type(input, '2026-07-01T08:30');

        expect(mockOnChange).toHaveBeenLastCalledWith({
            startTime: '2026-07-01T08:30',
        });
    });

    it('syncs end time with parent form', async () => {
        const user = userEvent.setup();

        render(<ImmediateStartConfig {...defaultProps} endTime="" />);

        const input = screen.getByLabelText(/Fecha y hora de cierre/i);

        await user.type(input, '2026-07-01T18:30');

        expect(mockOnChange).toHaveBeenLastCalledWith({
            endTime: '2026-07-01T18:30',
        });
    });

    it('syncs immediate duration value with parent form', async () => {
        const user = userEvent.setup();

        render(
            <ImmediateStartConfig
                {...defaultProps}
                startsImmediately={true}
            />
        );

        const durationSelect = screen.getByLabelText(
            'Duracion de la votacion inmediata'
        );

        await user.selectOptions(durationSelect, '30');

        expect(mockOnChange).toHaveBeenCalledWith({
            durationValue: '30',
        });
    });

    it('syncs immediate duration unit with parent form', async () => {
        const user = userEvent.setup();

        render(
            <ImmediateStartConfig
                {...defaultProps}
                startsImmediately={true}
            />
        );

        const unitSelect = screen.getByLabelText(
            'Unidad de duracion de la votacion inmediata'
        );

        await user.selectOptions(unitSelect, 'hours');

        expect(mockOnChange).toHaveBeenCalledWith({
            durationUnit: 'hours',
            durationValue: '15',
        });
    });

    it('adjusts duration value when changing unit and current value is invalid for new unit', async () => {
        const user = userEvent.setup();

        render(
            <ImmediateStartConfig
                {...defaultProps}
                startsImmediately={true}
                durationValue="30"
                durationUnit="minutes"
            />
        );

        const unitSelect = screen.getByLabelText(
            'Unidad de duracion de la votacion inmediata'
        );

        await user.selectOptions(unitSelect, 'hours');

        expect(mockOnChange).toHaveBeenCalledWith({
            durationUnit: 'hours',
            durationValue: '1',
        });
    });

    it('shows immediate duration summary', () => {
        render(
            <ImmediateStartConfig
                {...defaultProps}
                startsImmediately={true}
                durationValue="2"
                durationUnit="hours"
            />
        );

        expect(
            screen.getByText(/durará 2 horas/i)
        ).toBeInTheDocument();
    });

    it('formatImmediateDuration formats minutes, hours and days', () => {
        expect(formatImmediateDuration('1', 'minutes')).toBe('1 minuto');
        expect(formatImmediateDuration('2', 'minutes')).toBe('2 minutos');
        expect(formatImmediateDuration('1', 'hours')).toBe('1 hora');
        expect(formatImmediateDuration('2', 'hours')).toBe('2 horas');
        expect(formatImmediateDuration('1', 'days')).toBe('1 día');
        expect(formatImmediateDuration('2', 'days')).toBe('2 días');
    });

    it('formatImmediateDuration returns empty string for invalid values', () => {
        expect(formatImmediateDuration('', 'minutes')).toBe('');
        expect(formatImmediateDuration('0', 'minutes')).toBe('');
        expect(formatImmediateDuration('-1', 'minutes')).toBe('');
        expect(formatImmediateDuration('1.5', 'minutes')).toBe('');
    });

    it('getImmediateDurationMinutes converts duration to minutes', () => {
        expect(getImmediateDurationMinutes('15', 'minutes')).toBe(15);
        expect(getImmediateDurationMinutes('2', 'hours')).toBe(120);
        expect(getImmediateDurationMinutes('1', 'days')).toBe(1440);
    });

    it('getImmediateDurationMinutes returns null for invalid values', () => {
        expect(getImmediateDurationMinutes('', 'minutes')).toBeNull();
        expect(getImmediateDurationMinutes('0', 'minutes')).toBeNull();
        expect(getImmediateDurationMinutes('-1', 'minutes')).toBeNull();
        expect(getImmediateDurationMinutes('1.5', 'minutes')).toBeNull();
    });
});