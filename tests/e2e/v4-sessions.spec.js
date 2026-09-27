// Sessions in the browser: an expired or broken access token is renewed silently with the refresh token.
const { test, expect } = require('@playwright/test');
const { shot, signIn } = require('./helpers');

test('a broken access token is renewed through the refresh token without signing the user out', async ({ page }) => {
  await signIn(page, 'architect');
  const before = await page.evaluate(() => ({ t: localStorage.getItem('siteflow.token'), r: localStorage.getItem('siteflow.refresh') }));
  expect(before.r).toBeTruthy();
  await shot(page, 'task9-01-signed-in');

  // Simulate an expired access token: the server rejects it with 401.
  await page.evaluate(() => localStorage.setItem('siteflow.token', 'expired.access.token'));
  await page.getByTestId('nav-projects').click();
  await expect(page.getByTestId('projects-view')).toBeVisible();
  await expect(page.getByTestId('login-email')).toHaveCount(0);

  const after = await page.evaluate(() => ({ t: localStorage.getItem('siteflow.token'), r: localStorage.getItem('siteflow.refresh') }));
  expect(after.t).not.toBe('expired.access.token');
  expect(after.r).not.toBe(before.r);  // the refresh token rotated
  await shot(page, 'task9-02-renewed');
});

test('when the refresh token is also invalid, the user is sent to sign in', async ({ page }) => {
  await signIn(page, 'architect');
  await page.evaluate(() => {
    localStorage.setItem('siteflow.token', 'expired.access.token');
    localStorage.setItem('siteflow.refresh', 'not-a-refresh-token');
  });
  await page.getByTestId('nav-projects').click();
  await expect(page.getByTestId('login-email')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('siteflow.refresh'))).toBeNull();
  await shot(page, 'task9-03-signed-out');
});

test('sign out on all devices ends the session on the other device too', async ({ browser }) => {
  const phone = await browser.newContext(), laptop = await browser.newContext();
  const a = await phone.newPage(), b = await laptop.newPage();
  await signIn(a, 'architect');
  await signIn(b, 'architect');
  await shot(b, 'task10-01-laptop-signed-in');

  await a.getByTestId('signout-all').click();
  await expect(a.getByTestId('login-email')).toBeVisible();
  await expect(a.getByTestId('login-error')).toContainText('signed out on all your devices');
  await shot(a, 'task10-02-signed-out-everywhere');

  // The laptop's next action finds its session ended, even after trying its refresh token.
  await b.getByTestId('nav-projects').click();
  await expect(b.getByTestId('login-email')).toBeVisible();
  await shot(b, 'task10-03-laptop-sent-to-sign-in');
  await phone.close(); await laptop.close();
});

test('plain sign out ends only this device', async ({ browser }) => {
  const one = await browser.newContext(), two = await browser.newContext();
  const a = await one.newPage(), b = await two.newPage();
  await signIn(a, 'team_lead');
  await signIn(b, 'team_lead');
  await a.locator('[data-testid="sign-out"]:visible').first().click();
  await expect(a.getByTestId('login-email')).toBeVisible();
  await b.getByTestId('nav-projects').click();
  await expect(b.getByTestId('projects-view')).toBeVisible();
  await one.close(); await two.close();
});
