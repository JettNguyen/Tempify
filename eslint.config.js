import js from '@eslint/js'
import globals from 'globals'
import pluginReact from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    // ios/ holds the native project plus the web bundle Capacitor copies into
    // it, and .claude/ holds worktrees with their own copies of the code, so
    // linting either just reports the same code twice.
    ignores: ['dist/**', 'ios/**', '.claude/**', '**/*.min.js'],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    extends: [
      js.configs.recommended,
      pluginReact.configs.flat.recommended,
      pluginReact.configs.flat['jsx-runtime'],
    ],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // A hook below a component's early return runs on some renders and not
      // others, and React throws when the count changes. Admin had one.
      'react-hooks/rules-of-hooks': 'error',
      // Left off, as in NightLink: several effects leave deps out on purpose to
      // run once, and the warnings would bury the rule above.
      'react-hooks/exhaustive-deps': 'off',
      // The app doesn't use prop-types.
      'react/prop-types': 'off',
      // Apostrophes and quotes in copy are fine in JSX. A stray > or } is the
      // mistake worth catching.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
      // React 18 passes fetchpriority through only when it's spelled in lowercase.
      'react/no-unknown-property': ['error', { ignore: ['fetchpriority'] }],
    },
  },
  {
    files: ['vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'scripts/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    // Cloudflare Workers, which have HTMLRewriter alongside the web globals.
    files: ['workers/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker, HTMLRewriter: 'readonly' } },
  },
])
