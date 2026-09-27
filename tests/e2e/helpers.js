const path = require('path');
const zlib = require('zlib');

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
    { name, location: 'Baner, Pune', civil_engineer_id: users[0].id, legal_expected_date: '2026-11-30',
      start_stage: 'line_out', historical_confirmed_by: 'Parvez' });  // in construction, earlier stages historical
  await api(request, 'admin', 'PATCH', `/projects/${p.id}/legal`,
    { status: 'Applied', authority_name: 'PMC', application_reference: 'BP-1', application_date: '2026-09-01' });
  await api(request, 'admin', 'PATCH', `/projects/${p.id}/legal`,
    { status: 'Approved', approval_date: '2026-09-20', document_reference: 'doc://approval-1' });
  return p;
}

/* A real PNG built in memory (a sky-to-ground gradient with a slab edge), so no binary fixtures are needed. */
function makePng(w = 96, h = 72, seed = 0){
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++){
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++){
      const i = y * (w * 3 + 1) + 1 + x * 3, ground = y > h * 0.6, slab = Math.abs(y - h * 0.45 - (x - w / 2) * 0.1) < 3;
      raw[i] = slab ? 120 : ground ? 140 + (seed * 9) % 60 : Math.min(255, 150 + y);
      raw[i + 1] = slab ? 120 : ground ? 110 : Math.min(255, 185 + y / 2);
      raw[i + 2] = slab ? 125 : ground ? 80 : 220;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(256)]);

const mediaTiles = page => page.locator('[data-testid^="media-"]:not([data-testid^="media-remove"])');

/* Click an add-photo or add-video button and hand the file chooser a file; waits for the tile to appear. */
async function addMedia(page, testid, file = {name: 'site.png', mimeType: 'image/png', buffer: makePng()}){
  const { expect } = require('@playwright/test');
  const before = await mediaTiles(page).count();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId(testid).click()]);
  await chooser.setFiles(file);
  await expect(mediaTiles(page)).toHaveCount(before + 1);
}

/* A Plinth-stage visit body; checklist decides the derived progress. */
const plinthVisit = (checklist, problems) => ({
  visit_at: new Date().toISOString(), location: {gps: {lat: 18.5204, lng: 73.8567}, manual: null}, weather: 'Clear',
  attendees: 'Farhan Shaikh, contractor', current_stage: 'Plinth', checklist,
  no_issues: !problems, problems: problems || [], summary: 'Plinth work checked.', recommended_action: 'Continue as planned.',
});

/* Submit a site visit through the API with the photos it needs (one tagged to each High or Critical problem). */
async function submitVisitViaApi(request, pid, body){
  const token = (await (await request.post(`${API}/auth/login`, {data: {email: EMAIL.civil_engineer, password: PASSWORD}})).json()).access_token;
  const auth = {Authorization: `Bearer ${token}`};
  const draft = await (await request.post(`${API}/projects/${pid}/site-visits/draft`, {headers: auth})).json();
  const refs = body.problems.map((p, n) => ['High', 'Critical'].includes(p.severity) ? n : null).filter(n => n !== null);
  const have = draft.media.filter(m => m.kind === 'photo').length;
  for (let i = have; i < Math.max(5, refs.length); i++){
    const multipart = {file: {name: `p${i}.png`, mimeType: 'image/png', buffer: makePng(96, 72, i)}, kind: 'photo',
      captured_at: new Date().toISOString(), lat: '18.5204', lng: '73.8567'};
    if (i - have < refs.length) multipart.problem_ref = String(refs[i - have]);
    const r = await request.post(`${API}/site-visits/${draft.id}/media`, {headers: auth, multipart});
    if (!r.ok()) throw new Error(`upload -> ${r.status()} ${await r.text()}`);
  }
  const r = await request.post(`${API}/projects/${pid}/site-visits`, {headers: auth, data: body});
  if (!r.ok()) throw new Error(`submit -> ${r.status()} ${await r.text()}`);
  return r.json();
}

module.exports = { API, APP, EMAIL, PASSWORD, MP4, shot, signIn, signOut, api, createApprovedProject, makePng, addMedia,
  mediaTiles, plinthVisit, submitVisitViaApi };
