// eslint flat config: the browser app in web-src and the Node-based Playwright tests.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['www/**', 'demo/**', 'android/**', 'node_modules/**', 'test-results/**', 'web-src/siteflow.html', 'backend/**'] },
  js.configs.recommended,
  {
    rules: {
      // `catch (_) {}` is the deliberate pattern around storage and optional browser APIs.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['web-src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } },
  },
];
