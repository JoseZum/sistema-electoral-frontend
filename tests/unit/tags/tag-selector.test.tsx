/**
 * Suite objetivo: src/components/tags/TagSelector.tsx
 *
 * Pendiente:
 * - carga de opciones
 * - seleccion de una tag
 * - manejo de estados vacio y loading
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TagSelector from '@/components/tags/TagSelector';
import * as tagsApiModule from '@/lib/tags-api';

vi.mock('@/lib/tags-api', () => ({
  listTags: vi.fn(),
}));

const mockTag1 = {
  id: 'tag-1',
  name: 'Engineering Team',
  color: '#C62828',
  description: 'Team members from engineering',
  member_count: 5,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const mockTag2 = {
  id: 'tag-2',
  name: 'HR Team',
  color: '#1565C0',
  description: 'Human resources team',
  member_count: 3,
  created_at: '2024-01-02',
  updated_at: '2024-01-02',
};

describe('TagSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
    vi.clearAllMocks();
  });

  it('renders the label text', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([]);

    render(<TagSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('Tag')).toBeInTheDocument();
    });
  });

  it('renders custom label when provided', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([]);

    render(
      <TagSelector value={null} onChange={mockOnChange} label="Custom Label" />
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });
  });

  it('renders helper text when provided', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([]);

    render(
      <TagSelector 
        value={null} 
        onChange={mockOnChange} 
        helperText="This is helper text"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });
  });

  it('loads tags on mount', async () => {
    const listTagsMock = vi.mocked(tagsApiModule.listTags);
    listTagsMock.mockResolvedValueOnce([mockTag1, mockTag2]);

    render(<TagSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(listTagsMock).toHaveBeenCalled();
    });
  });

  it('displays available tags in select options', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([mockTag1, mockTag2]);

    render(<TagSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText(/Engineering Team/i)).toBeInTheDocument();
      expect(screen.getByText(/HR Team/i)).toBeInTheDocument();
    });
  });

  it('displays empty option when no tags exist', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([]);

    render(<TagSelector value={null} onChange={mockOnChange} allowClear={true} />);

    await waitFor(() => {
      expect(screen.getByText('Sin tag')).toBeInTheDocument();
    });
  });

  it('disables select when loading', async () => {
    vi.mocked(tagsApiModule.listTags).mockImplementationOnce(
      () => new Promise(() => {})
    );

    render(<TagSelector value={null} onChange={mockOnChange} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  it('disables select when no tags available', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([]);

    render(<TagSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  it('calls onChange when tag is selected', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([mockTag1, mockTag2]);

    const { container } = render(
      <TagSelector value={null} onChange={mockOnChange} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Engineering Team/i)).toBeInTheDocument();
    });

    const select = container.querySelector('select');
    await userEvent.selectOptions(select!, 'tag-1');

    expect(mockOnChange).toHaveBeenCalledWith('tag-1');
  });

  it('displays selected tag badge', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([mockTag1, mockTag2]);

    const { container } = render(
      <TagSelector value={mockTag1.id} onChange={mockOnChange} />
    );

    await waitFor(() => {
      const badge = container.querySelector('.tag-badge');
      expect(badge).toBeInTheDocument();
      expect(screen.getByText(mockTag1.name)).toBeInTheDocument();
    });
  });

  it('displays member count for selected tag', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([mockTag1]);

    render(<TagSelector value={mockTag1.id} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText(/5 integrantes/i)).toBeInTheDocument();
    });
  });

  it('displays member count singular form', async () => {
    const tagWithOneMemember = { ...mockTag1, member_count: 1 };
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([tagWithOneMemember]);

    render(<TagSelector value={tagWithOneMemember.id} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText(/1 integrante/i)).toBeInTheDocument();
    });
  });

  it('displays member count in option text', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([mockTag1]);

    render(<TagSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText(/Engineering Team \(5\)/i)).toBeInTheDocument();
    });
  });

  it('calls onChange with null when clearing selection', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([mockTag1, mockTag2]);

    const { container } = render(
      <TagSelector value={mockTag1.id} onChange={mockOnChange} allowClear={true} />
    );

    await waitFor(() => {
      expect(screen.getByText(mockTag1.name)).toBeInTheDocument();
    });

    const select = container.querySelector('select');
    await userEvent.selectOptions(select!, '');

    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('shows error message when no tags available', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([]);

    render(<TagSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(
        screen.getByText(/No hay tags disponibles/i)
      ).toBeInTheDocument();
    });
  });

  it('handles loading error gracefully', async () => {
    vi.mocked(tagsApiModule.listTags).mockRejectedValueOnce(
      new Error('Failed to load tags')
    );

    render(<TagSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  it('respects allowClear prop', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([mockTag1]);

    render(
      <TagSelector value={null} onChange={mockOnChange} allowClear={false} />
    );

    await waitFor(() => {
      expect(screen.getByText('Selecciona una tag')).toBeInTheDocument();
    });
  });

  it('includes administrar tags link', async () => {
    vi.mocked(tagsApiModule.listTags).mockResolvedValueOnce([]);

    render(<TagSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      const link = screen.getByText('Administrar tags');
      expect(link).toHaveAttribute('href', '/tags');
    });
  });
});
