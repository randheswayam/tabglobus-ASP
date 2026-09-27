const { test, expect } = require('@playwright/test');
const { MP4, shot, signIn, createApprovedProject, addMedia, mediaTiles, makePng } = require('./helpers');

test('engineer captures photos and video; a High problem needs its own photo', async ({ page, request }) => {
  await createApprovedProject(request, 'Joshi Duplex');
  await signIn(page, 'civil_engineer');
  await page.getByTestId('projects-view').getByText('Joshi Duplex').click();
  await page.getByTestId('visit-start').click();

  await expect(page.getByTestId('photo-count')).toHaveText('0 / 5 min');
  await expect(page.getByTestId('visit-missing')).toContainText('Photos: at least 5 (0 added)');
  await shot(page, 'task13-01-no-photos');

  await page.getByTestId('visit-weather').fill('Clear');
  await page.getByTestId('visit-attendees').fill('Farhan Shaikh, contractor');
  await page.getByTestId('visit-location-manual').fill('Plot 3, Pashan');
  await page.getByTestId('visit-stage').selectOption('Plinth');
  await page.getByTestId('checklist-pln-beam').selectOption('Done');
  await page.getByTestId('checklist-pln-filling').selectOption('Done');
  await page.getByTestId('checklist-pln-dpc').selectOption('In progress');
  await page.getByTestId('visit-add-problem').click();
  await page.getByTestId('problem-0-category').selectOption('Water');
  await page.getByTestId('problem-0-problem').selectOption('Seepage or dampness');
  await page.getByTestId('problem-0-severity').selectOption('High');
  await page.getByTestId('problem-0-location').fill('North wall');
  await page.getByTestId('problem-0-party').fill('Contractor');
  await page.getByTestId('problem-0-date').fill('2026-10-10');
  await page.getByTestId('visit-summary').fill('Plinth nearly complete.');
  await page.getByTestId('visit-action').fill('Waterproof the north wall before DPC.');

  // Five general photos, then remove one again.
  for (let i = 0; i < 3; i++) await addMedia(page, 'photo-take');
  for (let i = 0; i < 2; i++) await addMedia(page, 'photo-upload', {name: `upload-${i}.png`, mimeType: 'image/png', buffer: makePng(96, 72, i + 3)});
  await expect(page.getByTestId('photo-count')).toHaveText('5 / 5 min');
  const first = mediaTiles(page).first();
  const id = (await first.getAttribute('data-testid')).replace('media-', '');
  await page.getByTestId(`media-remove-${id}`).click();
  await expect(page.getByTestId('photo-count')).toHaveText('4 / 5 min');

  // An optional video does not count toward the photo minimum.
  await addMedia(page, 'video-add', {name: 'walkthrough.mp4', mimeType: 'video/mp4', buffer: MP4});
  await expect(page.getByTestId('photo-count')).toHaveText('4 / 5 min');

  // A file that is not a supported photo is refused before upload.
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('photo-upload').click()]);
  await chooser.setFiles({name: 'plan.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a')});
  await expect(page.locator('#toast')).toContainText('not a supported photo');

  await expect(page.getByTestId('visit-missing')).toContainText('Problem 1: photo of the problem');
  await expect(page.getByTestId('visit-submit')).toBeDisabled();
  await shot(page, 'task13-02-high-problem-needs-photo');

  await addMedia(page, 'problem-0-photo');
  await expect(page.getByTestId('photo-count')).toHaveText('5 / 5 min');
  await expect(page.getByTestId('visit-submit')).toBeEnabled();
  await shot(page, 'task13-03-ready-with-photos');

  await page.getByTestId('visit-submit').click();
  await expect(page.getByTestId('visit-progress')).toContainText('pending approval');
});
