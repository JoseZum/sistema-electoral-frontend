import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      '.next-lighthouse-*/**',
      'node_modules/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'prefer-const': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default eslintConfig;
