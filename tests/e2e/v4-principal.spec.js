// Accounts records client fees; Parvez (principal) sees them with milestones and major issues; Meera (Architect)
// sees no overview and the API refuses her.
const { test, expect } = require('@playwright/test');
const { API, shot, signIn, signOut, api, apiToken, createApprovedProject, plinthVisit, submitVisitViaApi } = require('./helpers');

const CRACK = {category: 'Structural', problem: 'Honeycombing in concrete', other_text: null, severity: 'Critical',
  location: 'Plinth beam, north face', responsible_party: 'Site contractor', target_date: '2026-11-20'};

test('accounts records fees; the principal sees totals, milestones and major issues; the architect does not', async ({ page, request }) => {
  const p = await createApprovedProject(request, 'Principal Villa');
  const users = await api(request, 'admin', 'GET', '/admin/users');
  const accounts = users.find(u => u.role === 'accounts');
  await api(request, 'admin', 'POST', `/projects/${p.id}/members/${accounts.id}`);
  const body = {...plinthVisit({'pln-beam': 'Done', 'pln-filling': 'Done', 'pln-dpc': 'Not started'}, [CRACK]),
    recommended_action: 'Hack out and re-pour the north face before backfilling.'};
  const v = await submitVisitViaApi(request, p.id, body);
  await api(request, 'team_lead', 'POST', `/site-visits/${v.id}/review`, {decision: 'approve'});

  // Accounts: the Fees tab, no overview.
  await signIn(page, 'accounts');
  await page.locator('[data-testid="nav-fees"]:visible, [data-testid="tab-fees"]:visible').first().click();
  await expect(page.getByTestId('fees-view')).toBeVisible();
  await page.getByTestId('fees-project').selectOption(String(p.id));
  await expect(page.getByTestId('fees-totals')).toBeVisible();
  await page.getByTestId('fee-kind').selectOption('due');
  await page.getByTestId('fee-amount').fill('1250000');
  await page.getByTestId('fee-date').fill('2026-09-01');
  await page.getByTestId('fee-note').fill('50% upfront, invoice 12');
  await page.getByTestId('fee-submit').click();
  await expect(page.getByTestId('fees-entries')).toContainText('₹12,50,000');
  await page.getByTestId('fee-kind').selectOption('received');
  await page.getByTestId('fee-amount').fill('500000');
  await page.getByTestId('fee-date').fill('2026-09-10');
  await page.getByTestId('fee-reference').fill('NEFT 4471');
  await page.getByTestId('fee-submit').click();
  await expect(page.getByTestId('fees-totals')).toContainText('₹7,50,000');
  await shot(page, 'task35-01-accounts-fees');
  await expect(page.getByTestId('principal-overview')).toHaveCount(0);
  await signOut(page);

  // Parvez: the overview opens the dashboard.
  await signIn(page, 'team_lead');
  const po = page.getByTestId('principal-overview');
  await expect(po).toBeVisible();
  await expect(page.getByTestId('po-received')).toContainText('₹5,00,000');
  const row = page.getByTestId(`po-row-${p.id}`);
  await expect(row).toContainText('Principal Villa');
  await expect(row).toContainText('₹12,50,000');
  await expect(row.getByTestId(`po-issues-${p.id}`)).toContainText('1');
  await shot(page, 'task35-02-principal-overview');
  await row.getByTestId(`po-toggle-${p.id}`).click();
  const detail = page.getByTestId(`po-detail-${p.id}`);
  await expect(detail).toContainText('Client sign-off');
  await expect(detail).toContainText('Completed before SiteFlow');
  await expect(detail).toContainText('Hack out and re-pour the north face');
  await expect(detail).toContainText('Critical');
  await expect(detail).toContainText('Site contractor');
  await shot(page, 'task35-03-principal-detail');
  await signOut(page);

  // Meera: no section, and the API refuses her.
  const calls = [];
  page.on('request', r => { if (r.url().includes('/principal/overview')) calls.push(r.url()); });
  await signIn(page, 'architect');
  await expect(page.getByTestId('dashboard-view')).toBeVisible();
  await expect(page.getByTestId('principal-overview')).toHaveCount(0);
  expect(calls).toHaveLength(0);
  const token = await apiToken(request, 'architect');
  const r = await request.get(`${API}/principal/overview`, {headers: {Authorization: `Bearer ${token}`}});
  expect(r.status()).toBe(403);
  await shot(page, 'task35-04-architect-no-overview');
});
