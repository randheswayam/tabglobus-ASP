const { test, expect } = require('@playwright/test');
const { APP, EMAIL, shot, signIn, signOut } = require('./helpers');

test('sign-in rejects a wrong password and accepts the right one', async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByTestId('login-email')).toBeVisible();
  await shot(page, 'task9-01-login-page');

  await page.getByTestId('login-email').fill(EMAIL.architect);
  await page.getByTestId('login-password').fill('wrong-password');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toContainText('Incorrect email or password');
  await shot(page, 'task9-02-login-error');

  await page.getByTestId('login-password').fill('e2e-pass-123');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('signed-in-as').first()).toContainText('Meera Joshi');
  await expect(page.getByTestId('projects-view')).toBeVisible();
  await shot(page, 'task9-03-after-login');

  // Session survives a reload; sign out returns to the login screen.
  await page.reload();
  await expect(page.getByTestId('projects-view')).toBeVisible();
  await signOut(page);
});

test('architect creates a project; engineer sees it, legacy screens are gone', async ({ page }) => {
  await signIn(page, 'architect');
  await expect(page.getByTestId('nav-templates')).toHaveCount(0);
  await page.getByTestId('new-project-btn').click();
  await expect(page.getByTestId('np-engineer')).toContainText('Farhan Shaikh');
  await shot(page, 'task9-04-new-project-form');

  await page.getByTestId('np-submit').click();
  await expect(page.getByTestId('form-error')).toContainText('Project name');

  await page.getByTestId('np-name').fill('Gokhale Residence');
  await page.getByTestId('np-location').fill('Plot 14, Baner Road, Pune');
  await page.getByTestId('np-legal-date').fill('2026-11-30');
  await page.getByTestId('np-submit').click();

  await expect(page.getByTestId('project-title')).toHaveText('Gokhale Residence');
  await expect(page.getByTestId('step-1')).toContainText('Legal Approval');
  await expect(page.getByTestId('step-1')).toContainText('In progress');
  await expect(page.getByTestId('step-2')).toContainText('Locked');
  await expect(page.getByTestId('step-3')).toContainText('Locked');
  await expect(page.getByTestId('audit-list')).toContainText('Project created');
  await shot(page, 'task9-05-project-created');

  await signOut(page);
  await signIn(page, 'civil_engineer');
  await expect(page.getByTestId('projects-view')).toContainText('Gokhale Residence');
  await expect(page.getByTestId('new-project-btn')).toHaveCount(0);
});

test('admin moves Legal Approval to Approved and Site Visit unlocks', async ({ page }) => {
  await signIn(page, 'admin');
  await page.getByTestId('projects-view').getByText('Gokhale Residence').click();
  await expect(page.getByTestId('legal-form')).toBeVisible();
  await shot(page, 'task9-06-legal-form');

  await page.getByTestId('legal-status').selectOption('Applied');
  await page.getByTestId('legal-save').click();
  await expect(page.getByTestId('form-error')).toContainText('authority');

  await page.getByTestId('legal-authority').fill('Pune Municipal Corporation');
  await page.getByTestId('legal-reference').fill('PMC/BP/2026/0142');
  await page.getByTestId('legal-app-date').fill('2026-09-01');
  await page.getByTestId('legal-save').click();
  await expect(page.getByTestId('legal-summary')).toContainText('Applied');

  await page.getByTestId('legal-status').selectOption('Approved');
  await page.getByTestId('legal-approval-date').fill('2026-09-20');
  await expect(page.getByTestId('legal-save')).toBeDisabled();
  await shot(page, 'task9-07-approved-needs-document');

  await page.getByTestId('legal-document').fill('https://files.example/pmc-0142.pdf');
  await expect(page.getByTestId('legal-save')).toBeEnabled();
  await page.getByTestId('legal-save').click();

  await expect(page.getByTestId('legal-summary')).toContainText('Approved');
  await expect(page.getByTestId('step-1')).toContainText('Done');
  await expect(page.getByTestId('step-2')).toContainText('In progress');
  await expect(page.getByTestId('legal-form')).toHaveCount(0);
  await expect(page.getByTestId('audit-list')).toContainText('Legal Approval: Applied to Approved');
  await shot(page, 'task9-08-site-visit-unlocked');
});
