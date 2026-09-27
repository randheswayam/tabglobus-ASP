const path = require('path');

const API = 'http://127.0.0.1:8001';
const PASSWORD = 'e2e-pass-123';
const EMAIL = {
  architect: 'architect@siteflow.local',
  team_lead: 'parvez@siteflow.local',
  civil_engineer: 'engineer@siteflow.local',
  admin: 'admin@siteflow.local',
};
const APP = `/index.html?api=${encodeURIComponent(API)}`;

const shot = (page, name) =>
  page.screenshot({ path: path.join(__dirname, '..', 'screenshots', `${name}.png`), fullPage: true });

async function signIn(page, role) {
  await page.goto(APP);
  await page.evaluate(() => { try { localStorage.removeItem('siteflow.token'); } catch (_) {} });
  await page.goto(APP);
  await page.getByTestId('login-email').fill(EMAIL[role]);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
  // The name shows in the sidebar (desktop) or the top bar (phone); wait for whichever is visible.
  await page.locator('[data-testid="signed-in-as"]:visible').first().waitFor();
}

async function signOut(page) {
  await page.locator('[data-testid="sign-out"]:visible').first().click();
  await page.getByTestId('login-email').waitFor();
}

// Direct API helpers for arranging state quickly.
async function apiToken(request, role) {
  const r = await request.post(`${API}/auth/login`, { data: { email: EMAIL[role], password: PASSWORD } });
  return (await r.json()).access_token;
}

async function api(request, role, method, url, data) {
  const token = await apiToken(request, role);
  const r = await request.fetch(`${API}${url}`, { method, data, headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok()) throw new Error(`${method} ${url} -> ${r.status()} ${await r.text()}`);
  return r.json();
}

async function createApprovedProject(request, name) {
  const users = await api(request, 'architect', 'GET', '/users?role=civil_engineer');
  const p = await api(request, 'architect', 'POST', '/projects',
    { name, location: 'Baner, Pune', civil_engineer_id: users[0].id, legal_expected_date: '2026-11-30' });
  await api(request, 'admin', 'PATCH', `/projects/${p.id}/legal`,
    { status: 'Applied', authority_name: 'PMC', application_reference: 'BP-1', application_date: '2026-09-01' });
  await api(request, 'admin', 'PATCH', `/projects/${p.id}/legal`,
    { status: 'Approved', approval_date: '2026-09-20', document_reference: 'doc://approval-1' });
  return p;
}

module.exports = { API, APP, EMAIL, PASSWORD, shot, signIn, signOut, api, createApprovedProject };
