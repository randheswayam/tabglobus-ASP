// Admin screens: the Team page (users and roles) and the members panel on a project.
const { test, expect } = require('@playwright/test');
const { shot, signIn, api } = require('./helpers');

const APP = `/index.html?api=${encodeURIComponent('http://127.0.0.1:8001')}`;

test('admin adds a structural consultant, puts them on a project, and they see it', async ({ page, request }) => {
  const engineers = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  const p = await api(request, 'architect', 'POST', '/projects',
    { name: 'Bhosale Bungalow', location: 'Wakad, Pune', civil_engineer_id: engineers[0].id });

  await signIn(page, 'admin');
  await page.getByTestId('nav-team').click();
  await expect(page.getByTestId('team-view')).toContainText('parvez@siteflow.local');
  await shot(page, 'task13-01-team');

  await page.getByTestId('add-user-name').fill('Kiran Joshi');
  await page.getByTestId('add-user-email').fill('kiran.joshi@example.com');
  await page.getByTestId('add-user-role').selectOption('structural_consultant');
  await page.getByTestId('add-user-submit').click();
  const temp = page.getByTestId('temp-password');
  await expect(temp).toBeVisible();
  const password = (await temp.textContent()).trim();
  expect(password.length).toBeGreaterThanOrEqual(12);
  await expect(page.getByTestId('team-view')).toContainText('Kiran Joshi');
  await shot(page, 'task13-02-user-added');

  await page.getByTestId('nav-projects').click();
  await page.getByTestId('projects-view').getByText('Bhosale Bungalow').click();
  const panel = page.getByTestId('members-panel');
  await expect(panel).toContainText('Meera Joshi');
  await panel.getByTestId('member-add-select').selectOption({ label: 'Kiran Joshi · Structural Consultant' });
  await panel.getByTestId('member-add').click();
  await expect(page.locator('#toast')).toContainText('Added to the project');
  // A member row (not just the drop-down option) now names Kiran, and the drop-down no longer offers them.
  await expect(panel.getByTestId(/^member-\d+$/).filter({ hasText: 'Kiran Joshi' })).toHaveCount(1);
  await expect(panel.getByTestId('member-add-select').locator('option', { hasText: 'Kiran Joshi' })).toHaveCount(0);
  await shot(page, 'task13-03-member-added');

  // The consultant signs in with the temporary password and sees the project.
  await page.locator('[data-testid="sign-out"]:visible').first().click();
  await page.goto(APP);
  await page.getByTestId('login-email').fill('kiran.joshi@example.com');
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('projects-view')).toContainText('Bhosale Bungalow');
  await shot(page, 'task13-04-consultant-sees-project');
  expect(p.id).toBeTruthy();
});

test('admin changes a role and deactivates a user; others do not see the Team page', async ({ page, request }) => {
  const created = await api(request, 'admin', 'POST', '/admin/users',
    { name: 'Temp Designer', email: 'temp.designer@example.com', role: 'interior_designer' });
  await signIn(page, 'admin');
  await page.getByTestId('nav-team').click();
  const id = created.user.id;
  await page.getByTestId(`user-role-${id}`).selectOption('mep_consultant');
  await page.getByTestId(`user-active-${id}`).uncheck();
  await page.getByTestId(`user-save-${id}`).click();
  await expect(page.locator('#toast')).toContainText('Saved');
  await expect(page.getByTestId(`user-row-${id}`)).toContainText('Inactive');
  await shot(page, 'task13-05-role-and-active');

  await signIn(page, 'architect');
  await expect(page.getByTestId('nav-team')).toHaveCount(0);
});
