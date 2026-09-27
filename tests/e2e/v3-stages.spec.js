const { test, expect, devices } = require('@playwright/test');
const { shot, signIn, api } = require('./helpers');

async function newProject(request, name, extra = {}){
  const users = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  return api(request, 'architect', 'POST', '/projects', {name, location: 'Pashan, Pune', civil_engineer_id: users[0].id, ...extra});
}

test('architect works through the first stages; the client sign-off stage waits for the client', async ({ page, request }) => {
  const p = await newProject(request, 'Kulkarni Residence');
  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText('Kulkarni Residence').click();

  const tracker = page.getByTestId('stage-tracker');
  await expect(tracker).toContainText('Initiation and requirements');
  await expect(tracker).toContainText('Handover');
  await expect(page.getByTestId('stage-setup')).toContainText('In progress');
  await expect(page.getByTestId('stage-discovery')).toContainText('Locked');
  await expect(page.getByTestId('project-phase')).toHaveText('Phase 1 · Initiation and requirements');
  await shot(page, 'v3-15-01-tracker');

  for (const key of ['setup', 'discovery', 'baseline']){
    await page.getByTestId(`stage-${key}`).click();
    await page.getByTestId(`stage-complete-${key}`).click();
    await expect(page.locator('#toast')).toContainText('Add a note');
    await page.getByTestId(`stage-note-${key}`).fill(`${key} done and checked with the client.`);
    await page.getByTestId(`stage-complete-${key}`).click();
    await expect(page.getByTestId(`stage-${key}`)).toContainText('Done');
  }
  await page.getByTestId('stage-requirements_signoff').click();
  const signoff = page.getByTestId('stage-detail-requirements_signoff');
  await expect(signoff).toContainText('Sign-off package not sent to the client yet');
  await expect(page.getByTestId('stage-complete-requirements_signoff')).toHaveCount(0);
  await expect(page.getByTestId('stage-discovery')).toContainText('Done');
  await expect(page.getByTestId('audit-list')).toContainText('Stage completed: Client discovery meetings');
  await shot(page, 'v3-15-02-waiting-for-client');
});

test('onboarded project shows historical stages and the parallel branches side by side', async ({ page, request }) => {
  await newProject(request, 'Deshpande Villa', {start_stage: 'architectural_package', historical_confirmed_by: 'Parvez'});
  await signIn(page, 'team_lead');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText('Deshpande Villa').click();
  await expect(page.getByTestId('stage-grid_freeze')).toContainText('Historical');
  await expect(page.getByTestId('stage-architectural_package')).toContainText('In progress');
  await expect(page.getByTestId('stage-structural_package')).toContainText('In progress');
  const a = await page.getByTestId('stage-architectural_package').boundingBox();
  const b = await page.getByTestId('stage-structural_package').boundingBox();
  expect(Math.abs(a.y - b.y)).toBeLessThan(4);  // 8A and 8B on one row
  await page.getByTestId('stage-grid_freeze').click();
  await expect(page.getByTestId('stage-detail-grid_freeze')).toContainText('Historical — completed before SiteFlow');
  await expect(page.getByTestId('stage-detail-grid_freeze')).toContainText('Parvez');
  await shot(page, 'v3-15-03-historical-and-parallel');
});

test('stage tracker fits a phone screen', async ({ browser, request }) => {
  await newProject(request, 'Joglekar House', {start_stage: 'predesign_site_visit', historical_confirmed_by: 'Parvez'});
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await signIn(page, 'civil_engineer');
  await page.getByTestId('projects-view').getByText('Joglekar House').click();
  const tracker = page.getByTestId('stage-tracker');
  await expect(tracker).toBeVisible();
  const box = await tracker.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  await expect(page.getByTestId('stage-predesign_site_visit')).toContainText('In progress');
  await shot(page, 'v3-15-04-tracker-phone');
  await context.close();
});

test('architect onboards an in-progress project at detailed drawings from the New project form', async ({ page }) => {
  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('new-project-btn').click();
  await page.getByTestId('np-name').fill('Ranade Villa');
  await page.getByTestId('np-location').fill('Bavdhan, Pune');
  await page.getByTestId('np-in-progress').click();
  await page.getByTestId('np-start').selectOption('detailed_drawings');
  await page.getByTestId('np-submit').click();
  await expect(page.getByTestId('form-error')).toContainText('Who confirmed');
  await page.getByTestId('np-confirmer').fill('Parvez');
  await shot(page, 'v3-22-01-onboarding-form');
  await page.getByTestId('np-submit').click();
  await expect(page.getByTestId('project-title')).toHaveText('Ranade Villa');
  await expect(page.getByTestId('stage-detailed_drawings')).toContainText('In progress');
  await expect(page.getByTestId('stage-design_freeze_signoff')).toContainText('Historical');
  await expect(page.getByTestId('stage-design_freeze_signoff')).not.toContainText('signed by the client');
  await expect(page.getByTestId('audit-list')).toContainText('onboarded mid-way (earlier stages confirmed by Parvez)');
  await shot(page, 'v3-22-02-onboarded');
});
