// The client demo build: the v1 workflow in the browser on sample data, no server.
const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');
const { shot } = require('./helpers');

const DEMO = pathToFileURL(path.join(__dirname, '..', '..', 'demo', 'SiteFlow-Demo.html')).href;

async function as(page, who){
  await page.goto(DEMO);
  await page.evaluate(() => { try { localStorage.removeItem('siteflow.demo.token'); } catch (_) {} });
  await page.goto(DEMO);
  await page.getByTestId(`demo-${who}`).click();
  await page.locator('[data-testid="signed-in-as"]:visible').first().waitFor();
}

test('demo walks the whole three-step loop on sample data', async ({ page }) => {
  await page.goto(DEMO);
  await expect(page.getByTestId('demo-accounts')).toBeVisible();
  await shot(page, 'demo-01-sign-in');

  // Architect sees all four sample projects at different stages.
  await as(page, 'architect');
  for (const name of ['Gokhale Residence', 'Patil Villa', 'Deshmukh Residence', 'Kapoor House'])
    await expect(page.getByTestId('projects-view')).toContainText(name);
  await expect(page.getByTestId('projects-view')).toContainText('45.8%');
  await shot(page, 'demo-02-projects');

  // Admin approves Legal Approval on Gokhale Residence.
  await as(page, 'admin');
  await page.getByText('Gokhale Residence').click();
  await page.getByTestId('legal-status').selectOption('Approved');
  await page.getByTestId('legal-approval-date').fill('2026-09-26');
  await page.getByTestId('legal-document').fill('PMC building permission PMC-BP-2026-0142.pdf');
  await page.getByTestId('legal-save').click();
  await expect(page.getByTestId('step-2')).toContainText('In progress');

  // Engineer records the first visit on Patil Villa.
  await as(page, 'engineer');
  await page.getByText('Patil Villa').click();
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
  await page.getByTestId('visit-submit').click();
  await expect(page.getByTestId('visit-progress')).toContainText('6.3% (pending approval)');

  // Parvez sees both waiting visits and approves Deshmukh Residence.
  await as(page, 'parvez');
  await page.getByTestId('nav-queue').click();
  await expect(page.getByTestId('queue-view')).toContainText('Patil Villa');
  await shot(page, 'demo-03-review-queue');
  await page.getByTestId('queue-view').getByText('Deshmukh Residence').click();
  await expect(page.getByTestId('review-view')).toContainText('Honeycombing in concrete');
  await shot(page, 'demo-04-review');
  await page.getByTestId('review-approve').click();
  await expect(page.getByTestId('official-progress')).toContainText('31.3%');

  // Reset puts the sample data back.
  await page.locator('[data-testid="reset-demo"]:visible').first().click();
  await page.locator('[data-testid="reset-demo"]:visible').first().click();
  await expect(page.getByTestId('projects-view')).toContainText('Deshmukh Residence');
  await page.getByTestId('nav-queue').click();
  await expect(page.getByTestId('queue-view')).toContainText('Deshmukh Residence');
});
