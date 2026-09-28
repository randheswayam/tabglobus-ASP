// Admin imports in-progress projects from a CSV: preview with row errors, all-or-nothing refused, then ready rows only.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { shot, signIn } = require('./helpers');

const FILE = path.join(__dirname, 'fixtures', 'import-3rows.csv');

test('admin previews a 3-row file, is refused all-or-nothing, then imports the 2 ready rows', async ({ page }) => {
  await signIn(page, 'admin');
  await page.getByTestId('nav-import').click();
  await expect(page.getByTestId('import-view')).toBeVisible();
  await shot(page, 'task22-01-import-screen');

  await page.getByTestId('import-file').setInputFiles(FILE);
  await page.getByTestId('import-preview').click();
  await expect(page.getByTestId('import-counts')).toHaveText('3 rows · 2 ready · 1 with errors');
  await expect(page.getByTestId('import-row-4')).toContainText("current_stage 'roofing' is not a stage");
  await expect(page.getByTestId('import-row-2')).toContainText('Ready');
  await shot(page, 'task22-02-preview');

  await page.getByTestId('import-commit').click();  // all or nothing is the default
  await expect(page.getByTestId('form-error')).toContainText('Nothing was imported');
  await shot(page, 'task22-03-refused');

  await page.getByTestId('import-mode-valid').check();
  await page.getByTestId('import-commit').click();
  const result = page.getByTestId('import-result');
  await expect(result).toContainText('Imported 2 projects');
  await expect(result).toContainText('Import Sathe House');
  await expect(page.getByTestId('import-view')).toContainText('2 of 3 imported');
  await shot(page, 'task22-04-imported');

  await result.getByText('Import Sathe House').click();
  await expect(page.getByTestId('project-title')).toHaveText('Import Sathe House');
  await expect(page.getByTestId('stage-investigations')).toContainText('Historical');
  await expect(page.getByTestId('project-client')).toContainText('Sathe family');
  await shot(page, 'task22-05-imported-project');
});
