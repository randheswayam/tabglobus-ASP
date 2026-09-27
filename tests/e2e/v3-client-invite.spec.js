const { test, expect } = require('@playwright/test');
const { APP, shot, signIn, signOut, api } = require('./helpers');

test('architect invites the client; the client activates with the code and signs in', async ({ page, request }) => {
  const users = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  await api(request, 'architect', 'POST', '/projects', {name: 'Gokhale Farmhouse', location: 'Baner, Pune', civil_engineer_id: users[0].id});

  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText('Gokhale Farmhouse').click();
  const panel = page.getByTestId('client-panel');
  await expect(panel).toContainText('No client invited yet');
  await page.getByTestId('invite-submit').click();
  await expect(page.locator('#toast')).toContainText('name and email');
  await page.getByTestId('invite-name').fill('Mr. Gokhale');
  await page.getByTestId('invite-email').fill('gokhale@client.example');
  await page.getByTestId('invite-submit').click();
  const code = page.getByTestId('invite-code');
  await expect(code).toHaveText(/^[A-Z2-9]{8}$/);
  await expect(panel).toContainText('SiteFlow does not send it');
  await expect(panel).toContainText('Mr. Gokhale');
  await expect(panel).toContainText('Invited');
  await shot(page, 'v3-16-01-invite-code');
  const theCode = await code.textContent();
  await signOut(page);

  // The client uses the code on the sign-in screen.
  await page.goto(APP);
  await page.getByTestId('show-activate').click();
  await page.getByTestId('activate-email').fill('gokhale@client.example');
  await page.getByTestId('activate-code').fill('WRONG234');
  await page.getByTestId('activate-password').fill('courtyard-house-14');
  await page.getByTestId('activate-submit').click();
  await expect(page.getByTestId('login-error')).toContainText('not valid');
  await page.getByTestId('activate-code').fill(theCode.toLowerCase());
  await page.getByTestId('activate-password').fill('short');
  await page.getByTestId('activate-submit').click();
  await expect(page.getByTestId('login-error')).toContainText('at least 10 characters');
  await page.getByTestId('activate-password').fill('courtyard-house-14');
  await shot(page, 'v3-16-02-activate');
  await page.getByTestId('activate-submit').click();
  await expect(page.locator('[data-testid="signed-in-as"]:visible').first()).toContainText('Mr. Gokhale');
  await expect(page.getByTestId('nav-projects')).toHaveCount(0);  // no staff navigation for clients
  await shot(page, 'v3-16-03-client-signed-in');
  await signOut(page);

  // Later sign-ins use the email and new password.
  await page.getByTestId('login-email').fill('gokhale@client.example');
  await page.getByTestId('login-password').fill('courtyard-house-14');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('[data-testid="signed-in-as"]:visible').first()).toContainText('Mr. Gokhale');

  // The architect now sees the client as active.
  await signOut(page);
  await signIn(page, 'architect');
  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText('Gokhale Farmhouse').click();
  await expect(page.getByTestId('client-panel')).toContainText('Active');
});
