// The workflow callout: hovering a project shows the whole flow like the diagram, coloured by state.
const { test, expect, devices } = require('@playwright/test');
const { shot, signIn, api, createApprovedProject, submitVisitViaApi, plinthVisit } = require('./helpers');

const CRACK = {category: 'Structural', problem: 'Crack in beam, column or slab', other_text: null, severity: 'Critical',
  location: 'Column C2', responsible_party: 'Contractor', target_date: '2026-12-31'};

async function atDesignFreeze(request, name){
  const engineers = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  return api(request, 'architect', 'POST', '/projects', { name, location: 'Baner, Pune', civil_engineer_id: engineers[0].id,
    start_stage: 'design_freeze_signoff', historical_confirmed_by: 'Parvez' });
}

test('hovering a dashboard row shows earlier stages green and the waiting sign-off yellow', async ({ page, request }) => {
  const p = await atDesignFreeze(request, 'Callout Residence');
  await signIn(page, 'architect');
  await page.getByTestId(`dash-row-${p.id}`).locator('td').first().hover();
  const box = page.getByTestId(`wf-callout-${p.id}`);
  await expect(box).toBeVisible();
  await expect(box.getByTestId('wfc-counts')).toContainText('15 completed');
  await expect(box.getByTestId('wfc-counts')).toContainText('1 waiting');
  await expect(box.getByTestId('wfc-stage-setup')).toHaveClass(/h-done/);
  await expect(box.getByTestId('wfc-stage-setup')).toContainText('before SiteFlow');
  const freeze = box.getByTestId('wfc-stage-design_freeze_signoff');
  await expect(freeze).toHaveClass(/h-waiting/);
  await expect(freeze).toContainText('Sign-off package not sent to the client yet');
  await expect(box.getByTestId('wfc-phase-2')).toContainText('Site workstream');
  await expect(box.getByTestId('wfc-phase-2')).toContainText('Studio workstream');
  await expect(box.getByTestId('wfc-phase-1')).toContainText('Client review and rework');
  const a = await box.getByTestId('wfc-stage-architectural_package').boundingBox();
  const b = await box.getByTestId('wfc-stage-structural_package').boundingBox();
  expect(Math.abs(a.y - b.y)).toBeLessThan(4);  // 8A and 8B side by side
  const r = await box.boundingBox();
  expect(r.x + r.width).toBeLessThanOrEqual(page.viewportSize().width);
  await shot(page, 'task29-01-callout-hover');

  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
});

test('a critical problem shows Construction quality stages red, with the reason', async ({ page, request }) => {
  const p = await createApprovedProject(request, 'Callout Crack House');
  // A visit with a Critical problem, approved by Parvez, raises the Critical issue flag.
  const v = await submitVisitViaApi(request, p.id, plinthVisit({'pln-beam': 'Done', 'pln-filling': 'Done', 'pln-dpc': 'In progress'}, [CRACK]));
  await api(request, 'team_lead', 'POST', `/site-visits/${v.id}/review`, {decision: 'approve'});
  await signIn(page, 'team_lead');
  await page.getByTestId(`dash-row-${p.id}`).locator('td').first().hover();
  const stage = page.getByTestId(`wf-callout-${p.id}`).getByTestId('wfc-stage-construction');
  await expect(stage).toHaveClass(/h-delayed/);
  await expect(stage).toContainText('Critical issue');
  await shot(page, 'task29-02-callout-delayed');
});

test('keyboard focus opens the callout on a project card', async ({ page, request }) => {
  const p = await atDesignFreeze(request, 'Callout Keyboard Villa');
  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId(`project-card-${p.id}`).focus();
  await expect(page.getByTestId(`wf-callout-${p.id}`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`wf-callout-${p.id}`)).toBeHidden();
});

test('the hover callout stays open when the pointer moves into it, and its button works', async ({ page, request }) => {
  const p = await atDesignFreeze(request, 'Callout Reach Villa');
  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId(`project-card-${p.id}`).locator('h3').hover();
  const box = page.getByTestId(`wf-callout-${p.id}`);
  await expect(box).toBeVisible();
  // Cross from the card to the callout in small steps, through the gap between them.
  const b = await box.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.waitForTimeout(500);  // longer than the close grace period
  await expect(box).toBeVisible();
  await page.mouse.wheel(0, 200);  // scrolling the flow keeps it open
  await expect(box).toBeVisible();
  await box.getByTestId(`wfc-open-${p.id}`).click();
  await expect(page.getByTestId('project-title')).toHaveText('Callout Reach Villa');
});

test('on a phone the first tap opens the callout and its button opens the project', async ({ browser, request }) => {
  const p = await atDesignFreeze(request, 'Callout Phone Villa');
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await signIn(page, 'architect');
  await page.getByTestId('tab-projects').click();
  await page.getByTestId(`project-card-${p.id}`).locator('h3').tap();
  const box = page.getByTestId(`wf-callout-${p.id}`);
  await expect(box).toBeVisible();
  await expect(page.getByTestId('project-title')).toHaveCount(0);
  const r = await box.boundingBox();
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(page.viewportSize().width);
  await shot(page, 'task29-03-phone-sheet');
  await box.getByTestId(`wfc-open-${p.id}`).tap();
  await expect(page.getByTestId('project-title')).toHaveText('Callout Phone Villa');
  await context.close();
});
