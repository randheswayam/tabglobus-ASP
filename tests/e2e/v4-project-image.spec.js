// The project image (a render of the 3D model) beside the name: project page, Projects card and dashboard row.
const { test, expect } = require('@playwright/test');
const { shot, signIn, api, makePng } = require('./helpers');

test('architect adds a 3D view image and sees it on the card and the dashboard row', async ({ page, request }) => {
  const engineers = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  const p = await api(request, 'architect', 'POST', '/projects', { name: 'Render Villa', location: 'Aundh, Pune', civil_engineer_id: engineers[0].id });

  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  const thumb = page.getByTestId(`project-thumb-${p.id}`);
  await expect(thumb).toHaveClass(/none/);  // no image yet: the phase icon tile
  await shot(page, 'task31-01-no-image');

  await page.getByTestId(`project-card-${p.id}`).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('project-image-upload').click()]);
  await chooser.setFiles({ name: 'render.png', mimeType: 'image/png', buffer: makePng(320, 180, 3) });
  await expect(page.locator('#toast')).toContainText('Project image saved');
  await expect(page.getByTestId(`project-thumb-${p.id}`).locator('img')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByTestId(`project-thumb-${p.id}`).locator('img')).toHaveAttribute('alt', 'Render Villa — 3D view');
  await expect(page.getByTestId('project-image-upload')).toContainText('Replace project image');
  await shot(page, 'task31-02-project-header');

  await page.getByTestId('nav-projects').click();
  await expect(page.getByTestId(`project-thumb-${p.id}`).locator('img')).toHaveAttribute('src', /^blob:/);
  await shot(page, 'task31-03-card');
  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByTestId(`dash-row-${p.id}`).getByTestId(`project-thumb-${p.id}`).locator('img')).toHaveAttribute('src', /^blob:/);
  await shot(page, 'task31-04-dashboard');
});
