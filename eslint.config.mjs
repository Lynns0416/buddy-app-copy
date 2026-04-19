import tsPlugin from '@typescript-eslint/eslint-plugin'
import prettier from 'eslint-config-prettier'

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/web/**'] },
  ...tsPlugin.configs['flat/recommended-type-checked'],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  prettier,
]
