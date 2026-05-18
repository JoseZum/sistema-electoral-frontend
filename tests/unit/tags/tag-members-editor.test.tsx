/**
 * Suite objetivo: src/components/tags/TagMembersEditor.tsx
 *
 * Pendiente:
 * - agregar y quitar miembros
 * - evitar duplicados
 * - sincronizacion con el estado padre
 * - validaciones de seleccion
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TagMembersEditor from '@/components/tags/TagMembersEditor';
import * as apiClientModule from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}));

const mockStudent = {
  id: '1',
  carnet: 'A123456',
  full_name: 'Juan Pérez',
  sede: 'Sede Central',
  career: 'Ingeniería',
  degree_level: 'Licenciatura',
  is_active: true,
};

const mockStudent2 = {
  id: '2',
  carnet: 'A654321',
  full_name: 'María García',
  sede: 'Sede Este',
  career: 'Derecho',
  degree_level: 'Licenciatura',
  is_active: true,
};

describe('TagMembersEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
    vi.clearAllMocks();
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValue({
      sedes: ['Sede Central', 'Sede Este'],
      careers: ['Ingeniería', 'Derecho'],
    });
  });

  it('renders the search input', async () => {
    render(<TagMembersEditor value={[]} onChange={mockOnChange} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nombre o carnet...')).toBeInTheDocument();
    });
  });

  it('renders the members editor title', async () => {
    render(<TagMembersEditor value={[]} onChange={mockOnChange} />);
    await waitFor(() => {
      expect(screen.getByText('Seleccionadas')).toBeInTheDocument();
    });
  });

  it('loads catalog on mount', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    render(<TagMembersEditor value={[]} onChange={mockOnChange} />);
    
    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith('/api/users/students/catalog');
    });
  });

  it('displays empty state message initially', async () => {
    render(<TagMembersEditor value={[]} onChange={mockOnChange} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Aplica filtros y presiona Buscar/i)).toBeInTheDocument();
    });
  });

  it('performs search when search button is clicked', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });
    apiClient.mockResolvedValueOnce({
      students: [mockStudent],
      total: 1,
    });

    render(<TagMembersEditor value={[]} onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Nombre o carnet...');
    await userEvent.type(searchInput, 'Juan');
    
    const searchButton = screen.getByRole('button', { name: /Buscar/i });
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/students')
      );
    });
  });

  it('adds a member when add button is clicked', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });
    apiClient.mockResolvedValueOnce({
      students: [mockStudent],
      total: 1,
    });

    const { rerender } = render(<TagMembersEditor value={[]} onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Nombre o carnet...');
    await userEvent.type(searchInput, 'Juan');
    
    const searchButton = screen.getByRole('button', { name: /Buscar/i });
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /Agregar/i });
    const addButton = addButtons.find((btn) => {
      const parent = btn.closest('div');
      return parent?.textContent?.includes('Juan Pérez');
    });
    
    await userEvent.click(addButton!);

    expect(mockOnChange).toHaveBeenCalledWith([mockStudent]);
  });

  it('removes a member when remove button is clicked', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });

    render(<TagMembersEditor value={[mockStudent]} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole('button', { name: /Quitar/i });
    const removeButton = removeButtons.find((btn) => {
      const parent = btn.closest('div');
      return parent?.textContent?.includes('Juan Pérez');
    });

    await userEvent.click(removeButton!);

    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('prevents adding duplicate members', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });
    apiClient.mockResolvedValueOnce({
      students: [mockStudent],
      total: 1,
    });

    const { rerender } = render(
      <TagMembersEditor value={[mockStudent]} onChange={mockOnChange} />
    );
    
    const searchInput = screen.getByPlaceholderText('Nombre o carnet...');
    await userEvent.type(searchInput, 'Juan');
    
    const searchButton = screen.getByRole('button', { name: /Buscar/i });
    await userEvent.click(searchButton);

    await waitFor(() => {
      // Since the student is already selected, they should not appear in results
      const results = screen.queryAllByText('Juan Pérez');
      expect(results.length).toBeLessThan(2);
    });
  });

  it('clears filters when clear button is clicked', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });

    render(<TagMembersEditor value={[]} onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Nombre o carnet...');
    await userEvent.type(searchInput, 'search text');

    await waitFor(() => {
      const clearButton = screen.getByRole('button', { name: /Limpiar filtros/i });
      expect(clearButton).not.toBeDisabled();
    });

    const clearButton = screen.getByRole('button', { name: /Limpiar filtros/i });
    await userEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('performs search on Enter key in search input', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });
    apiClient.mockResolvedValueOnce({
      students: [mockStudent],
      total: 1,
    });

    render(<TagMembersEditor value={[]} onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Nombre o carnet...');
    await userEvent.type(searchInput, 'Juan');
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalled();
    });
  });

  it('shows error message on search failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const apiClient = vi.mocked(apiClientModule.apiClient);

    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });

    apiClient.mockRejectedValueOnce(new Error('Search failed'));

    render(<TagMembersEditor value={[]} onChange={mockOnChange} />);

    const searchInput = screen.getByPlaceholderText('Nombre o carnet...');
    await userEvent.type(searchInput, 'Juan');

    const searchButton = screen.getByRole('button', { name: /Buscar/i });
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('displays selected members count', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });

    render(
      <TagMembersEditor 
        value={[mockStudent, mockStudent2]} 
        onChange={mockOnChange} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows clear all button when members are selected', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });

    render(
      <TagMembersEditor value={[mockStudent]} onChange={mockOnChange} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Quitar todas/i })).toBeInTheDocument();
    });
  });

  it('clears all members when "remove all" button is clicked', async () => {
    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });

    render(
      <TagMembersEditor 
        value={[mockStudent, mockStudent2]} 
        onChange={mockOnChange} 
      />
    );

    await waitFor(() => {
      const removeAllButton = screen.getByRole('button', { name: /Quitar todas/i });
      expect(removeAllButton).toBeInTheDocument();
    });

    const removeAllButton = screen.getByRole('button', { name: /Quitar todas/i });
    await userEvent.click(removeAllButton);

    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('uses custom copy strings when provided', async () => {
    const customCopy = {
      searchLabel: 'Custom Search Label',
      searchPrompt: 'Custom Prompt',
    };

    const apiClient = vi.mocked(apiClientModule.apiClient);
    apiClient.mockResolvedValueOnce({
      sedes: ['Sede Central'],
      careers: ['Ingeniería'],
    });

    render(
      <TagMembersEditor value={[]} onChange={mockOnChange} copy={customCopy} />
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Search Label')).toBeInTheDocument();
      expect(screen.getByText('Custom Prompt')).toBeInTheDocument();
    });
  });
});
