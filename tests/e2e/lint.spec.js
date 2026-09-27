// The web app and the E2E tests pass eslint (rules in eslint.config.js).
const path = require('path');
const { test, expect } = require('@playwright/test');
const { ESLint } = require('eslint');

test('web-src and tests pass eslint', async () => {
  const eslint = new ESLint({ cwd: path.join(__dirname, '..', '..') });
  const results = await eslint.lintFiles(['web-src', 'tests/e2e', 'playwright.config.js', 'eslint.config.js']);
  const problems = results.flatMap(r => r.messages.map(m => `${path.basename(r.filePath)}:${m.line} ${m.ruleId} ${m.message}`));
  expect(problems).toEqual([]);
});
