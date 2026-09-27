const { test, expect } = require('@playwright/test');
const { shot, signIn, createApprovedProject, plinthVisit, submitVisitViaApi } = require('./helpers');

test('Parvez is notified of a submission and opens it from the notification', async ({ page, request }) => {
  const p = await createApprovedProject(request, 'Bhosale Farmhouse');
  await submitVisitViaApi(request, p.id, plinthVisit({'pln-beam': 'Done', 'pln-filling': 'Not started', 'pln-dpc': 'Not started'}));

  await signIn(page, 'team_lead');
  await expect(page.getByTestId('unread-count').first()).toBeVisible();
  await page.getByTestId('nav-alerts').click();
  const note = page.getByTestId('alerts-view').locator('[data-testid^="note-"]', {hasText: 'Bhosale Farmhouse'});
  await expect(note).toContainText('Farhan Shaikh submitted a site visit on Bhosale Farmhouse for review.');
  await expect(note).toContainText('New');
  await shot(page, 'task17-01-notifications');

  await note.click();
  await expect(page.getByTestId('project-title')).toHaveText('Bhosale Farmhouse');
  await page.getByTestId('nav-alerts').click();
  await expect(page.getByTestId('alerts-view').locator('[data-testid^="note-"]', {hasText: 'Bhosale Farmhouse'})).not.toContainText('New');

  if (await page.getByTestId('read-all').count()) await page.getByTestId('read-all').click();
  await expect(page.getByTestId('alerts-view')).toContainText('All caught up');
  await expect(page.getByTestId('unread-count')).toHaveCount(0);
});
