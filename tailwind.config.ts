import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1B365D',
          soft: '#2B4E7A',
        },
        surface: {
          DEFAULT: '#FAF9F7',
          raised: '#FFFFFF',
          sunken: '#F0EEEB',
        },
        accent: {
          DEFAULT: '#BE1E2D',
          hover: '#981824',
          light: '#FDF1F2',
          glow: 'rgba(190, 30, 45, 0.07)',
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
          DEFAULT: '#1B365D',
          light: '#F0F4F8',
        },
        warning: {
          DEFAULT: '#666666',
          light: '#F5F5F5',
        },
        error: {
          DEFAULT: '#BE1E2D',
          light: '#FDF1F2',
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
        sm: '0 1px 2px rgba(27,54,93,0.04)',
        md: '0 4px 12px rgba(27,54,93,0.06)',
        lg: '0 12px 32px rgba(27,54,93,0.08)',
        xl: '0 24px 48px rgba(27,54,93,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
