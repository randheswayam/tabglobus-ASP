const { test, expect } = require('@playwright/test');
const { shot, signIn, signOut, createApprovedProject, addMedia } = require('./helpers');

const NAME = 'Patil Villa';

async function openProject(page){
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText(NAME).click();
  await expect(page.getByTestId('project-title')).toHaveText(NAME);
}

test.describe.serial('site visit and Team Lead review', () => {
  test('engineer fills the mandatory form, the draft survives a reload, and submits', async ({ page, request }) => {
    await createApprovedProject(request, NAME);
    await signIn(page, 'civil_engineer');
    await openProject(page);
    await page.getByTestId('visit-start').click();

    await expect(page.getByTestId('visit-submit')).toBeDisabled();
    await expect(page.getByTestId('visit-missing')).toContainText('Weather');
    await expect(page.getByTestId('visit-missing')).toContainText('Construction stage');
    await shot(page, 'task10-01-empty-form-blocked');

    await page.getByTestId('visit-weather').fill('Clear, 29°C');
    await page.getByTestId('visit-attendees').fill('Farhan Shaikh, site contractor');
    await page.getByTestId('visit-stage').selectOption('Plinth');
    await expect(page.getByTestId('visit-missing')).toContainText('Checklist: Plinth beam cast');

    // Close and reopen: the draft is restored from the device.
    await page.reload();
    await openProject(page);
    await page.getByTestId('visit-start').click();
    await expect(page.getByTestId('visit-weather')).toHaveValue('Clear, 29°C');
    await expect(page.getByTestId('visit-stage')).toHaveValue('Plinth');
    await shot(page, 'task10-02-draft-restored');

    await page.getByTestId('visit-location-manual').fill('Plot 7, Aundh');
    await page.getByTestId('checklist-pln-beam').selectOption('Done');
    await page.getByTestId('checklist-pln-filling').selectOption('In progress');
    await page.getByTestId('checklist-pln-dpc').selectOption('Not started');

    await page.getByTestId('visit-add-problem').click();
    await page.getByTestId('problem-0-category').selectOption('Water');
    await page.getByTestId('problem-0-problem').selectOption('Seepage or dampness');
    await page.getByTestId('problem-0-severity').selectOption('High');
    await page.getByTestId('problem-0-location').fill('North-east corner');
    await page.getByTestId('problem-0-party').fill('Contractor');
    await page.getByTestId('problem-0-date').fill('2026-10-05');
    await page.getByTestId('visit-summary').fill('Plinth beam cast, filling under way.');
    await expect(page.getByTestId('visit-submit')).toBeDisabled();
    await page.getByTestId('visit-action').fill('Fix seepage before DPC.');
    // v2: five photos, one of them of the High problem.
    for (let i = 0; i < 4; i++) await addMedia(page, 'photo-take');
    await addMedia(page, 'problem-0-photo');

    await expect(page.getByTestId('visit-submit')).toBeEnabled();
    await shot(page, 'task10-03-form-complete');
    await page.getByTestId('visit-submit').click();

    await expect(page.getByTestId('project-title')).toHaveText(NAME);
    await expect(page.getByTestId('visit-progress')).toContainText('16.7% (pending approval)');
    await expect(page.getByTestId('step-3')).toContainText('In progress');
    await expect(page.getByTestId('official-progress')).toContainText('0%');
    await expect(page.getByTestId('visit-start')).toHaveCount(0);
    await shot(page, 'task10-04-submitted-pending');
  });

  test('Parvez sends it back, the engineer resubmits, Parvez approves', async ({ page }) => {
    await signIn(page, 'team_lead');
    await page.getByTestId('nav-queue').click();
    const item = page.getByTestId('queue-view').getByText(NAME);
    await expect(item).toBeVisible();
    await shot(page, 'task10-05-review-queue');
    await item.click();

    await expect(page.getByTestId('review-view')).toContainText('Seepage or dampness');
    await expect(page.getByTestId('review-view')).toContainText('Plinth beam cast');
    await page.getByTestId('review-rework').click();
    await expect(page.getByTestId('form-error')).toContainText('comment');
    await page.getByTestId('review-comment').fill('Plinth filling needs compaction test results.');
    await shot(page, 'task10-06-rework-comment');
    await page.getByTestId('review-rework').click();
    await expect(page.getByTestId('step-2')).toContainText('In progress');
    await signOut(page);

    await signIn(page, 'civil_engineer');
    await openProject(page);
    await expect(page.getByTestId('rework-comment')).toContainText('compaction test results');
    await page.getByTestId('visit-start').click();
    await expect(page.getByTestId('rework-banner')).toContainText('compaction test results');
    await expect(page.getByTestId('visit-weather')).toHaveValue('Clear, 29°C');  // prefilled from the last submission
    await page.getByTestId('checklist-pln-filling').selectOption('Done');
    await shot(page, 'task10-07-resubmit');
    await page.getByTestId('visit-submit').click();
    await expect(page.getByTestId('visit-progress')).toContainText('20.8% (pending approval)');
    await signOut(page);

    await signIn(page, 'team_lead');
    await page.getByTestId('nav-queue').click();
    await page.getByTestId('queue-view').getByText(NAME).click();
    await expect(page.getByTestId('review-submission')).toContainText('Submission 2');
    await page.getByTestId('review-approve').click();
    await expect(page.getByTestId('official-progress')).toContainText('20.8%');
    // Recurring visits: approval reopens Site Visit for the next visit.
    await expect(page.getByTestId('step-2')).toContainText('In progress');
    await expect(page.getByTestId('step-3')).toContainText('Locked');
    await expect(page.getByTestId('audit-list')).toContainText('progress 20.8% is official');
    await shot(page, 'task10-08-approved-official');
  });
});
