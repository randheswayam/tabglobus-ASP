// The client demo build: the whole workflow in the browser on sample data, no server.
const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');
const { shot, addMedia } = require('./helpers');

const DEMO = pathToFileURL(path.join(__dirname, '..', '..', 'demo', 'SiteFlow-Demo.html')).href;

async function as(page, who){
  await page.goto(DEMO);
  await page.evaluate(() => { try { localStorage.removeItem('siteflow.demo.token'); } catch (_) {} });
  await page.goto(DEMO);
  await page.getByTestId(`demo-${who}`).click();
  await page.locator('[data-testid="signed-in-as"]:visible').first().waitFor();
}

test('demo walks the whole loop on sample data: stages, client sign-off, photos, the dashboard and red flags', async ({ page }) => {
  await page.goto(DEMO);
  await expect(page.getByTestId('demo-accounts')).toBeVisible();
  await shot(page, 'demo-01-sign-in');

  // Architect lands on the dashboard: two red flags from the sample data.
  await as(page, 'architect');
  const attention = page.getByTestId('panel-attention');
  await expect(attention).toContainText('Kapoor House');
  await expect(attention).toContainText('Critical issue');
  await expect(attention).toContainText('Gokhale Residence');
  await expect(attention).toContainText('Legal delay');
  await expect(page.getByTestId('panel-major')).toContainText('Crack in beam, column or slab');
  await expect(page.getByTestId('panel-major').locator('img').first()).toHaveAttribute('src', /^data:image\/jpeg/);
  await expect(page.getByTestId('panel-projects')).toContainText('56.3%');
  await expect(page.getByTestId('panel-waiting-client')).toContainText('Gokhale Residence');
  await expect(page.getByTestId('panel-waiting-client')).toContainText('Client sign-off: design freeze');
  await shot(page, 'demo-02-dashboard');
  await page.getByTestId('panel-projects').getByText('Kapoor House').click();
  await expect(page.getByTestId('visit-history')).toContainText('2 approved');
  await expect(page.getByTestId('visit-number')).toHaveText('Visit 3');

  // Mr. Gokhale opens his project, reviews the elevations and signs off the design freeze.
  await as(page, 'gokhale');
  await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);
  await page.getByTestId('client-home').locator('[data-testid^="client-card-"]', {hasText: 'Gokhale Residence'}).click();
  await expect(page.getByTestId('client-waiting')).toContainText('All elevations, version 1');
  await page.getByTestId('client-waiting').locator('[data-testid^="client-review-"]').first().click();
  await page.getByTestId('client-signoff').waitFor();
  await expect(page.getByTestId('signoff-checklist')).toContainText('0 of 3 opened');
  const docs = page.locator('[data-testid^="signoff-open-"]');
  for (let i = 0; i < 3; i++){ await docs.nth(i).click(); await expect(page.getByTestId('signoff-viewer')).toBeVisible(); }
  await expect(page.getByTestId('signoff-checklist')).toContainText('3 of 3 opened');
  await page.getByTestId('signoff-confirm').check();
  await page.getByTestId('signoff-name').fill('Mr. Gokhale');
  await expect(page.getByTestId('signoff-approve')).toBeEnabled();
  await shot(page, 'demo-03-client-signoff');
  await page.getByTestId('signoff-approve').click();
  await expect(page.getByTestId('client-project')).toContainText('Signed by Mr. Gokhale');
  await expect(page.getByTestId('client-stage-payment_gate')).toContainText('In progress');

  // The architect sees the sign-off on the project; nothing waits for the client any more.
  await as(page, 'architect');
  await expect(page.getByTestId('panel-waiting-client')).not.toContainText('Gokhale Residence');
  await page.getByTestId('panel-projects').getByText('Gokhale Residence').click();
  await expect(page.getByTestId('stage-design_freeze_signoff')).toContainText('signed by the client');
  await expect(page.getByTestId('stage-payment_gate')).toContainText('In progress');

  // Engineer records the first visit on Patil Villa, with five photos.
  await as(page, 'engineer');
  await page.getByTestId('projects-view').getByText('Patil Villa').click();
  await page.getByTestId('visit-start').click();
  await page.getByTestId('visit-weather').fill('Clear');
  await page.getByTestId('visit-attendees').fill('Farhan Shaikh, site contractor');
  await page.getByTestId('visit-location-manual').fill('Survey No. 52, Aundh');
  await page.getByTestId('visit-stage').selectOption('Foundation');
  for (const id of ['fdn-excavation', 'fdn-pcc']) await page.getByTestId(`checklist-${id}`).selectOption('Done');
  for (const id of ['fdn-footing-rebar', 'fdn-footing-concrete']) await page.getByTestId(`checklist-${id}`).selectOption('Not started');
  await page.getByTestId('visit-no-issues').check();
  await page.getByTestId('visit-summary').fill('Excavation and PCC complete.');
  await page.getByTestId('visit-action').fill('Check footing reinforcement before the pour.');
  await expect(page.getByTestId('visit-submit')).toBeDisabled();
  for (let i = 0; i < 5; i++) await addMedia(page, 'photo-take');
  await page.getByTestId('visit-submit').click();
  await expect(page.getByTestId('visit-progress')).toContainText('6.3% (pending approval)');

  // Parvez is notified, reviews Deshmukh Residence with its photos, and approves it.
  await as(page, 'parvez');
  await expect(page.getByTestId('unread-count').first()).toBeVisible();
  await page.getByTestId('nav-queue').click();
  await expect(page.getByTestId('queue-view')).toContainText('Patil Villa');
  await shot(page, 'demo-04-review-queue');
  await page.getByTestId('queue-view').getByText('Deshmukh Residence').click();
  await expect(page.getByTestId('review-view')).toContainText('Honeycombing in concrete');
  await expect(page.getByTestId('review-media-problem-0').locator('img')).toHaveCount(1);
  await shot(page, 'demo-05-review');
  await page.getByTestId('review-approve').click();
  await expect(page.getByTestId('official-progress')).toContainText('31.3%');
  await expect(page.getByTestId('visit-number')).toHaveText('Visit 2');

  // Parvez clears the Kapoor House flag with a reason.
  await page.getByTestId('nav-dashboard').click();
  const row = page.getByTestId('panel-attention').locator('[data-testid^="attention-"]', {hasText: 'Kapoor House'});
  const clear = row.locator('[data-testid^="flag-clear-"]');
  const id = (await clear.getAttribute('data-testid')).replace('flag-clear-', '');
  await clear.click();
  await page.getByTestId(`flag-reason-${id}`).fill('Structural engineer inspected the lintel; repair booked.');
  await page.getByTestId(`flag-confirm-${id}`).click();
  await expect(page.getByTestId('panel-attention')).not.toContainText('Kapoor House');
  await shot(page, 'demo-06-flag-cleared');

  // Reset puts the sample data back.
  await page.locator('[data-testid="reset-demo"]:visible').first().click();
  await page.locator('[data-testid="reset-demo"]:visible').first().click();
  await expect(page.getByTestId('panel-attention')).toContainText('Kapoor House');
  await expect(page.getByTestId('panel-waiting-client')).toContainText('Gokhale Residence');
});
