// Progress as phase icons: coloured by health, labelled for screen readers, with a tooltip per phase.
const { test, expect, devices } = require('@playwright/test');
const { shot, signIn, api } = require('./helpers');

async function atDesignFreeze(request, name){
  const engineers = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  return api(request, 'architect', 'POST', '/projects', { name, location: 'Baner, Pune', civil_engineer_id: engineers[0].id,
    start_stage: 'design_freeze_signoff', historical_confirmed_by: 'Parvez' });
}

test('project card shows four green phases, a yellow phase 5, and a tooltip of its stages', async ({ page, request }) => {
  const p = await atDesignFreeze(request, 'Icon Residence');
  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  for (const n of [1, 2, 3, 4]) await expect(page.getByTestId(`phase-icon-${p.id}-${n}`)).toHaveClass(/h-done/);
  const five = page.getByTestId(`phase-icon-${p.id}-5`);
  await expect(five).toHaveClass(/h-waiting/);
  await expect(five).toHaveAttribute('aria-label', 'Phase 5, Client approval and commercial gate: waiting');
  await expect(page.getByTestId(`phase-icon-${p.id}-6`)).toHaveClass(/h-upcoming/);
  await five.hover();
  const tip = five.locator('.ptip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Client sign-off: design freeze');
  await expect(tip).toContainText('Sign-off package not sent to the client yet');
  await shot(page, 'task28-01-card-icons');

  // Keyboard: the icon takes focus and shows its tooltip; the card still opens with Enter.
  await page.mouse.move(0, 0);
  await five.focus();
  await expect(tip).toBeVisible();
  await page.getByTestId(`project-card-${p.id}`).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('project-title')).toHaveText('Icon Residence');
});

test('dashboard stage column shows the icons too', async ({ page, request }) => {
  const p = await atDesignFreeze(request, 'Icon Dashboard Villa');
  await signIn(page, 'architect');
  await expect(page.getByTestId(`phase-strip-${p.id}`)).toBeVisible();
  await expect(page.getByTestId(`phase-icon-${p.id}-5`)).toHaveClass(/h-waiting/);
  await shot(page, 'task28-02-dashboard-icons');
});

test('phase icons on a phone: a tap opens a full-screen sheet with a close button and project details', async ({ browser, request }) => {
  const p = await atDesignFreeze(request, 'Icon Phone Villa');
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await signIn(page, 'architect');
  await page.getByTestId('tab-projects').click();
  const strip = await page.getByTestId(`phase-strip-${p.id}`).boundingBox();
  expect(strip.x + strip.width).toBeLessThanOrEqual(page.viewportSize().width);
  const five = page.getByTestId(`phase-icon-${p.id}-5`);
  await five.tap();
  const sheet = page.getByTestId(`phase-sheet-${p.id}-5`);
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('project-title')).toHaveCount(0);
  await expect(sheet).toContainText('Icon Phone Villa');
  await expect(sheet).toContainText('Phase 5 · Client approval and commercial gate');
  await expect(sheet).toContainText('Client sign-off: design freeze');
  const box = await sheet.boundingBox(), vp = page.viewportSize();
  expect(box.width).toBe(vp.width);  // fills the screen
  expect(box.height).toBe(vp.height);
  await shot(page, 'task28-03-phone-tap');

  await sheet.getByTestId('phase-sheet-close').tap();
  await expect(sheet).toBeHidden();
  await five.tap();
  await expect(sheet).toBeVisible();
  await sheet.getByTestId('phase-sheet-details').tap();
  await expect(page.getByTestId('project-title')).toHaveText('Icon Phone Villa');
  await expect(sheet).toBeHidden();
  await context.close();
});
