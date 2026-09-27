const { test, expect, devices } = require('@playwright/test');
const { API, APP, PDF, shot, api, plinthVisit, submitVisitViaApi } = require('./helpers');

const CLIENT = {name: 'Mr. Bapat', email: 'bapat@client.example', password: 'bapat-bungalow-26'};
const INTERNAL = ['TBD', 'Audit', 'Red flag', 'rework', 'Rework', 'Legal Approval', 'problem', 'Critical issue', 'siteflow.local'];

async function signInClient(page){
  await page.goto(APP);
  await page.evaluate(() => { try { localStorage.removeItem('siteflow.token'); } catch (_) {} });
  await page.goto(APP);
  await page.getByTestId('login-email').fill(CLIENT.email);
  await page.getByTestId('login-password').fill(CLIENT.password);
  await page.getByTestId('login-submit').click();
  await page.locator('[data-testid="signed-in-as"]:visible').first().waitFor();
}

test.describe.serial('the customer app', () => {
  test.beforeAll(async ({ request }) => {
    const users = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
    // In construction, with an approved visit that raised an internal red flag and an open problem.
    const a = await api(request, 'architect', 'POST', '/projects', {name: 'Bapat Bungalow', location: 'Kothrud, Pune',
      civil_engineer_id: users[0].id, start_stage: 'line_out', historical_confirmed_by: 'Parvez'});
    await api(request, 'admin', 'PATCH', `/projects/${a.id}/legal`, {status: 'Applied', authority_name: 'PMC', application_reference: 'BP-9', application_date: '2026-09-01'});
    await api(request, 'admin', 'PATCH', `/projects/${a.id}/legal`, {status: 'Approved', approval_date: '2026-09-20', document_reference: 'doc://bp-9'});
    const seep = {category: 'Water', problem: 'Seepage or dampness', other_text: null, severity: 'High', location: 'North wall',
      responsible_party: 'Contractor', target_date: '2026-11-30'};
    const v = await submitVisitViaApi(request, a.id, plinthVisit({'pln-beam': 'Done', 'pln-filling': 'Done', 'pln-dpc': 'In progress'}, [seep]));
    await api(request, 'team_lead', 'POST', `/site-visits/${v.id}/review`, {decision: 'approve'});
    // Waiting for the client's design-freeze sign-off.
    const b = await api(request, 'architect', 'POST', '/projects', {name: 'Bapat Farmhouse', location: 'Mulshi, Pune',
      civil_engineer_id: users[0].id, start_stage: 'design_freeze_signoff', historical_confirmed_by: 'Parvez'});
    const inv = await api(request, 'architect', 'POST', `/projects/${a.id}/client-invite`, {name: CLIENT.name, email: CLIENT.email});
    await request.post(`${API}/auth/activate`, {data: {email: CLIENT.email, code: inv.code, password: CLIENT.password}});
    await api(request, 'architect', 'POST', `/projects/${b.id}/client-invite`, {name: CLIENT.name, email: CLIENT.email});
    const so = await api(request, 'architect', 'POST', `/projects/${b.id}/signoffs`, {stage_key: 'design_freeze_signoff',
      title: 'All elevations, version 1', summary: 'Front, rear and side elevations with materials.'});
    const token = (await (await request.post(`${API}/auth/login`, {data: {email: 'architect@siteflow.local', password: 'e2e-pass-123'}})).json()).access_token;
    await request.post(`${API}/signoffs/${so.id}/attachments`, {headers: {Authorization: `Bearer ${token}`},
      multipart: {file: {name: 'Elevations.pdf', mimeType: 'application/pdf', buffer: PDF}}});
    await api(request, 'architect', 'POST', `/signoffs/${so.id}/send`);
  });

  test('client sees only their projects, the phase timeline and what waits for them', async ({ page }) => {
    await signInClient(page);
    const home = page.getByTestId('client-home');
    await expect(home).toContainText('Bapat Bungalow');
    await expect(home).toContainText('Bapat Farmhouse');
    await expect(home).not.toContainText('Kale Residence');
    const farm = home.locator('[data-testid^="client-card-"]', {hasText: 'Bapat Farmhouse'});
    await expect(farm).toContainText('Sign-off waiting for you');
    const bungalow = home.locator('[data-testid^="client-card-"]', {hasText: 'Bapat Bungalow'});
    await expect(bungalow).toContainText('Construction execution');
    await expect(bungalow).toContainText('20.8%');  // Foundation 12.5 + 2 of 3 Plinth items x 12.5
    for (const word of INTERNAL) await expect(home).not.toContainText(word);
    await shot(page, 'v3-18-01-client-home');

    await bungalow.click();
    const view = page.getByTestId('client-project');
    await expect(view).toContainText('Bapat Bungalow');
    await expect(page.getByTestId('client-phase-7')).toContainText('Construction quality stages');
    await expect(page.getByTestId('client-stage-construction')).toContainText('In progress');
    await expect(page.getByTestId('client-stage-setup')).toHaveCount(0);  // finished phases are folded
    await page.getByTestId('client-unfold-1').click();
    await expect(page.getByTestId('client-stage-setup')).toContainText('Completed before SiteFlow');
    await expect(page.getByTestId('client-stage-handover_signoff')).toContainText('Your sign-off');
    for (const word of INTERNAL) await expect(view).not.toContainText(word);
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);
    await shot(page, 'v3-18-02-client-timeline');
  });

  test('customer app on a phone', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage();
    await signInClient(page);
    await page.getByTestId('client-home').locator('[data-testid^="client-card-"]', {hasText: 'Bapat Farmhouse'}).click();
    await expect(page.getByTestId('client-waiting')).toContainText('All elevations, version 1');
    const width = page.viewportSize().width;
    for (const id of ['client-project', 'client-waiting', 'client-phase-5']){
      const box = await page.getByTestId(id).boundingBox();
      expect(box.x + box.width, id).toBeLessThanOrEqual(width);
    }
    await shot(page, 'v3-18-03-client-phone');
    await context.close();
  });
});
