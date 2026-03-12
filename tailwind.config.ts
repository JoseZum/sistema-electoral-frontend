import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#141414',
          soft: '#333333',
        },
        surface: {
          DEFAULT: '#FAF9F7',
          raised: '#FFFFFF',
          sunken: '#F0EEEB',
        },
        accent: {
          DEFAULT: '#E53935',
          hover: '#C62828',
          light: '#FFF5F5',
          glow: 'rgba(229, 57, 53, 0.07)',
        },
        muted: {
          DEFAULT: '#666666',
          light: '#999999',
        },
        border: {
          DEFAULT: '#E5E5E5',
          strong: '#CCCCCC',
        },
        success: {
          DEFAULT: '#0D7C46',
          light: '#ECFDF5',
        },
        warning: {
          DEFAULT: '#B45309',
          light: '#FFFBEB',
        },
        error: {
          DEFAULT: '#D32F2F',
          light: '#FFF5F5',
        },
      },
      fontFamily: {
        display: ['Newsreader', 'serif'],
        body: ['Instrument Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(12,18,32,0.04)',
        md: '0 4px 12px rgba(12,18,32,0.06)',
        lg: '0 12px 32px rgba(12,18,32,0.08)',
        xl: '0 24px 48px rgba(12,18,32,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
