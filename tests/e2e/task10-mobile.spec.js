const { test, expect, devices } = require('@playwright/test');
const { shot, signIn, createApprovedProject } = require('./helpers');

test.use({ ...devices['Pixel 7'] });

test('site visit form is usable at phone width with a sticky submit bar', async ({ page, request }) => {
  await createApprovedProject(request, 'Kale Bungalow');
  await signIn(page, 'civil_engineer');
  await page.getByText('Kale Bungalow').click();
  await page.getByTestId('visit-start').click();
  await expect(page.getByTestId('visit-submit-mobile')).toBeVisible();
  await expect(page.getByTestId('visit-submit-mobile')).toBeDisabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, 'task10-09-mobile-visit-form');
});
