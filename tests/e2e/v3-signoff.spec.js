const { test, expect } = require('@playwright/test');
const { API, PDF, shot, signIn, api, makePng } = require('./helpers');

const CLIENT = {name: 'Ms. Kale', email: 'kale@client.example', password: 'kale-house-2026'};

test.describe.serial('client sign-off at a milestone', () => {
  let pid;

  test.beforeAll(async ({ request }) => {
    const users = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
    pid = (await api(request, 'architect', 'POST', '/projects', {name: 'Kale Residence', location: 'Aundh, Pune',
      civil_engineer_id: users[0].id, start_stage: 'requirements_signoff', historical_confirmed_by: 'Parvez'})).id;
    const invite = await api(request, 'architect', 'POST', `/projects/${pid}/client-invite`, {name: CLIENT.name, email: CLIENT.email});
    const r = await request.post(`${API}/auth/activate`, {data: {email: CLIENT.email, code: invite.code, password: CLIENT.password}});
    expect(r.ok()).toBeTruthy();
  });

  test('architect prepares and sends version 1 of the requirements sign-off', async ({ page }) => {
    await signIn(page, 'architect');
    await page.getByTestId('nav-projects').click();
    await page.getByTestId('projects-view').getByText('Kale Residence').click();
    await page.getByTestId('stage-requirements_signoff').click();
    const box = page.getByTestId('signoff-composer');
    await expect(box).toContainText('No sign-off package yet');
    await page.getByTestId('signoff-title').fill('Requirements baseline, version 1');
    await page.getByTestId('signoff-summary').fill('4 BHK with home office and courtyard. Budget band as agreed on 20 Sep.');
    await page.getByTestId('signoff-create').click();
    await expect(page.getByTestId('signoff-send')).toBeDisabled();  // needs a document first

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('signoff-attach').click()]);
    await chooser.setFiles({name: 'Requirements baseline.pdf', mimeType: 'application/pdf', buffer: PDF});
    await expect(page.getByTestId('signoff-attachments')).toContainText('Requirements baseline.pdf');
    const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('signoff-attach').click()]);
    await chooser2.setFiles({name: 'Courtyard sketch.png', mimeType: 'image/png', buffer: makePng(160, 110, 4)});
    await expect(page.getByTestId('signoff-attachments')).toContainText('Courtyard sketch.png');
    await shot(page, 'v3-17-01-composer');

    await page.getByTestId('signoff-send').click();
    await expect(box).toContainText('Version 1 · Sent');
    await expect(page.getByTestId('stage-detail-requirements_signoff')).toContainText('Waiting for client sign-off on version 1');
    await expect(page.getByTestId('audit-list')).toContainText('Sign-off sent to the client: Client sign-off: preliminary requirements (version 1)');
    await shot(page, 'v3-17-02-sent');
  });
});
