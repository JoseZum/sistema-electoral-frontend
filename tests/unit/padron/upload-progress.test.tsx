/**
 * Suite objetivo: src/components/padron/UploadProgress.tsx
 *
 * Pendiente:
 * - progreso porcentual
 * - mensajes de estado
 * - transicion de carga a completado o error
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import UploadProgress, { completeProgress } from '@/components/padron/UploadProgress';

describe('UploadProgress', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not render when not uploading', () => {
        const { container } = render(<UploadProgress isUploading={false} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('renders progress when uploading', () => {
        render(<UploadProgress isUploading={true} />);

        expect(screen.getByText(/Procesando archivo/i)).toBeInTheDocument();
        expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('updates progress percentage over time', () => {
        render(<UploadProgress isUploading={true} />);

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(screen.getByText('6%')).toBeInTheDocument();
    });

    it('shows validation stage after progress advances', () => {
        render(<UploadProgress isUploading={true} />);

        act(() => {
            vi.advanceTimersByTime(1400);
        });

        expect(screen.getByText(/Validando registros/i)).toBeInTheDocument();
    });

    it('resets and disappears when upload stops', () => {
        const { container, rerender } = render(
            <UploadProgress isUploading={true} />
        );

        act(() => {
            vi.advanceTimersByTime(200);
        });

        rerender(<UploadProgress isUploading={false} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('does not progress beyond 95 while uploading', () => {
        render(<UploadProgress isUploading={true} />);

        act(() => {
            vi.advanceTimersByTime(10000);
        });

        expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('completeProgress sets progress to 100', () => {
        const setProgress = vi.fn();

        completeProgress(setProgress);

        expect(setProgress).toHaveBeenCalledWith(100);
    });
});