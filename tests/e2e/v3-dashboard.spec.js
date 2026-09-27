const { test, expect } = require('@playwright/test');
const { API, PDF, shot, signIn, api } = require('./helpers');

test('dashboard shows phase, client and projects waiting for the client', async ({ page, request }) => {
  const users = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  const p = await api(request, 'architect', 'POST', '/projects', {name: 'Oak Row Villa', location: 'Baner, Pune',
    civil_engineer_id: users[0].id, start_stage: 'design_freeze_signoff', historical_confirmed_by: 'Parvez'});
  await api(request, 'architect', 'POST', `/projects/${p.id}/client-invite`, {name: 'Mr. Oak', email: 'oak@client.example'});
  const so = await api(request, 'architect', 'POST', `/projects/${p.id}/signoffs`, {stage_key: 'design_freeze_signoff',
    title: 'All elevations, version 1', summary: 'Front, rear and sides.'});
  const token = (await (await request.post(`${API}/auth/login`, {data: {email: 'architect@siteflow.local', password: 'e2e-pass-123'}})).json()).access_token;
  await request.post(`${API}/signoffs/${so.id}/attachments`, {headers: {Authorization: `Bearer ${token}`},
    multipart: {file: {name: 'Elevations.pdf', mimeType: 'application/pdf', buffer: PDF}}});
  await api(request, 'architect', 'POST', `/signoffs/${so.id}/send`);

  await signIn(page, 'team_lead');
  const waiting = page.getByTestId('panel-waiting-client');
  await expect(waiting).toContainText('Oak Row Villa');
  await expect(waiting).toContainText('Client sign-off: design freeze');
  await expect(waiting).toContainText('version 1');
  const row = page.getByTestId(`dash-row-${p.id}`);
  await expect(row).toContainText('Phase 5');
  await expect(row).toContainText('Client sign-off: design freeze');
  await expect(row).toContainText('Mr. Oak');
  await expect(row).toContainText('Waiting for client');
  await shot(page, 'v3-20-01-dashboard');

  await page.getByTestId('filters').locator('summary').click();
  await page.getByTestId('fl-client_pending').selectOption('true');
  await expect(page.getByTestId('panel-projects')).toContainText('Oak Row Villa');
  await expect(page.getByTestId('panel-projects')).not.toContainText('Sahyadri Residency');
  await page.getByTestId('fl-client_pending').selectOption('');
  await page.getByTestId('fl-phase').selectOption('5');
  await expect(page.getByTestId('panel-projects')).toContainText('Oak Row Villa');
  await shot(page, 'v3-20-02-filtered');
  await page.getByTestId('flt-reset').click();
});
