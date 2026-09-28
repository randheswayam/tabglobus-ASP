// Completing a stage with files: photo, AutoCAD drawing and PDF; remove one; mark complete; files stay on the stage.
const { test, expect, devices } = require('@playwright/test');
const { shot, signIn, api, makePng } = require('./helpers');

const DWG = Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(256)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function onboarded(request, name){
  const engineers = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  return api(request, 'architect', 'POST', '/projects', { name, location: 'Pashan, Pune', civil_engineer_id: engineers[0].id,
    start_stage: 'predesign_site_visit', historical_confirmed_by: 'Parvez' });
}

async function attach(page, testid, file){
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId(testid).click()]);
  await chooser.setFiles(file);
}

async function openProject(page, name){
  await page.getByTestId('projects-view').getByText(name).click();
  await page.getByTestId('stage-predesign_site_visit').click();
}

test('engineer attaches a photo, a DWG and a PDF, removes one, and completes the site visit stage', async ({ page, request }) => {
  await onboarded(request, 'Files Villa');
  await signIn(page, 'civil_engineer');
  await openProject(page, 'Files Villa');
  const files = page.getByTestId('stage-files-predesign_site_visit');
  await shot(page, 'task25-01-empty');
  await expect(page.getByTestId('stage-prd-predesign_site_visit')).toHaveText('PRD stage 3');  // Task 40

  await attach(page, 'stage-attach-photo-predesign_site_visit', { name: 'well-near-gate.png', mimeType: 'image/png', buffer: makePng() });
  await expect(files).toContainText('well-near-gate.png');
  await expect(files.locator('img[data-sfid]')).toHaveAttribute('src', /^blob:/);
  await attach(page, 'stage-attach-file-predesign_site_visit', { name: 'centerline.dwg', mimeType: 'application/octet-stream', buffer: DWG });
  await expect(files).toContainText('centerline.dwg');
  await expect(files).toContainText('AutoCAD drawing');
  await attach(page, 'stage-attach-file-predesign_site_visit', { name: 'soil-note.pdf', mimeType: 'application/pdf', buffer: PDF });
  await expect(files).toContainText('soil-note.pdf');
  await shot(page, 'task25-02-three-files');

  const pdfRow = files.getByTestId(/^stage-file-\d+$/).filter({ hasText: 'soil-note.pdf' });
  await pdfRow.getByTestId(/^stage-file-remove-\d+$/).click();
  await expect(files).not.toContainText('soil-note.pdf');

  await page.getByTestId('stage-note-predesign_site_visit').fill('Site visited. Well near the gate; black cotton soil on the east side.');
  await page.getByTestId('stage-complete-predesign_site_visit').click();
  await expect(page.getByTestId('stage-predesign_site_visit')).toContainText('Done');
  // The stage detail stays open after completing.
  const done = page.getByTestId('stage-files-predesign_site_visit');
  await expect(done).toContainText('well-near-gate.png');
  await expect(done).toContainText('centerline.dwg');
  await expect(done.getByTestId(/^stage-file-remove-\d+$/)).toHaveCount(0);
  await expect(page.getByTestId('stage-file-count-predesign_site_visit')).toHaveText('2 files');
  await expect(page.getByTestId('stage-detail-predesign_site_visit')).toContainText('Well near the gate');
  await expect(page.getByTestId('audit-list')).toContainText('Stage completed: Pre-design site visit');
  await expect(page.getByTestId('stage-attach-photo-predesign_site_visit')).toHaveCount(0);
  await shot(page, 'task25-03-completed-with-files');
});

test('stage files on a phone', async ({ browser, request }) => {
  await onboarded(request, 'Phone Files Villa');
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await signIn(page, 'civil_engineer');
  await openProject(page, 'Phone Files Villa');
  await attach(page, 'stage-attach-photo-predesign_site_visit', { name: 'site.png', mimeType: 'image/png', buffer: makePng() });
  const files = page.getByTestId('stage-files-predesign_site_visit');
  await expect(files).toContainText('site.png');
  const box = await files.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  await shot(page, 'task25-04-phone');
  await context.close();
});
