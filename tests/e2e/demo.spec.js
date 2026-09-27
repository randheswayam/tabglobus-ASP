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

test('demo walks the whole loop on sample data, with photos, the dashboard and red flags', async ({ page }) => {
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
  await shot(page, 'demo-02-dashboard');
  await page.getByTestId('panel-projects').getByText('Kapoor House').click();
  await expect(page.getByTestId('visit-history')).toContainText('2 approved');
  await expect(page.getByTestId('visit-number')).toHaveText('Visit 3');

  // Admin approves the overdue Legal Approval on Gokhale Residence.
  await as(page, 'admin');
  await page.getByTestId('projects-view').getByText('Gokhale Residence').click();
  await page.getByTestId('legal-status').selectOption('Approved');
  await page.getByTestId('legal-approval-date').fill(new Date().toISOString().slice(0, 10));
  await page.getByTestId('legal-document').fill('PMC building permission PMC-BP-2026-0142.pdf');
  await page.getByTestId('legal-save').click();
  await expect(page.getByTestId('step-2')).toContainText('In progress');
  await expect(page.getByTestId('audit-list')).toContainText('Red flag cleared: Legal delay');

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
  await shot(page, 'demo-03-review-queue');
  await page.getByTestId('queue-view').getByText('Deshmukh Residence').click();
  await expect(page.getByTestId('review-view')).toContainText('Honeycombing in concrete');
  await expect(page.getByTestId('review-media-problem-0').locator('img')).toHaveCount(1);
  await shot(page, 'demo-04-review');
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
  await shot(page, 'demo-05-flag-cleared');

  // Reset puts the sample data back.
  await page.locator('[data-testid="reset-demo"]:visible').first().click();
  await page.locator('[data-testid="reset-demo"]:visible').first().click();
  await expect(page.getByTestId('panel-attention')).toContainText('Kapoor House');
});
