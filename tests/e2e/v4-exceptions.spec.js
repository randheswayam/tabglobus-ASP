// Placeholder gates: the 50% upfront gate blocks until the Team Lead records an exception with a reason.
const { test, expect } = require('@playwright/test');
const { shot, signIn, api } = require('./helpers');

test('team lead records an exception on the 50% upfront gate and the stage is completed', async ({ page, request }) => {
  const engineers = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  const p = await api(request, 'architect', 'POST', '/projects', {
    name: 'Joshi Row House', location: 'Kothrud, Pune', civil_engineer_id: engineers[0].id,
    start_stage: 'payment_gate', historical_confirmed_by: 'Parvez',
  });

  await signIn(page, 'team_lead');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText('Joshi Row House').click();
  await page.getByTestId('stage-payment_gate').click();
  const detail = page.getByTestId('stage-detail-payment_gate');
  await expect(detail).toContainText('The payment check is not built in SiteFlow yet');
  await expect(page.getByTestId('stage-complete-payment_gate')).toHaveCount(0);
  await shot(page, 'task16-01-blocked-by-placeholder');

  await page.getByTestId('stage-exception-payment_gate').click();
  await expect(page.locator('#toast')).toContainText('Give a reason');
  await page.getByTestId('stage-exception-reason-payment_gate').fill('50% received by bank transfer, reference 4471; Accounts confirmed.');
  await page.getByTestId('stage-exception-payment_gate').click();
  await expect(page.locator('#toast')).toContainText('Exception recorded');
  // The stage detail stays open after the update.
  await expect(page.getByTestId('stage-exception-note-payment_gate-payment')).toContainText('reference 4471');
  await shot(page, 'task16-02-exception-recorded');

  await page.getByTestId('stage-note-payment_gate').fill('50% upfront fee received.');
  await page.getByTestId('stage-complete-payment_gate').click();
  await expect(page.getByTestId('stage-payment_gate')).toContainText('Done');
  await expect(page.getByTestId('audit-list')).toContainText('Exception recorded on 50% upfront gate');
  await shot(page, 'task16-03-completed');
  expect(p.id).toBeTruthy();
});

test('the architect sees the reason but cannot record an exception', async ({ page, request }) => {
  const engineers = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  await api(request, 'architect', 'POST', '/projects', {
    name: 'Pawar Farmhouse', location: 'Mulshi, Pune', civil_engineer_id: engineers[0].id,
    start_stage: 'payment_gate', historical_confirmed_by: 'Parvez',
  });
  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText('Pawar Farmhouse').click();
  await page.getByTestId('stage-payment_gate').click();
  await expect(page.getByTestId('stage-detail-payment_gate')).toContainText('An Admin or Team Lead can record an exception');
  await expect(page.getByTestId('stage-exception-payment_gate')).toHaveCount(0);
});
