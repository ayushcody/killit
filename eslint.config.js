import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': 'off',
      'no-console': 'off',
      'no-undef': 'off', // TypeScript handles undef checks natively
    },
  },
  {
    ignores: ['dist', 'node_modules', 'docs', 'guide'],
  },
]
