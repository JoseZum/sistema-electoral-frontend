/**
 * Suite objetivo: src/components/tags/TagBadge.tsx
 *
 * Pendiente:
 * - render de nombre y color
 * - clases segun el color de la tag
 * - fallback visual si falta informacion
 */

import { render, screen } from '@testing-library/react'; 
import { describe, it, expect } from 'vitest';
import TagBadge from '@/components/tags/TagBadge';

describe('TagBadge', () => {
  it('renders the label text', () => {
    render(<TagBadge label="Test Tag" />);
    expect(screen.getByText('Test Tag')).toBeInTheDocument();
  });

  it('applies the correct size class', () => {
    const { container } = render(<TagBadge label="Test" size="sm" />);
    const badge = container.querySelector('.tag-badge--sm');
    expect(badge).toBeInTheDocument();
  });

  it('applies md size by default', () => {
    const { container } = render(<TagBadge label="Test" />);
    const badge = container.querySelector('.tag-badge--md');
    expect(badge).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<TagBadge label="Test" className="custom-class" />);
    const badge = container.querySelector('.custom-class');
    expect(badge).toBeInTheDocument();
  });

  it('applies inline styles from style prop', () => {
    const { container } = render(<TagBadge label="Test" style={{ margin: '1rem' }} />);
    const badge = container.querySelector('.tag-badge');
    expect(badge).toHaveStyle('margin: 1rem');
  });

  it('renders with valid color option', () => {
    const { container } = render(<TagBadge label="RedTag" color="#C62828" />);
    const badge = container.querySelector('.tag-badge');
    expect(badge).toBeInTheDocument();
    // The color should be applied via CSS variable
    const style = window.getComputedStyle(badge!);
    expect(style.getPropertyValue('--tag-bg')).toBeTruthy();
  });

  it('uses fallback color when color is null', () => {
    const { container } = render(<TagBadge label="TestTag" color={null} />);
    const badge = container.querySelector('.tag-badge');
    expect(badge).toBeInTheDocument();
  });

  it('renders tag icon when leadingIcon is tag', () => {
    const { container } = render(<TagBadge label="Test" leadingIcon="tag" />);
    const icon = container.querySelector('.tag-badge__icon');
    expect(icon).toBeInTheDocument();
  });

  it('does not render icon when leadingIcon is not specified', () => {
    const { container } = render(<TagBadge label="Test" />);
    const icon = container.querySelector('.tag-badge__icon');
    expect(icon).not.toBeInTheDocument();
  });

  it('renders with white text color', () => {
    const { container } = render(<TagBadge label="Test" />);
    const badge = container.querySelector('.tag-badge');
    const style = window.getComputedStyle(badge!);
    expect(style.getPropertyValue('--tag-text')).toBe('#ffffff');
  });

  it('renders label in badge__label span', () => {
    const { container } = render(<TagBadge label="MyTag" />);
    const label = container.querySelector('.tag-badge__label');
    expect(label?.textContent).toBe('MyTag');
  });

  it('combines multiple classes correctly', () => {
    const { container } = render(
      <TagBadge label="Test" size="sm" className="extra-class" />
    );
    const badge = container.querySelector('.tag-badge');
    expect(badge).toHaveClass('tag-badge');
    expect(badge).toHaveClass('tag-badge--sm');
    expect(badge).toHaveClass('extra-class');
  });

  it('handles special characters in label', () => {
    render(<TagBadge label="Test & Special <>" />);
    expect(screen.getByText('Test & Special <>')).toBeInTheDocument();
  });

  it('sets aria-hidden on icon', () => {
    const { container } = render(<TagBadge label="Test" leadingIcon="tag" />);
    const icon = container.querySelector('.tag-badge__icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
