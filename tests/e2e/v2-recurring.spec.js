const { test, expect } = require('@playwright/test');
const { shot, signIn, createApprovedProject, plinthVisit, submitVisitViaApi } = require('./helpers');

const SEEPAGE = {category: 'Water', problem: 'Seepage or dampness', other_text: null, severity: 'High',
  location: 'North-east corner', responsible_party: 'Contractor', target_date: '2026-10-30'};

async function reviewAndApprove(page, name){
  await page.getByTestId('nav-queue').click();
  await page.getByTestId('queue-view').getByText(name).click();
  await page.getByTestId('review-approve').click();
  await expect(page.getByTestId('project-title')).toHaveText(name);
}

test.describe.serial('Parvez reviews photos, and each approval opens the next visit', () => {
  let pid;

  test('review screen shows each problem with its own photo and a larger view', async ({ page, request }) => {
    pid = (await createApprovedProject(request, 'Rao Bungalow')).id;
    await submitVisitViaApi(request, pid, plinthVisit({'pln-beam': 'Done', 'pln-filling': 'In progress', 'pln-dpc': 'Not started'}, [SEEPAGE]));

    await signIn(page, 'team_lead');
    await page.getByTestId('nav-queue').click();
    await page.getByTestId('queue-view').getByText('Rao Bungalow').click();
    await expect(page.getByTestId('review-media-problem-0').locator('img')).toHaveCount(1);
    await expect(page.getByTestId('review-media-site').locator('img')).toHaveCount(4);
    await expect(page.getByTestId('review-media-site').locator('img').first()).toHaveAttribute('src', /^blob:/);
    await shot(page, 'task14-01-review-with-photos');

    await page.getByTestId('review-media-problem-0').locator('button').first().click();
    await expect(page.getByTestId('lightbox')).toContainText('18.52040, 73.85670');
    await expect(page.getByTestId('lightbox')).toContainText('Problem 1');
    await shot(page, 'task14-02-photo-larger-view');
    await page.getByTestId('lightbox-close').click();
    await expect(page.getByTestId('lightbox')).toHaveCount(0);

    await page.getByTestId('review-approve').click();
    await expect(page.getByTestId('visit-number')).toHaveText('Visit 2');
    await expect(page.getByTestId('step-2')).toContainText('In progress');
    await expect(page.getByTestId('official-progress')).toContainText('16.7%');
    await expect(page.getByTestId('visit-history')).toContainText('1 approved');
  });

  test('second visit is approved and the history shows both', async ({ page, request }) => {
    await submitVisitViaApi(request, pid, plinthVisit({'pln-beam': 'Done', 'pln-filling': 'Done', 'pln-dpc': 'Done'}));
    await signIn(page, 'team_lead');
    await reviewAndApprove(page, 'Rao Bungalow');

    await expect(page.getByTestId('official-progress')).toContainText('25%');
    await expect(page.getByTestId('visit-number')).toHaveText('Visit 3');
    const history = page.getByTestId('visit-history');
    await expect(history).toContainText('2 approved');
    await expect(history).toContainText('Visit 2 · Plinth');
    await expect(history).toContainText('Visit 1 · Plinth');
    await expect(history).toContainText('16.7%');
    await expect(page.getByTestId('audit-list')).toContainText('Red flag raised: Critical issue');
    await shot(page, 'task14-03-visit-history');
  });
});
