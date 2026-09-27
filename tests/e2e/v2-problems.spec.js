const { test, expect } = require('@playwright/test');
const { shot, signIn, api, createApprovedProject, plinthVisit, submitVisitViaApi } = require('./helpers');

const HONEYCOMB = {category: 'Structural', problem: 'Honeycombing in concrete', other_text: null, severity: 'High',
  location: 'Plinth beam, south face', responsible_party: 'Site contractor', target_date: '2026-11-20'};

test('engineer resolves an open problem and its red flag clears on the dashboard', async ({ page, request }) => {
  const p = await createApprovedProject(request, 'Gadgil Row House');
  const v = await submitVisitViaApi(request, p.id, plinthVisit({'pln-beam': 'Done', 'pln-filling': 'Done', 'pln-dpc': 'Not started'}, [HONEYCOMB]));
  await api(request, 'team_lead', 'POST', `/site-visits/${v.id}/review`, {decision: 'approve'});

  await signIn(page, 'civil_engineer');
  await page.getByTestId('projects-view').getByText('Gadgil Row House').click();
  const panel = page.getByTestId('problems-panel');
  await expect(panel).toContainText('Honeycombing in concrete');
  await expect(panel).toContainText('1 open');
  await expect(panel.locator('img').first()).toHaveAttribute('src', /^blob:/);
  await shot(page, 'task18-01-open-problem');

  const item = panel.locator('[data-testid^="problem-item-"]').first();
  const id = (await item.getAttribute('data-testid')).replace('problem-item-', '');
  await page.getByTestId(`resolve-${id}`).click();
  await page.getByTestId(`resolve-confirm-${id}`).click();
  await expect(page.locator('#toast')).toContainText('Say how the problem was fixed');
  await page.getByTestId(`resolve-note-${id}`).fill('Honeycomb chipped out and repaired with micro-concrete; checked by the structural engineer.');
  await page.getByTestId(`resolve-confirm-${id}`).click();
  await expect(panel).toContainText('0 open');
  await expect(page.getByTestId('resolved-problems')).toContainText('Resolved (1)');
  await expect(page.getByTestId('audit-list')).toContainText('Problem resolved: Honeycombing in concrete');
  await expect(page.getByTestId('audit-list')).toContainText('Red flag cleared: Critical issue');
  await shot(page, 'task18-02-resolved');

  await page.locator('[data-testid="sign-out"]:visible').first().click();
  await signIn(page, 'team_lead');
  await expect(page.getByTestId('panel-attention')).not.toContainText('Gadgil Row House');
  await expect(page.getByTestId('panel-major')).not.toContainText('Honeycombing in concrete');
});
