// Field-level rules on screen: the fee plan shows for the Architect and never for the Civil Engineer.
const { test, expect } = require('@playwright/test');
const { shot, signIn, api } = require('./helpers');

test('architect sets the fee plan; the civil engineer does not see it', async ({ page, request }) => {
  const engineers = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  await api(request, 'architect', 'POST', '/projects', { name: 'Kelkar Villa', location: 'Kothrud, Pune', civil_engineer_id: engineers[0].id });

  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText('Kelkar Villa').click();
  await expect(page.getByTestId('fee-plan-panel')).toContainText('Contract value');
  await page.getByTestId('fee-edit').click();
  await page.getByTestId('fee-value').fill('1250000');
  await page.getByTestId('fee-basis').fill('Total fee');
  await page.getByTestId('fee-save').click();
  await expect(page.locator('#toast')).toContainText('Fee plan saved');
  await expect(page.getByTestId('fee-contract-value')).toHaveText('₹12,50,000');
  await expect(page.getByTestId('audit-list')).toContainText('Fee plan updated');
  await shot(page, 'task19-01-fee-plan');

  await signIn(page, 'civil_engineer');
  await page.getByTestId('projects-view').getByText('Kelkar Villa').click();
  await expect(page.getByTestId('project-title')).toHaveText('Kelkar Villa');
  await expect(page.getByTestId('fee-plan-panel')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('12,50,000');
  await shot(page, 'task19-02-engineer-no-fee-plan');
});
