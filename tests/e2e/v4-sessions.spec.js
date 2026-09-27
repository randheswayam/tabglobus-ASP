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
