import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'tsconfig.tsbuildinfo'],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'error',
    },
  },
]
