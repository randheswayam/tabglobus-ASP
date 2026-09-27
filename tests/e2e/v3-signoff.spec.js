const { test, expect } = require('@playwright/test');
const { API, APP, PDF, shot, signIn, signOut, api, makePng } = require('./helpers');

const CLIENT = {name: 'Ms. Kale', email: 'kale@client.example', password: 'kale-house-2026'};

async function signInClient(page){
  await page.goto(APP);
  await page.evaluate(() => { try { localStorage.removeItem('siteflow.token'); } catch (_) {} });
  await page.goto(APP);
  await page.getByTestId('login-email').fill(CLIENT.email);
  await page.getByTestId('login-password').fill(CLIENT.password);
  await page.getByTestId('login-submit').click();
  await page.locator('[data-testid="signed-in-as"]:visible').first().waitFor();
}

async function openWaiting(page){
  await page.getByTestId('client-home').locator('[data-testid^="client-card-"]', {hasText: 'Kale Residence'}).click();
  await page.getByTestId('client-waiting').locator('[data-testid^="client-review-"]').first().click();
  await page.getByTestId('client-signoff').waitFor();
}

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

  test('client reviews version 1 and asks for changes', async ({ page }) => {
    await signInClient(page);
    await openWaiting(page);
    const view = page.getByTestId('client-signoff');
    await expect(view).toContainText('Requirements baseline, version 1');
    await expect(view).toContainText('4 BHK with home office and courtyard');
    await expect(page.getByTestId('signoff-approve')).toBeDisabled();
    await expect(page.getByTestId('signoff-checklist')).toContainText('Open every document (0 of 2 opened)');
    await shot(page, 'v3-19-01-review');
    await page.getByTestId('signoff-request-changes').click();
    await expect(page.locator('#toast')).toContainText('what should change');
    await page.getByTestId('signoff-changes-comment').fill('Please add a guest bedroom on the ground floor.');
    await page.getByTestId('signoff-request-changes').click();
    await expect(page.getByTestId('client-project')).toContainText('you asked for changes');
  });

  test('architect prepares version 2 from the change request', async ({ page }) => {
    await signIn(page, 'architect');
    await page.getByTestId('nav-projects').click();
    await page.getByTestId('projects-view').getByText('Kale Residence').click();
    await page.getByTestId('stage-requirements_signoff').click();
    const box = page.getByTestId('signoff-composer');
    await expect(box).toContainText('Please add a guest bedroom on the ground floor.');
    await expect(page.getByTestId('signoff-title')).toHaveValue('Requirements baseline, version 2');
    await page.getByTestId('signoff-summary').fill('4 BHK plus a ground-floor guest bedroom, home office and courtyard.');
    await page.getByTestId('signoff-create').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('signoff-attach').click()]);
    await chooser.setFiles({name: 'Requirements baseline v2.pdf', mimeType: 'application/pdf', buffer: PDF});
    await expect(page.getByTestId('signoff-attachments')).toContainText('Requirements baseline v2.pdf');
    await page.getByTestId('signoff-send').click();
    await expect(box).toContainText('Version 2 · Sent');
  });

  test('client opens every document, confirms and signs version 2', async ({ page }) => {
    await signInClient(page);
    await openWaiting(page);
    await expect(page.getByTestId('client-signoff')).toContainText('version 2');
    await page.getByTestId('signoff-confirm').check();
    await page.getByTestId('signoff-name').fill(CLIENT.name);
    await expect(page.getByTestId('signoff-approve')).toBeDisabled();  // the document is not opened yet
    await page.locator('[data-testid^="signoff-open-"]').first().click();
    await expect(page.getByTestId('signoff-viewer')).toBeVisible();
    await expect(page.getByTestId('signoff-checklist')).toContainText('1 of 1 opened');
    await page.getByTestId('signoff-name').fill('Someone Else');
    await expect(page.getByTestId('signoff-approve')).toBeDisabled();
    await page.getByTestId('signoff-name').fill('ms. kale');
    await expect(page.getByTestId('signoff-approve')).toBeEnabled();
    await shot(page, 'v3-19-02-ready-to-sign');
    await page.getByTestId('signoff-approve').click();
    await page.getByTestId('client-unfold-1').click();
    await expect(page.getByTestId('client-stage-requirements_signoff')).toContainText('Signed by ms. kale');
    await expect(page.getByTestId('client-stage-predesign_site_visit')).toContainText('In progress');
    await expect(page.getByTestId('client-stage-concept')).toContainText('In progress');
    await shot(page, 'v3-19-03-signed');

    await signOut(page);
    await signIn(page, 'architect');
    await page.getByTestId('nav-projects').click();
    await page.getByTestId('projects-view').getByText('Kale Residence').click();
    await expect(page.getByTestId('stage-requirements_signoff')).toContainText('signed by the client');
    await expect(page.getByTestId('stage-predesign_site_visit')).toContainText('In progress');
    await expect(page.getByTestId('audit-list')).toContainText('Client signed off: Client sign-off: preliminary requirements (version 2), signed by ms. kale');
  });
});
