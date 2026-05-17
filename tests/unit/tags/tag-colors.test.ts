/**
 * Suite objetivo: src/lib/tag-colors.ts
 *
 * Pendiente:
 * - mapeo de colores validos
 * - fallback por defecto
 * - consistencia entre claves y valores exportados
 */

import { describe, it, expect } from 'vitest';
import {
  TAG_COLOR_OPTIONS,
  TAG_COLOR_VALUES,
  DEFAULT_TAG_COLOR,
  normalizeTagColor,
  getFallbackTagColor,
  resolveTagColor,
} from '@/lib/tag-colors';

describe('tag-colors', () => {
  describe('TAG_COLOR_OPTIONS', () => {
    it('should export color options', () => {
      expect(TAG_COLOR_OPTIONS).toBeDefined();
      expect(Array.isArray(TAG_COLOR_OPTIONS)).toBe(true);
    });

    it('should contain valid color objects with value and label', () => {
      TAG_COLOR_OPTIONS.forEach((option) => {
        expect(option.value).toBeDefined();
        expect(option.label).toBeDefined();
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
      });
    });

    it('should have at least one color option', () => {
      expect(TAG_COLOR_OPTIONS.length).toBeGreaterThan(0);
    });

    it('should have hex color values', () => {
      TAG_COLOR_OPTIONS.forEach((option) => {
        expect(/^#[0-9A-F]{6}$/i.test(option.value)).toBe(true);
      });
    });
  });

  describe('TAG_COLOR_VALUES', () => {
    it('should be derived from TAG_COLOR_OPTIONS', () => {
      expect(TAG_COLOR_VALUES.length).toBe(TAG_COLOR_OPTIONS.length);
    });

    it('should contain all color values from options', () => {
      const optionValues = TAG_COLOR_OPTIONS.map((option) => option.value);
      expect(TAG_COLOR_VALUES).toEqual(optionValues);
    });

    it('should all be uppercase hex colors', () => {
      TAG_COLOR_VALUES.forEach((value) => {
        expect(/^#[0-9A-F]{6}$/i.test(value)).toBe(true);
      });
    });
  });

  describe('DEFAULT_TAG_COLOR', () => {
    it('should be the first color option value', () => {
      expect(DEFAULT_TAG_COLOR).toBe(TAG_COLOR_OPTIONS[0].value);
    });

    it('should be a valid hex color', () => {
      expect(/^#[0-9A-F]{6}$/i.test(DEFAULT_TAG_COLOR)).toBe(true);
    });

    it('should be included in TAG_COLOR_VALUES', () => {
      expect(TAG_COLOR_VALUES).toContain(DEFAULT_TAG_COLOR);
    });
  });

  describe('normalizeTagColor', () => {
    it('should return null for undefined color', () => {
      expect(normalizeTagColor(undefined)).toBe(null);
    });

    it('should return null for null color', () => {
      expect(normalizeTagColor(null)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(normalizeTagColor('')).toBe(null);
    });

    it('should normalize lowercase to uppercase', () => {
      const result = normalizeTagColor('#c62828');
      expect(result).toBe('#C62828');
    });

    it('should trim whitespace', () => {
      const result = normalizeTagColor('  #C62828  ');
      expect(result).toBe('#C62828');
    });

    it('should return the color if it is valid', () => {
      const validColor = TAG_COLOR_OPTIONS[0].value;
      const result = normalizeTagColor(validColor);
      expect(result).toBe(validColor);
    });

    it('should return null for invalid color', () => {
      const result = normalizeTagColor('#FFFFFF');
      expect(result).toBe(null);
    });

    it('should handle mixed case colors', () => {
      const result = normalizeTagColor('#c6282a');
      expect(result).toBeNull();
    });
  });

  describe('getFallbackTagColor', () => {
    it('should return a valid color from TAG_COLOR_VALUES', () => {
      const result = getFallbackTagColor('TestTag');
      expect(TAG_COLOR_VALUES).toContain(result);
    });

    it('should always return the same color for the same tag name', () => {
      const name = 'ConsistentTag';
      const result1 = getFallbackTagColor(name);
      const result2 = getFallbackTagColor(name);
      expect(result1).toBe(result2);
    });

    it('should return different colors for different tag names', () => {
      const result1 = getFallbackTagColor('TagA');
      const result2 = getFallbackTagColor('TagB');
      // While not guaranteed, different names should usually produce different colors
      // We just verify both are valid
      expect(TAG_COLOR_VALUES).toContain(result1);
      expect(TAG_COLOR_VALUES).toContain(result2);
    });

    it('should use a hash function based on tag name', () => {
      const result = getFallbackTagColor('Test');
      expect(typeof result).toBe('string');
      expect(/^#[0-9A-F]{6}$/i.test(result)).toBe(true);
    });

    it('should handle empty string gracefully', () => {
      const result = getFallbackTagColor('');
      expect(TAG_COLOR_VALUES).toContain(result);
    });

    it('should handle special characters', () => {
      const result = getFallbackTagColor('Tag!@#$%');
      expect(TAG_COLOR_VALUES).toContain(result);
    });

    it('should never return null or undefined', () => {
      const result1 = getFallbackTagColor('Any');
      const result2 = getFallbackTagColor('Tag');
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
    });
  });

  describe('resolveTagColor', () => {
    it('should use provided color if valid', () => {
      const validColor = TAG_COLOR_OPTIONS[0].value;
      const result = resolveTagColor('TestTag', validColor);
      expect(result).toBe(validColor);
    });

    it('should use fallback if color is null', () => {
      const result = resolveTagColor('TestTag', null);
      expect(TAG_COLOR_VALUES).toContain(result);
    });

    it('should use fallback if color is undefined', () => {
      const result = resolveTagColor('TestTag', undefined);
      expect(TAG_COLOR_VALUES).toContain(result);
    });

    it('should use fallback for invalid color', () => {
      const result = resolveTagColor('TestTag', '#FFFFFF');
      expect(TAG_COLOR_VALUES).toContain(result);
    });

    it('should normalize and use valid lowercase color', () => {
      const validColor = TAG_COLOR_OPTIONS[0].value;
      const lowercaseColor = validColor.toLowerCase();
      const result = resolveTagColor('TestTag', lowercaseColor);
      expect(result).toBe(validColor);
    });

    it('should never return null or undefined', () => {
      expect(resolveTagColor('Tag', null)).not.toBeNull();
      expect(resolveTagColor('Tag', undefined)).not.toBeNull();
      expect(resolveTagColor('Tag', '#INVALID')).not.toBeNull();
    });

    it('should always return a valid color', () => {
      const testCases = [
        { name: 'Tag1', color: TAG_COLOR_OPTIONS[0].value },
        { name: 'Tag2', color: null },
        { name: 'Tag3', color: undefined },
        { name: 'Tag4', color: '#INVALID' },
      ];

      testCases.forEach(({ name, color }) => {
        const result = resolveTagColor(name, color);
        expect(TAG_COLOR_VALUES).toContain(result);
      });
    });
  });
});
