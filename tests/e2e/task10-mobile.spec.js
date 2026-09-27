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
  const width = page.viewportSize().width;
  for (const id of ['visit-photos', 'visit-missing']){
    const box = await page.getByTestId(id).boundingBox();
    expect(box.x + box.width, id).toBeLessThanOrEqual(width);
  }
  await shot(page, 'task10-09-mobile-visit-form');
});
