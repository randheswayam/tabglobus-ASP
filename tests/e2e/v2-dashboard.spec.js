const { test, expect, devices } = require('@playwright/test');
const { shot, signIn, api, createApprovedProject, plinthVisit, submitVisitViaApi } = require('./helpers');

const CRACK = {category: 'Structural', problem: 'Crack in beam, column or slab', other_text: null, severity: 'Critical',
  location: 'Beam B2, first floor', responsible_party: 'Structural contractor', target_date: '2026-11-15'};

test.describe.serial('dashboard: panels, filters and clearing a red flag', () => {
  test.beforeAll(async ({ request }) => {
    // Critical issue: an approved visit with a Critical problem.
    const p = await createApprovedProject(request, 'Sahyadri Residency');
    const v = await submitVisitViaApi(request, p.id, plinthVisit({'pln-beam': 'Done', 'pln-filling': 'Done', 'pln-dpc': 'In progress'}, [CRACK]));
    await api(request, 'team_lead', 'POST', `/site-visits/${v.id}/review`, {decision: 'approve'});
    // Legal delay: expected date already passed, approval not received.
    const users = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
    await api(request, 'architect', 'POST', '/projects', {name: 'Sinhagad Villa', location: 'Sinhagad Road, Pune',
      civil_engineer_id: users[0].id, legal_expected_date: '2026-09-01'});
  });

  test('architect lands on the dashboard and filters it', async ({ page }) => {
    await signIn(page, 'architect');
    await expect(page.getByTestId('dashboard-view')).toBeVisible();
    const attention = page.getByTestId('panel-attention');
    await expect(attention).toContainText('Sahyadri Residency');
    await expect(attention).toContainText('Critical issue');
    await expect(attention).toContainText('Sinhagad Villa');
    await expect(attention).toContainText('Legal delay');
    await expect(page.getByTestId('panel-major')).toContainText('Crack in beam, column or slab');
    await expect(page.getByTestId('panel-major').locator('img').first()).toHaveAttribute('src', /^blob:/);
    await expect(page.getByTestId('flag-clear-1')).toHaveCount(0);  // only Parvez can clear
    await shot(page, 'task15-01-dashboard');

    await page.getByTestId('filters').locator('summary').click();
    await page.getByTestId('fl-red_flag').selectOption('true');
    await page.getByTestId('fl-severity').selectOption('Critical');
    const table = page.getByTestId('panel-projects');
    await expect(table).toContainText('Sahyadri Residency');
    await expect(table).not.toContainText('Sinhagad Villa');
    await shot(page, 'task15-02-filtered');

    // Filters are remembered on the device.
    await page.reload();
    await expect(page.getByTestId('fl-severity')).toHaveValue('Critical');
    await expect(page.getByTestId('panel-projects')).not.toContainText('Sinhagad Villa');
    await page.getByTestId('flt-reset').click();
    await expect(page.getByTestId('panel-projects')).toContainText('Sinhagad Villa');
  });

  test('Parvez clears the Legal delay flag with a reason', async ({ page }) => {
    await signIn(page, 'team_lead');
    const row = page.getByTestId('panel-attention').locator('[data-testid^="attention-"]', {hasText: 'Sinhagad Villa'});
    const clear = row.locator('[data-testid^="flag-clear-"]');
    const id = (await clear.getAttribute('data-testid')).replace('flag-clear-', '');
    await clear.click();
    await page.getByTestId(`flag-confirm-${id}`).click();
    await expect(page.locator('#toast')).toContainText('Give a reason');
    await page.getByTestId(`flag-reason-${id}`).fill('Authority office closed for elections; follow-up booked.');
    await shot(page, 'task15-03-clear-reason');
    await page.getByTestId(`flag-confirm-${id}`).click();
    await expect(page.getByTestId('panel-attention')).not.toContainText('Sinhagad Villa');

    await page.getByTestId('panel-projects').getByText('Sinhagad Villa').click();
    await expect(page.getByTestId('audit-list')).toContainText('Red flag cleared by hand: Legal delay. Reason: Authority office closed for elections');
  });

  test('dashboard at phone width', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage();
    await signIn(page, 'architect');
    await expect(page.getByTestId('dashboard-view')).toBeVisible();
    // Every panel fits the screen; the projects table scrolls inside its own container.
    const width = page.viewportSize().width;
    for (const id of ['panel-attention', 'panel-projects', 'panel-major', 'panel-queue', 'filters']){
      const box = await page.getByTestId(id).boundingBox();
      expect(box.x + box.width, id).toBeLessThanOrEqual(width);
    }
    await shot(page, 'task15-04-dashboard-phone');
    await context.close();
  });
});
