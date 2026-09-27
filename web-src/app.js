(function(){
'use strict';
/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => p + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const today = () => ymd(new Date());
const addDays = (n, base) => { const d = base ? parseYmd(base) : new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return ymd(d); };
const daysUntil = s => { const t = new Date(); t.setHours(12, 0, 0, 0); return Math.round((parseYmd(s) - t) / 864e5); };
const fmtDate = s => s ? parseYmd(s).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) : '—';
const fmtShort = s => s ? parseYmd(s).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'}) : '—';
const fmtTime = t => { const d = new Date(t); const same = ymd(d) === today(); return same ? d.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'}) : d.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'}); };
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const I = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  flow: '<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="9" y="15" width="6" height="5" rx="1"/><path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9M12 13v2"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  split: '<path d="M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v6M18 3v6a3 3 0 0 1-3 3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  logo: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M4 20h16"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  rupee: '<path d="M7 5h10M7 9h10M7 5c6 0 6 8 0 8l7 7"/>'
};
const ico = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* ---------- reference data ---------- */
const API = SiteFlowAPI;
const ROLES = {architect: 'Architect', team_lead: 'Team Lead', civil_engineer: 'Civil Engineer', admin: 'Admin', client: 'Client'};
const STEP_LABEL = {locked: 'Locked', active: 'In progress', completed: 'Done'};
const STEP_PILL = {locked: '', active: 'active', completed: 'done'};
const VISIT_LABEL = {draft: 'Draft', submitted: 'Awaiting review', rework: 'Rework', approved: 'Approved'};
const VISIT_PILL = {draft: '', submitted: 'submitted', rework: 'rework', approved: 'done'};
const LEGAL_NEXT = {'Not started': ['Applied'], 'Applied': ['Approved', 'Rejected']};
const LEGAL_FIELDS = {
  authority_name: 'Authority name', application_reference: 'Application reference', application_date: 'Application date',
  approval_date: 'Approval date', document_reference: 'Approval document'
};
const fmtStamp = iso => iso ? new Date(iso).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : '—';
const pct = n => (n == null ? '—' : `${Number(n).toFixed(1).replace(/\.0$/, '')}%`);

/* ---------- state ---------- */
const ui = {route: 'login', p: {}, me: null, data: {}, error: null, loadError: null};
const isClient = () => !!ui.me && ui.me.role === 'client';
const home = () => isClient() ? 'client-home'
  : API.dashboard && ui.me && ['architect', 'team_lead'].includes(ui.me.role) ? 'dashboard' : 'projects';
const can = {
  create: () => ui.me && ui.me.role === 'architect',
  legal: () => ui.me && ui.me.role === 'admin',
  visit: () => ui.me && ui.me.role === 'civil_engineer',
  review: () => ui.me && ui.me.role === 'team_lead'
};

/* ---------- toast ---------- */
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600); }

/* ---------- navigation ---------- */
async function go(route, p = {}){
  ui.route = route; ui.p = p; ui.error = null; ui.loadError = null; ui.data = {}; ui.lightbox = null;
  const v = V[route];
  if (v && v.load){
    $('#main').innerHTML = shell() + '<div class="empty">Loading…</div>';
    try { await v.load(); } catch (e) { if (!API.signedIn()) return showLogin(); ui.loadError = e.message; }
  }
  render(); window.scrollTo(0, 0);
  if (can.review() && route !== 'queue') API.reviewQueue().then(q => { ui.queueCount = q.length; shell(); }).catch(() => {});
  if (API.notifications && route !== 'alerts') API.notifications().then(n => { ui.unread = n.unread; shell(); }).catch(() => {});
}
function showLogin(msg){ ui.me = null; ui.route = 'login'; ui.error = msg || null; render(); }
API.onSignedOut(() => showLogin('Your session has ended. Sign in again.'));

/* ---------- render: shell ---------- */
function shell(){
  if (!ui.me) return '';
  const u = ui.me;
  const nav = isClient() ? [['client-home', 'home', 'My projects'], ...(API.notifications ? [['alerts', 'bell', 'Notifications']] : [])]
    : [...(home() === 'dashboard' ? [['dashboard', 'home', 'Dashboard']] : []), ['projects', 'folder', 'Projects'],
      ...(can.review() ? [['queue', 'eye', 'Review queue']] : []), ...(API.notifications ? [['alerts', 'bell', 'Notifications']] : [])];
  const cur = ui.route === 'review' ? 'queue' : ['project', 'new-project', 'visit'].includes(ui.route) ? 'projects'
    : ['client-project', 'client-signoff'].includes(ui.route) ? 'client-home' : ui.route;
  const count = r => r === 'queue' && ui.queueCount ? `<span class="count" data-testid="queue-count">${ui.queueCount}</span>`
    : r === 'alerts' && ui.unread ? `<span class="count" data-testid="unread-count">${ui.unread}</span>` : '';
  const who = `<span data-testid="signed-in-as"><b>${esc(u.name)}</b> <span class="muted small">· ${ROLES[u.role]}</span></span>`;
  $('#side').innerHTML = `
    <div class="brand"><span class="brand-mark">${ico('logo')}</span><div><b>SiteFlow</b><small>Residential · MVP</small></div></div>
    <div class="nav">${nav.map(([r, i, l]) => `<button data-go="${r}" data-testid="nav-${r}" class="${cur === r ? 'on' : ''}">${ico(i)}${l}${count(r)}</button>`).join('')}</div>
    <div class="side-foot">
      <div class="whois"><span class="eyebrow">Signed in</span>${who}</div>
      <button class="btn ghost sm" data-act="sign-out" data-testid="sign-out">Sign out</button>
      ${API.demo ? `<button class="btn ghost sm" data-act="reset-demo" data-testid="reset-demo">Reset demo data</button>` : ''}
      <div class="credit">${API.demo ? 'Demo with sample data · ' : ''}SiteFlow by TAN GLOBUS AI</div>
    </div>`;
  $('#tabs').innerHTML = nav.map(([r, i, l]) => `<button data-go="${r}" class="${cur === r ? 'on' : ''}">${ico(i)}${l}${count(r)}</button>`).join('');
  return `<div class="mtop"><div class="brand"><span class="brand-mark">${ico('logo')}</span><b>SiteFlow</b></div><div class="row small">${who}<button class="btn ghost sm" data-act="sign-out" data-testid="sign-out">Sign out</button></div></div>
    ${navigator.onLine === false ? `<div class="offline">${ico('cloud')}Offline. Drafts stay on this device; submit when you are back in coverage.</div>` : ''}`;
}

/* ---------- small components ---------- */
const pill = (cls, label, testid) => `<span class="pill ${cls}"${testid ? ` data-testid="${testid}"` : ''}><span class="dot"></span>${esc(label)}</span>`;
const errBox = () => ui.error ? `<div class="errbox" data-testid="form-error" style="margin-bottom:14px">${esc(ui.error.message)}${ui.error.items && ui.error.items.length ? `<ul>${ui.error.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>` : '';
function setError(e, labels){
  const lab = k => (typeof labels === 'function' ? labels(k) : (labels && labels[k]) || k).toLowerCase();
  const items = e instanceof API.ApiError ? [...e.missing.map(k => `Missing: ${lab(k)}`), ...e.invalid.map(k => `Invalid: ${lab(k)}`)] : [];
  ui.error = {message: e.message, items};
}
function projectCard(p){
  const at = p.phase ? p.phase.number : 0;
  const cls = n => !p.phase ? '' : n < at ? 'done' : n === at ? 'active' : '';
  const now = (p.current_stages || []).join(' + ');
  return `<button class="pcard" data-act="open-project" data-pid="${p.id}" data-testid="project-card-${p.id}">
    <div><h3>${esc(p.name)}</h3><div class="loc">${esc(p.location)}</div></div>
    <div class="ministep" aria-label="Phase ${at} of 10">${Array.from({length: 10}, (_, i) => `<i class="${cls(i + 1)}"></i>`).join('')}</div>
    <div class="now"><span>${now ? `<span class="muted">Now:</span> <b>${esc(now)}</b>` : '<b>All stages complete</b>'}</span><span class="mono muted">${pct(p.official_progress)}</span></div>
    ${p.phase ? `<div class="small muted">Phase ${p.phase.number} · ${esc(p.phase.name)}</div>` : ''}
    <div class="row small muted">${p.civil_engineer ? `<span>${esc(p.civil_engineer.name)}</span>` : ''}${p.latest_visit_status ? pill(VISIT_PILL[p.latest_visit_status], VISIT_LABEL[p.latest_visit_status]) : ''}</div>
  </button>`;
}
function auditText(e){
  const d = e.detail || {};
  switch (e.action){
    case 'project.created': return d.start_stage ? `Project created, onboarded mid-way (earlier stages confirmed by ${d.historical_confirmed_by})` : 'Project created';
    case 'stage.completed': return `Stage completed: ${d.stage}${d.note ? `. ${d.note}` : ''}`;
    case 'stage.activated': return `Stage opened: ${d.stage}`;
    case 'client.invited': return `Client invited: ${d.client}`;
    case 'client.activated': return 'Client activated their account';
    case 'signoff.created': return `Sign-off package prepared: ${d.stage} (version ${d.version})`;
    case 'signoff.attachment_added': return `Document added to sign-off version ${d.version}: ${d.filename}`;
    case 'signoff.attachment_removed': return `Document removed from sign-off version ${d.version}: ${d.filename}`;
    case 'signoff.sent': return `Sign-off sent to the client: ${d.stage} (version ${d.version})`;
    case 'signoff.approved': return `Client signed off: ${d.stage} (version ${d.version}), signed by ${d.signer}`;
    case 'signoff.changes_requested': return `Client asked for changes: ${d.stage} (version ${d.version}): “${d.comment}”`;
    case 'legal.updated': return d.from === d.to ? 'Legal Approval details updated' : `Legal Approval: ${d.from} to ${d.to}`;
    case 'step.activated': return `${d.step} opened`;
    case 'step.completed': return `${d.step} completed`;
    case 'step.locked': return `${d.step} locked`;
    case 'site_visit.submitted': return `Site visit submitted (submission ${d.submission}), derived progress ${pct(d.computed_progress)}`;
    case 'site_visit.approved': return `Site visit approved, progress ${pct(d.official_progress)} is official`;
    case 'site_visit.rework_requested': return `Rework requested: “${d.comment}”`;
    case 'media.added': return `${d.kind === 'video' ? 'Video' : 'Photo'} added${d.problem_ref != null ? ` to problem ${d.problem_ref + 1}` : ''}`;
    case 'media.removed': return `${d.kind === 'video' ? 'Video' : 'Photo'} removed`;
    case 'problem.resolved': return `Problem resolved: ${d.problem}. ${d.note}`;
    case 'red_flag.raised': return `Red flag raised: ${d.label}`;
    case 'red_flag.cleared': return `Red flag cleared: ${d.label}`;
    case 'red_flag.cleared_manually': return `Red flag cleared by hand: ${d.label}. Reason: ${d.reason}`;
    default: return e.action;
  }
}

/* ---------- views ---------- */
const V = {};

V.login = {html: () => `<div class="login panel" data-testid="login-view">
    <div class="panel-b form">
      <div class="brand"><span class="brand-mark">${ico('logo')}</span><div><b>SiteFlow</b><small>Residential · MVP</small></div></div>
      <h1>Sign in</h1>
      ${ui.error ? `<div class="errbox" data-testid="login-error">${esc(ui.error)}</div>` : ''}
      ${ui.activating ? `<form class="form" data-form="activate">
        <p class="small muted">Your architect gave you an 8-character invite code. Use it once to choose your password.</p>
        <div class="field"><label for="ac-email">Email</label><input id="ac-email" data-testid="activate-email" type="email" autocomplete="username" value="${esc(ui.loginEmail)}" required></div>
        <div class="field"><label for="ac-code">Invite code</label><input id="ac-code" data-testid="activate-code" autocomplete="one-time-code" autocapitalize="characters" maxlength="12" value="${esc(ui.activateCode)}" required></div>
        <div class="field"><label for="ac-pass">Choose a password</label><input id="ac-pass" data-testid="activate-password" type="password" autocomplete="new-password" required><span class="small muted">At least 10 characters.</span></div>
        <button class="btn primary" type="submit" data-testid="activate-submit">Set password and sign in</button>
        <button class="btn ghost sm" type="button" data-act="hide-activate">Back to sign in</button>
      </form>` : `<form class="form" data-form="login">
        <div class="field"><label for="li-email">Email</label><input id="li-email" data-testid="login-email" type="email" autocomplete="username" value="${esc(ui.loginEmail)}" required></div>
        <div class="field"><label for="li-pass">Password</label><input id="li-pass" data-testid="login-password" type="password" autocomplete="current-password" required></div>
        <button class="btn primary" type="submit" data-testid="login-submit">Sign in</button>
        ${API.demo ? '' : `<button class="btn ghost sm" type="button" data-act="show-activate" data-testid="show-activate">I have an invite code</button>`}
      </form>`}
      ${API.demo ? demoPanel() : `<details class="small muted"><summary>Server</summary>
        <div class="field" style="margin-top:8px"><label for="li-api">SiteFlow server address</label><input id="li-api" data-testid="login-server" value="${esc(API.base())}"></div>
        <button class="btn sm" data-act="set-server" style="margin-top:8px">Use this server</button>
      </details>`}
      <div class="credit">SiteFlow by TAN GLOBUS AI</div>
    </div></div>`};

/* Demo build only: one-tap accounts and the order to try them in. */
function demoPanel(){
  return `<div class="demo-box" data-testid="demo-accounts">
    <div class="eyebrow">Demo accounts · password ${esc(API.demoPassword)}</div>
    <div class="demo-grid">${API.demoAccounts.map(a => `<button class="demo-acct" data-act="demo-login" data-email="${esc(a.email)}" data-testid="demo-${esc(a.email.split('@')[0])}"><b>${esc(a.label)}</b><span>${esc(a.role)}</span></button>`).join('')}</div>
    <ol class="demo-tour small">
      <li><b>Meera Joshi</b> opens the dashboard: two red flags need attention.</li>
      <li><b>Office Coordinator</b> approves the overdue Legal Approval on Gokhale Residence.</li>
      <li><b>Farhan Shaikh</b> records a site visit with photos on Patil Villa.</li>
      <li><b>Parvez</b> reviews Deshmukh Residence with its photos, then clears or follows up on flags.</li>
    </ol>
    <p class="small muted">Sample projects and people. Changes stay in this browser.</p>
  </div>`;
}

/* ---------- dashboard (Architect and Team Lead) ---------- */
const K_FILTERS = 'siteflow.dashboard.filters';
function savedFilters(){ try { return JSON.parse(localStorage.getItem(K_FILTERS) || '{}') || {}; } catch (_) { return {}; } }
function saveFilters(f){ try { localStorage.setItem(K_FILTERS, JSON.stringify(f)); } catch (_) {} }
const FILTERS = ['q', 'location', 'step', 'engineer_id', 'red_flag', 'severity', 'category', 'progress_min', 'progress_max', 'visit_from', 'visit_to'];

V.dashboard = {
  load: async () => {
    ui.data.filters = savedFilters();
    const [d] = await Promise.all([API.dashboard(ui.data.filters), template()]);
    ui.data.dash = d;
    // Engineer choices come from the dashboard itself; only the Architect may list users.
    const seen = {}; d.all_projects.forEach(p => { if (p.civil_engineer) seen[p.civil_engineer.id] = p.civil_engineer.name; });
    ui.data.engineers = {...(ui.data.engineers || {}), ...seen};
  },
  html: () => {
    const d = ui.data.dash, f = ui.data.filters;
    const n = Object.keys(f).length;
    return `<div data-testid="dashboard-view"><div class="head"><div><h1>Dashboard</h1><div class="sub">${d.all_projects.length} project${d.all_projects.length === 1 ? '' : 's'}${n ? ` matching ${n} filter${n === 1 ? '' : 's'}` : ''} · ${d.needs_attention.length} need${d.needs_attention.length === 1 ? 's' : ''} attention</div></div>
      ${can.create() ? `<button class="btn primary" data-go="new-project">${ico('plus')}New project</button>` : ''}</div>
    ${filterBar(f)}
    <div class="kpis">
      <div class="kpi ${d.needs_attention.length ? 'alert' : ''}"><b data-testid="kpi-attention">${d.needs_attention.length}</b><span>Need architect attention</span></div>
      <div class="kpi ${d.major_problems.length ? 'attn' : ''}"><b data-testid="kpi-major">${d.major_problems.length}</b><span>Open High and Critical problems</span></div>
      <div class="kpi"><b data-testid="kpi-queue">${d.review_queue.length}</b><span>Waiting for review</span></div>
      <div class="kpi"><b>${d.all_projects.length}</b><span>Projects shown</span></div>
    </div>
    ${errBox()}
    <div class="grid2">
      <div class="stack">
        <section class="panel" data-testid="panel-attention"><div class="panel-h"><h2>Needs Architect Attention</h2><span class="small muted">Most severe first</span></div>
          ${d.needs_attention.length ? `<div class="tasks">${d.needs_attention.map(attentionRow).join('')}</div>` : '<div class="empty">No red flags. Nothing needs your attention.</div>'}</section>
        <section class="panel" data-testid="panel-projects"><div class="panel-h"><h2>All Projects</h2></div>
          ${d.all_projects.length ? `<div class="tbl-wrap"><table class="ftable dash-table"><thead><tr><th>Project</th><th>Step</th><th>Progress</th><th>Open problems</th><th>Last visit</th><th>Flags</th></tr></thead><tbody>
            ${d.all_projects.map(p => `<tr data-act="open-project" data-pid="${p.id}" data-testid="dash-row-${p.id}" class="clickable">
              <td><b>${esc(p.name)}</b><div class="small muted">${esc(p.location)}</div></td>
              <td>${esc(p.current_step || 'Complete')}</td><td class="mono">${pct(p.official_progress)}</td>
              <td class="mono">${p.open_problems}</td><td class="small">${p.last_visit_at ? fmtStamp(p.last_visit_at) : '<span class="muted">None yet</span>'}</td>
              <td>${p.flag_labels.map(l => pill('rework', l)).join(' ') || '<span class="muted small">None</span>'}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty">No projects match these filters.</div>'}</section>
      </div>
      <div class="stack">
        <section class="panel" data-testid="panel-major"><div class="panel-h"><h2>Major Problems</h2><span class="small muted">Open High and Critical</span></div>
          ${d.major_problems.length ? `<div class="feed">${d.major_problems.map(majorRow).join('')}</div>` : '<div class="empty">No open High or Critical problems.</div>'}</section>
        <section class="panel" data-testid="panel-queue"><div class="panel-h"><h2>Review Queue</h2></div>
          ${d.review_queue.length ? `<div class="tasks">${d.review_queue.map(v => `<button class="task task-review" data-act="${can.review() ? 'open-review' : 'open-project'}" data-vid="${v.id}" data-pid="${v.project.id}">
            <span class="ti">${ico('eye')}</span><span><b>${esc(v.project.name)}</b><span class="small muted">${esc(v.engineer ? v.engineer.name : '')} · ${esc(v.current_stage || '')}</span></span>
            <span class="meta">${pill(v.waiting_minutes > 2880 ? 'rework' : 'submitted', `Waiting ${waitedText(v.waiting_minutes)}`)}</span></button>`).join('')}</div>` : '<div class="empty">Nothing waiting for review.</div>'}</section>
      </div>
    </div></div>`;
  }
};
const waitedText = m => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`;

function attentionRow(p){
  return `<div class="task attn-row" data-testid="attention-${p.id}">
    <span class="ti" style="background:var(--bad-soft);color:var(--bad)">${ico('flag')}</span>
    <span><b><button class="linkish" data-act="open-project" data-pid="${p.id}">${esc(p.name)}</button></b><span class="small muted">${esc(p.location)} · ${esc(p.current_step || 'Complete')}</span>
      <span class="flag-list">${p.flags.map(f => flagChip(f)).join('')}</span></span>
    <span class="meta mono small">${pct(p.official_progress)}</span></div>`;
}
function flagChip(f){
  const clearing = ui.p.clearing === f.id;
  return `<span class="flag-chip" data-testid="flag-${f.id}">${pill('rework', f.label)}<span class="small muted">since ${fmtStamp(f.raised_at)}</span>
    ${can.review() && !clearing ? `<button class="btn sm ghost" data-act="flag-clear" data-id="${f.id}" data-testid="flag-clear-${f.id}">Clear</button>` : ''}
    ${clearing ? `<span class="flag-clear-form"><input class="inp" id="fr-${f.id}" data-testid="flag-reason-${f.id}" placeholder="Reason for clearing" aria-label="Reason for clearing">
      <button class="btn sm primary" data-act="flag-confirm" data-id="${f.id}" data-testid="flag-confirm-${f.id}">Clear flag</button>
      <button class="btn sm ghost" data-act="flag-cancel">Cancel</button></span>` : ''}</span>`;
}
function majorRow(x){
  return `<button class="fi warn major-row" data-act="open-project" data-pid="${x.project.id}" data-testid="major-${x.id}">
    ${x.photo_id ? `<span class="major-thumb"><img data-mid="${x.photo_id}" alt="Photo of the problem"></span>` : `<span class="fic">${ico('alert')}</span>`}
    <div><div><b>${esc(x.problem)}</b> · ${esc(x.project.name)}</div>
      <div class="when">${pill(x.severity === 'Critical' ? 'rework' : 'active', x.severity)}<span>${esc(x.location)}</span><span>· ${esc(x.responsible_party)}</span>
      <span class="${x.target_date < today() ? 'overdue-text' : ''}">· fix by ${fmtDate(x.target_date)}</span></div></div></button>`;
}
function filterBar(f){
  const T = TEMPLATE, sel = (id, label, options, val) => `<label class="flt"><span>${label}</span><select id="${id}" data-flt="${id.slice(3)}" data-testid="${id}"><option value="">Any</option>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(val ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const inp = (id, label, type, val, extra = '') => `<label class="flt"><span>${label}</span><input id="${id}" type="${type}" data-flt="${id.slice(3)}" data-testid="${id}" value="${esc(val ?? '')}" ${extra}></label>`;
  return `<details class="panel filters" data-testid="filters" ${Object.keys(f).length ? 'open' : ''}><summary class="panel-h"><h3>${ico('flow')}Filters</h3>${Object.keys(f).length ? `<button class="btn sm ghost" data-act="flt-reset" data-testid="flt-reset">Clear filters</button>` : ''}</summary>
    <div class="panel-b flt-grid">
      ${inp('fl-q', 'Project name', 'search', f.q)}${inp('fl-location', 'Location', 'search', f.location)}
      ${sel('fl-step', 'Current step', [['Legal Approval', 'Legal Approval'], ['Site Visit', 'Site Visit'], ['Team Lead Review', 'Team Lead Review']], f.step)}
      ${sel('fl-engineer_id', 'Civil Engineer', Object.entries(ui.data.engineers || {}), f.engineer_id)}
      ${sel('fl-red_flag', 'Red flag', [['true', 'Yes'], ['false', 'No']], f.red_flag)}
      ${sel('fl-severity', 'Problem severity', T.severities.map(s => [s, s]), f.severity)}
      ${sel('fl-category', 'Problem category', Object.keys(T.problems).map(c => [c, c]), f.category)}
      ${inp('fl-progress_min', 'Progress from %', 'number', f.progress_min, 'min="0" max="100" step="any"')}${inp('fl-progress_max', 'Progress to %', 'number', f.progress_max, 'min="0" max="100" step="any"')}
      ${inp('fl-visit_from', 'Last visit from', 'date', f.visit_from)}${inp('fl-visit_to', 'Last visit to', 'date', f.visit_to)}
    </div></details>`;
}
async function applyFilter(el){
  const f = {...ui.data.filters}, v = el.value.trim();
  if (v) f[el.dataset.flt] = v; else delete f[el.dataset.flt];
  saveFilters(f);
  const y = window.scrollY;
  try { await V.dashboard.load(); ui.error = null; } catch (err){ setError(err); ui.data.filters = f; }
  render(); window.scrollTo(0, y);
  const again = document.getElementById(el.id); if (again && el.type !== 'date' && el.tagName !== 'SELECT'){ again.focus(); try { again.setSelectionRange(v.length, v.length); } catch (_) {} }
}

/* ---------- notifications ---------- */
const NOTE_ICON = {step_unlocked: 'flow', submitted: 'eye', approved: 'check', rework: 'alert', red_flag: 'flag'};
const NOTE_CLASS = {approved: 'ok', rework: 'warn', red_flag: 'warn', submitted: '', step_unlocked: 'ms'};
V.alerts = {
  load: async () => { ui.data.notes = await API.notifications(); ui.unread = ui.data.notes.unread; },
  html: () => {
    const n = ui.data.notes;
    return `<div data-testid="alerts-view"><div class="head"><div><h1>Notifications</h1><div class="sub">${n.unread ? `${n.unread} unread` : 'All caught up'}</div></div>
      ${n.unread ? `<button class="btn" data-act="read-all" data-testid="read-all">${ico('check')}Mark all read</button>` : ''}</div>
      <section class="panel"><div class="feed">${n.items.length ? n.items.map(x => `<button class="fi note ${NOTE_CLASS[x.kind] || ''} ${x.read_at ? '' : 'unread'}" data-act="open-note" data-id="${x.id}" data-pid="${x.project ? x.project.id : ''}" data-testid="note-${x.id}">
        <span class="fic">${ico(NOTE_ICON[x.kind] || 'bell')}</span>
        <div><div>${esc(x.text)}</div><div class="when"><span>${fmtStamp(x.created_at)}</span>${x.read_at ? '' : '<span class="ch">New</span>'}</div></div></button>`).join('')
        : '<div class="empty">No notifications yet. You will see step changes, reviews and red flags here.</div>'}</div></section></div>`;
  }
};

/* ---------- customer app (Client role) ---------- */
const CLIENT_STATE = {completed: ['done', 'Completed'], historical: ['', 'Completed before SiteFlow'], in_progress: ['active', 'In progress'], upcoming: ['', 'Upcoming']};

V['client-home'] = {
  load: async () => { ui.data.myProjects = await API.clientProjects(); },
  html: () => {
    const list = ui.data.myProjects;
    return `<div data-testid="client-home"><div class="head"><div><h1>My projects</h1>
      <div class="sub">Follow your project from design to handover, and sign off each milestone after you review it.</div></div></div>
      ${list.length ? `<div class="pcards">${list.map(p => `<button class="pcard" data-act="client-open" data-pid="${p.id}" data-testid="client-card-${p.id}">
        <div><h3>${esc(p.name)}</h3><div class="loc">${esc(p.location)}</div></div>
        ${p.waiting_for_you ? `<span class="pill rework"><span class="dot"></span>Sign-off waiting for you</span>` : ''}
        <div class="ministep" aria-label="Phase ${p.phase ? p.phase.number : 0} of 10">${Array.from({length: 10}, (_, i) => `<i class="${!p.phase ? '' : i + 1 < p.phase.number ? 'done' : i + 1 === p.phase.number ? 'active' : ''}"></i>`).join('')}</div>
        <div class="now"><span>${p.phase ? `<span class="muted">Phase ${p.phase.number}:</span> <b>${esc(p.phase.name)}</b>` : ''}</span><span class="mono muted">${pct(p.official_progress)}</span></div>
        <div class="small muted">${esc((p.current_stages || []).join(' + ') || 'All stages complete')}</div></button>`).join('')}</div>`
      : '<section class="panel"><div class="empty">No project is shared with you yet. Your architect will invite you.</div></section>'}</div>`;
  }
};

V['client-project'] = {
  load: async () => { ui.data.mine = await API.clientProject(ui.p.pid); },
  html: () => {
    const p = ui.data.mine;
    const waiting = p.signoffs.filter(s => s.status === 'sent');
    return `<div data-testid="client-project"><div class="crumbs"><button data-go="client-home">My projects</button>/<span>${esc(p.name)}</span></div>
      <div class="head"><div><h1>${esc(p.name)}</h1><div class="sub">${esc(p.location)}</div></div>
        <div class="row">${p.phase ? `<span class="pill active">Phase ${p.phase.number} · ${esc(p.phase.name)}</span>` : ''}<span class="pill done">Construction progress ${pct(p.official_progress)}</span></div></div>
      ${waiting.length ? `<section class="panel waiting" data-testid="client-waiting"><div class="panel-h"><h2>Waiting for your sign-off</h2></div>
        <div class="tasks">${waiting.map(s => `<button class="task" data-act="client-review" data-sid="${s.id}" data-testid="client-review-${s.id}">
          <span class="ti">${ico('check')}</span><span><b>${esc(s.title)}</b><span class="small muted">${esc(s.stage)} · version ${s.version} · sent ${fmtStamp(s.sent_at)}</span></span>
          <span class="meta">${pill('rework', 'Review and sign')}</span></button>`).join('')}</div></section>` : ''}
      <section class="panel"><div class="panel-h"><h2>Your project, stage by stage</h2><span class="small muted">${p.stage_progress ? `${p.stage_progress.done} of ${p.stage_progress.total} done` : ''}</span></div>
        <div class="phases">${p.phases.map(ph => {
          const done = ph.stages.every(s => s.state === 'completed' || s.state === 'historical');
          const cur = ph.stages.some(s => s.state === 'in_progress');
          // Finished phases fold to one line so the current work stays near the top on a phone.
          const folded = done && !(ui.p.unfold || []).includes(ph.number);
          return `<div class="phase ${done ? 'phase-done' : cur ? 'phase-cur' : ''}" data-testid="client-phase-${ph.number}">
            <div class="phase-h"><span class="phase-n">${ph.number}</span><b>${esc(ph.name)}</b>
              ${done ? `<button class="btn ghost sm" data-act="client-unfold" data-n="${ph.number}" data-testid="client-unfold-${ph.number}">${folded ? `Completed · show ${ph.stages.length} stage${ph.stages.length === 1 ? '' : 's'}` : 'Hide'}</button>` : ''}</div>
            ${folded ? '' : ph.stages.map(s => { const [cls, label] = CLIENT_STATE[s.state];
              return `<div class="cstage" data-testid="client-stage-${s.key}"><div><b>${s.number ? esc(s.number) + '. ' : ''}${esc(s.label)}</b>
                <div class="small muted">${esc(s.detail)}</div>
                ${s.signed ? `<div class="small signed">${ico('check')}Signed by ${esc(s.signed.by)} on ${fmtStamp(s.signed.at)} (version ${s.signed.version})</div>`
                  : s.is_signoff && s.state !== 'historical' ? `<div class="small muted">${ico('flag')}Your sign-off</div>` : ''}</div>
                <div class="cstage-s">${pill(cls, label)}${s.completed_at ? `<span class="small muted">${fmtDate(s.completed_at.slice(0, 10))}</span>` : ''}</div></div>`; }).join('')}
          </div>`; }).join('')}</div></section>
      ${p.signoffs.filter(s => s.status !== 'sent').length ? `<section class="panel"><div class="panel-h"><h3>Your sign-off history</h3></div><div class="panel-b stack" style="gap:8px">
        ${p.signoffs.filter(s => s.status !== 'sent').map(s => `<div class="so-ver"><b>${esc(s.title)}</b><span class="small muted">${esc(s.stage)} · version ${s.version} ·
          ${s.status === 'approved' ? `signed by ${esc(s.signer_name)} on ${fmtStamp(s.responded_at)}` : `you asked for changes on ${fmtStamp(s.responded_at)}: “${esc(s.response_comment)}”`}</span></div>`).join('')}</div></section>` : ''}
    </div>`;
  }
};

V.projects = {
  load: async () => { ui.data.projects = await API.projects(); },
  html: () => {
    const list = ui.data.projects || [];
    return `<div data-testid="projects-view"><div class="head"><div><h1>Projects</h1><div class="sub">${list.length} residential project${list.length === 1 ? '' : 's'}${ui.me.role === 'architect' || ui.me.role === 'team_lead' ? '' : ' you are a member of'}</div></div>
      ${can.create() ? `<button class="btn primary" data-go="new-project" data-testid="new-project-btn">${ico('plus')}New project</button>` : ''}</div>
      ${list.length ? `<div class="pcards">${list.map(projectCard).join('')}</div>` : `<section class="panel"><div class="empty">No projects yet.${can.create() ? ' Create the first one.' : ''}</div></section>`}</div>`;
  }
};

V['new-project'] = {
  load: async () => { ui.data.engineers = await API.engineers(); },
  html: () => {
    const eng = ui.data.engineers || [];
    const f = ui.p.form || {};
    return `<div class="crumbs"><button data-go="projects">Projects</button>/<span>New project</span></div>
    <div class="head"><div><h1>New project</h1><div class="sub">Residential template: Legal Approval, then Site Visit, then Team Lead Review.</div></div></div>
    ${errBox()}
    <form class="sec" data-form="new-project"><div class="sec-h"><h3>Project</h3></div><div class="sec-b"><div class="fgrid">
      <div class="field"><label for="np-name">Project name <span class="req">Required</span></label><input id="np-name" data-testid="np-name" value="${esc(f.name)}" placeholder="e.g. Pashan Residence"></div>
      <div class="field"><label for="np-loc">Location <span class="req">Required</span></label><input id="np-loc" data-testid="np-location" value="${esc(f.location)}" placeholder="Plot, road, area, city"></div>
      <div class="field"><label for="np-eng">Civil Engineer <span class="req">Required</span></label><select id="np-eng" data-testid="np-engineer">${eng.map(u => `<option value="${u.id}" ${String(u.id) === String(f.civil_engineer_id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="np-date">Legal Approval expected by</label><input id="np-date" data-testid="np-legal-date" type="date" value="${esc(f.legal_expected_date)}"></div>
      <div class="field full"><button class="btn primary" type="submit" data-testid="np-submit">Create project</button></div>
    </div></div></form>`;
  }
};

V.project = {
  load: async () => {
    const [p, visits, problems, stages, clients] = await Promise.all([API.project(ui.p.pid), API.visits ? API.visits(ui.p.pid) : null,
      API.problems ? API.problems(ui.p.pid) : null, API.stages ? API.stages(ui.p.pid) : null,
      API.projectClients ? API.projectClients(ui.p.pid) : null]);
    ui.data.project = p; ui.data.visits = visits; ui.data.problems = problems; ui.data.stages = stages; ui.data.clients = clients;
    ui.data.signoffs = API.signoffs ? await API.signoffs(ui.p.pid) : [];
  },
  html: () => {
    const p = ui.data.project;
    const cur = p.steps.find(s => s.status === 'active');
    return `<div class="crumbs"><button data-go="projects">Projects</button>/<span>${esc(p.name)}</span></div>
    <div class="head"><div><h1 data-testid="project-title">${esc(p.name)}</h1><div class="sub">${esc(p.location)}</div></div>
      <div class="row">${p.phase ? `<span class="pill active" data-testid="project-phase">Phase ${p.phase.number} · ${esc(p.phase.name)}</span>` : ''}${p.visit_number ? `<span class="pill" data-testid="visit-number">Visit ${p.visit_number}</span>` : ''}<span class="pill">Residential v${p.template.version}</span><span class="pill ${cur ? 'active' : 'done'}" data-testid="official-progress">Official progress ${pct(p.official_progress)}</span></div></div>
    ${ui.data.stages ? stageTracker(ui.data.stages) : ''}
    <h2 class="section-h">Construction: Legal Approval, site visits and review</h2>
    <div class="panel stepper-wrap"><ol class="stepper" style="padding:4px 16px">${p.steps.map(s => `<li class="st st-${s.status === 'completed' ? 'done' : s.status}" data-testid="step-${s.order}"><button type="button"><span class="st-n">${s.status === 'completed' ? ico('check') : s.order}</span><span class="st-l">${esc(s.name)}</span><span class="st-s">${STEP_LABEL[s.status]}</span></button></li>`).join('')}</ol></div>
    ${errBox()}
    <div class="grid2">
      <div class="steps">${legalCard(p)}${visitCard(p)}${reviewCard(p)}${ui.data.problems ? problemsPanel(ui.data.problems) : ''}</div>
      <div class="stack">
        <section class="panel"><div class="panel-h"><h3>Project</h3></div><div class="panel-b"><dl class="kv">
          <dt>Location</dt><dd>${esc(p.location)}</dd>
          <dt>Civil Engineer</dt><dd>${esc(p.civil_engineer ? p.civil_engineer.name : '—')}</dd>
          <dt>Template</dt><dd>Residential v${p.template.version}</dd></dl></div></section>
        ${ui.data.clients ? clientPanel(ui.data.clients) : ''}
        ${ui.data.visits ? visitHistory(ui.data.visits) : ''}
        <section class="panel"><div class="panel-h"><h3>Audit trail</h3></div><div class="panel-b audit" data-testid="audit-list">${p.audit.slice().reverse().map(e => `<div><span class="mono muted small">${fmtStamp(e.at)}</span><span>${esc(auditText(e))} <span class="muted">· ${esc(e.actor || 'SiteFlow')}</span></span></div>`).join('')}</div></section>
      </div>
    </div>`;
  }
};

/* Open problems from approved visits, tracked until the engineer or Parvez resolves them. */
function problemsPanel(list){
  const open = list.filter(x => x.status === 'open'), done = list.filter(x => x.status === 'resolved');
  const todayYmd = today();  // the device's local date
  const canResolve = ui.me.role === 'civil_engineer' || ui.me.role === 'team_lead';
  const row = x => {
    const resolving = ui.p.resolving === x.id, overdue = x.status === 'open' && x.target_date < todayYmd;
    return `<div class="prob" data-testid="problem-item-${x.id}">
      ${x.photo_id ? `<button class="major-thumb" data-act="open-photo" data-mid="${x.photo_id}" aria-label="Open photo"><img data-mid="${x.photo_id}" alt="Photo of the problem"></button>` : `<span class="fic">${ico('alert')}</span>`}
      <div class="prob-b"><div class="row" style="justify-content:space-between"><b>${esc(x.problem)}</b>${pill(['High', 'Critical'].includes(x.severity) ? 'rework' : 'active', x.severity)}</div>
        <div class="small muted">${esc(x.category)} · ${esc(x.location)} · ${esc(x.responsible_party)} · <span class="${overdue ? 'overdue-text' : ''}">fix by ${fmtDate(x.target_date)}${overdue ? ' (overdue)' : ''}</span></div>
        ${x.status === 'resolved' ? `<div class="small"><b>Resolved</b> by ${esc(x.resolved_by ? x.resolved_by.name : '')} ${fmtStamp(x.resolved_at)}: ${esc(x.resolution_note)}</div>` : ''}
        ${x.status === 'open' && canResolve && !resolving ? `<div><button class="btn sm" data-act="resolve" data-id="${x.id}" data-testid="resolve-${x.id}">${ico('check')}Resolve</button></div>` : ''}
        ${resolving ? `<div class="flag-clear-form"><input class="inp" id="rs-${x.id}" data-testid="resolve-note-${x.id}" placeholder="How was it fixed?" aria-label="How was it fixed?">
          <button class="btn sm primary" data-act="resolve-confirm" data-id="${x.id}" data-testid="resolve-confirm-${x.id}">Mark resolved</button>
          <button class="btn sm ghost" data-act="resolve-cancel">Cancel</button></div>` : ''}
      </div></div>`;
  };
  return `<section class="panel" data-testid="problems-panel"><div class="panel-h"><h3>${ico('alert')}Open problems</h3><span class="small muted">${open.length} open</span></div>
    <div class="panel-b stack" style="gap:12px">${open.length ? open.map(row).join('') : '<span class="small muted">No open problems.</span>'}
    ${done.length ? `<details data-testid="resolved-problems"><summary class="small">Resolved (${done.length})</summary><div class="stack" style="gap:12px;margin-top:10px">${done.map(row).join('')}</div></details>` : ''}</div></section>`;
}

/* ---------- client sign-off packages (Architect) ---------- */
const SIGNOFF_LABEL = {draft: 'Draft', sent: 'Sent', approved: 'Approved', changes_requested: 'Changes requested'};
const SIGNOFF_PILL = {draft: '', sent: 'submitted', approved: 'done', changes_requested: 'rework'};
function signoffComposer(stage){
  const history = (ui.data.signoffs || []).filter(r => r.stage_key === stage.key);
  const last = history[history.length - 1];
  const open = last && (last.status === 'draft' || last.status === 'sent') ? last : null;
  const canPrepare = can.create() && stage.state !== 'completed' && !open;
  const next = last ? last.version + 1 : 1;
  const hist = history.slice().reverse().map(r => `<div class="so-ver" data-testid="signoff-version-${r.version}">
    <div class="row" style="justify-content:space-between"><b>Version ${r.version} · ${esc(SIGNOFF_LABEL[r.status])}</b>${pill(SIGNOFF_PILL[r.status], SIGNOFF_LABEL[r.status])}</div>
    <div class="small muted">${esc(r.title)}${r.sent_at ? ` · sent ${fmtStamp(r.sent_at)}` : ''} · ${r.attachments.length} document${r.attachments.length === 1 ? '' : 's'}</div>
    ${r.status === 'approved' ? `<div class="small"><b>Signed by ${esc(r.signer_name)}</b> ${fmtStamp(r.responded_at)} in the client app.</div>` : ''}
    ${r.status === 'changes_requested' ? `<div class="small"><b>The client asked for changes</b> ${fmtStamp(r.responded_at)}: “${esc(r.response_comment)}”</div>` : ''}</div>`).join('');
  return `<div class="signoff" data-testid="signoff-composer"><div class="subh">Client sign-off</div>
    ${!history.length ? `<p class="small muted">No sign-off package yet.${canPrepare ? ' Prepare one for the client to review and sign in the client app.' : ''}</p>` : ''}
    ${open && open.status === 'draft' && can.create() ? draftEditor(open) : ''}
    ${open && open.status === 'sent' ? `<div class="banner info">${ico('eye')}<span><b>Version ${open.version} · Sent</b> ${fmtStamp(open.sent_at)}. Waiting for the client to review and sign off.</span></div>` : ''}
    ${canPrepare ? `<div class="form so-form"><b class="small">Prepare version ${next}</b>
      <div class="field"><label for="so-title-${stage.key}">Title the client sees</label><input id="so-title-${stage.key}" data-testid="signoff-title" value="${esc(last ? last.title.replace(/version \d+/i, 'version ' + next) : '')}"></div>
      <div class="field"><label for="so-sum-${stage.key}">Summary for the client</label><textarea id="so-sum-${stage.key}" rows="3" data-testid="signoff-summary">${esc(last ? last.summary : '')}</textarea></div>
      ${last ? '<p class="small muted">Attach the updated documents to the new version.</p>' : ''}
      <button class="btn sm primary" data-act="signoff-create" data-key="${stage.key}" data-testid="signoff-create">${ico('plus')}Create version ${next}</button></div>` : ''}
    ${hist ? `<div class="so-hist">${hist}</div>` : ''}
  </div>`;
}
function draftEditor(r){
  return `<div class="form so-form" data-testid="signoff-draft"><b class="small">Version ${r.version} · Draft: ${esc(r.title)}</b>
    <p class="small">${esc(r.summary)}</p>
    <div class="mlist" data-testid="signoff-attachments">${r.attachments.map(a => `<div class="mitem">${ico(a.content_type === 'application/pdf' ? 'doc' : 'image')}<span>${esc(a.filename)}</span>
      <span class="muted mono small">${(a.size / 1024).toFixed(0)} KB</span><button class="x" data-act="signoff-remove" data-id="${r.id}" data-aid="${a.id}" aria-label="Remove">${ico('x')}</button></div>`).join('') || '<span class="small muted">No documents yet.</span>'}</div>
    <div class="row"><button class="btn sm" data-act="signoff-attach" data-id="${r.id}" data-testid="signoff-attach">${ico('doc')}Attach PDF or image</button>
      <button class="btn sm primary" data-act="signoff-send" data-id="${r.id}" data-testid="signoff-send" ${r.attachments.length ? '' : 'disabled'}>${ico('check')}Send to client</button></div>
    <p class="small muted">Once sent, this version cannot change. The client must open every document before signing.</p></div>`;
}
async function reloadSignoffs(){ ui.data.signoffs = await API.signoffs(ui.data.project.id); }

/* The client who tracks the project and signs off milestones in the client app. */
function clientPanel(clients){
  const inv = ui.data.invite;
  return `<section class="panel" data-testid="client-panel"><div class="panel-h"><h3>Client</h3></div><div class="panel-b stack" style="gap:12px">
    ${clients.length ? clients.map(c => `<div class="person"><span class="av">${esc(initials(c.name))}</span><div><b>${esc(c.name)}</b>
      <div class="small muted">${esc(c.email)} · ${pill(c.status === 'active' ? 'done' : 'active', c.status === 'active' ? 'Active' : 'Invited')}</div></div></div>`).join('')
      : '<span class="small muted">No client invited yet.</span>'}
    ${inv && inv.code ? `<div class="banner info invite-code-box"><span><b>Invite code for ${esc(inv.client.name)}:</b>
      <span class="mono code-text" data-testid="invite-code">${esc(inv.code)}</span>
      <button class="btn sm" data-act="copy-code">Copy</button><br>
      <span class="small">Share this code with the client yourself; SiteFlow does not send it. It works once and expires ${fmtStamp(inv.expires_at)}.
      The client opens SiteFlow, taps “I have an invite code” and chooses a password.</span></span></div>`
      : inv ? `<div class="banner ok"><span>${esc(inv.client.name)} already uses the client app and can now see this project.</span></div>` : ''}
    ${can.create() ? `<div class="fgrid">
      <div class="field"><label for="iv-name">Client name</label><input id="iv-name" data-testid="invite-name" placeholder="As they will sign"></div>
      <div class="field"><label for="iv-email">Client email</label><input id="iv-email" data-testid="invite-email" type="email"></div>
      <div class="field full"><button class="btn" data-act="invite-client" data-testid="invite-submit">${ico('plus')}${clients.length ? 'Invite or re-invite' : 'Invite client'}</button></div></div>` : ''}
  </div></section>`;
}

/* ---------- stage tracker (the 18-stage residential flow) ---------- */
const STAGE_STATE = {completed: ['done', 'Done'], historical: ['', 'Historical'], active: ['active', 'In progress'],
  blocked: ['rework', 'Blocked'], locked: ['', 'Locked']};
function stageTracker(view){
  return `<section class="panel tracker" data-testid="stage-tracker"><div class="panel-h"><h2>Project stages</h2>
      <span class="small muted" data-testid="stage-progress">${view.stage_progress.done} of ${view.stage_progress.total} done</span></div>
    <div class="phases">${view.phases.map(phaseBlock).join('')}</div></section>`;
}
function phaseBlock(ph){
  const lanes = [...new Set(ph.stages.map(s => s.workstream).filter(w => w !== 'Both'))];
  const done = ph.stages.every(s => s.state === 'completed' || s.state === 'historical');
  const current = ph.stages.some(s => s.state === 'active' || s.state === 'blocked');
  let body;
  if (lanes.length > 1){
    // The two pre-design workstreams run in parallel: one column each.
    body = `<div class="lanes">${['Site', 'Studio'].map(w => `<div class="lane"><div class="eyebrow">${w} workstream</div>${ph.stages.filter(s => s.workstream === w).map(stageChip).join('')}</div>`).join('')}</div>`;
  } else {
    // Stages sharing a number (8A, 8B) run in parallel: one row.
    const rows = [];
    ph.stages.forEach(s => { const k = s.number ? s.number.replace(/[A-Z]$/, '') : s.key; const last = rows[rows.length - 1];
      if (last && last.k === k) last.items.push(s); else rows.push({k, items: [s]}); });
    body = rows.map(r => `<div class="srow">${r.items.map(stageChip).join('')}</div>`).join('');
  }
  const open = ph.stages.find(s => s.key === ui.p.openStage);
  return `<div class="phase ${done ? 'phase-done' : current ? 'phase-cur' : ''}" data-testid="phase-${ph.number}">
    <div class="phase-h"><span class="phase-n">${ph.number}</span><b>${esc(ph.name)}</b>${done ? `<span class="small muted">· complete</span>` : ''}</div>
    ${body}${open ? stageDetail(open) : ''}</div>`;
}
function stageChip(s){
  const [cls, label] = STAGE_STATE[s.state];
  return `<button class="stage st-${s.state} ${ui.p.openStage === s.key ? 'open' : ''}" data-act="open-stage" data-key="${s.key}" data-testid="stage-${s.key}" aria-expanded="${ui.p.openStage === s.key}">
    <span class="stage-n">${s.number ? esc(s.number) : ico('flow')}</span>
    <span class="stage-b"><b>${esc(s.label)}</b><span class="small muted">${esc(s.workstream)} · ${esc(ROLES[s.owner_role] || s.owner_role)}${s.signed_by_client ? ' · signed by the client' : ''}</span></span>
    ${pill(cls, label)}</button>`;
}
function stageDetail(s){
  return `<div class="stage-detail" data-testid="stage-detail-${s.key}">
    <p class="small">${esc(s.detail)}</p>
    ${s.reasons.length ? `<ul class="reasons">${s.reasons.map(r => `<li>${ico('alert')}<span>${esc(r)}</span></li>`).join('')}</ul>` : ''}
    ${s.historical ? `<div class="banner info">${ico('flag')}<span><b>${esc(s.historical.label)}</b>. Confirmed by ${esc(s.historical.confirmed_by || 'not recorded')}. ${esc(s.historical.note || '')}</span></div>` : ''}
    ${s.state === 'completed' ? `<div class="small"><b>Completed</b> ${fmtStamp(s.completed_at)}${s.completed_by ? ` by ${esc(s.completed_by.name)}` : ''}${s.completion_note ? `: ${esc(s.completion_note)}` : ''}</div>` : ''}
    ${s.gate === 'client_signoff' && s.state !== 'historical' ? signoffComposer(s) : ''}
    ${s.can_complete ? `<div class="flag-clear-form"><input class="inp" id="st-note-${s.key}" data-testid="stage-note-${s.key}" placeholder="What was completed? (required)" aria-label="Completion note">
      <button class="btn sm primary" data-act="stage-complete" data-key="${s.key}" data-testid="stage-complete-${s.key}">${ico('check')}Mark complete</button></div>` : ''}
  </div>`;
}

function visitHistory(visits){
  const approved = visits.filter(v => v.status === 'approved');
  return `<section class="panel" data-testid="visit-history"><div class="panel-h"><h3>Visit history</h3><span class="small muted">${approved.length} approved</span></div>
    ${visits.length ? `<div class="tasks">${visits.map((v, i) => `<button class="task" data-act="open-review" data-vid="${v.id}" data-testid="history-${v.id}">
      <span class="ti">${ico(v.status === 'approved' ? 'check' : 'camera')}</span>
      <span><b>Visit ${visits.length - i} · ${esc(v.current_stage || '')}</b><span class="small muted">${esc(v.engineer ? v.engineer.name : '')} · ${v.status === 'approved' ? `approved ${fmtStamp(v.approved_at)}` : `submitted ${fmtStamp(v.submitted_at)}`}</span></span>
      <span class="meta">${pill(VISIT_PILL[v.status], VISIT_LABEL[v.status])}<span class="mono small">${pct(v.computed_progress)}</span></span></button>`).join('')}</div>`
      : '<div class="empty">No visits submitted yet.</div>'}</section>`;
}

function stepCard(p, order, kind, owner, body){
  const s = p.steps.find(x => x.order === order);
  return `<div class="scard ${s.status === 'active' ? 'cur' : ''}"><div><div class="eyebrow">Step ${order} · ${kind}</div><h3 style="margin:2px 0">${esc(s.name)}</h3><div class="who">${esc(owner)}</div></div>
    <div class="row">${pill(STEP_PILL[s.status], STEP_LABEL[s.status])}</div>
    ${body ? `<div style="grid-column:1/-1">${body}</div>` : ''}</div>`;
}

function legalCard(p){
  const la = p.legal_approval;
  const summary = `<dl class="kv" data-testid="legal-summary">
    <dt>Status</dt><dd>${esc(la.status)}</dd>
    <dt>Authority</dt><dd>${esc(la.authority_name || '—')}</dd>
    <dt>Reference</dt><dd>${esc(la.application_reference || '—')}</dd>
    <dt>Applied</dt><dd>${fmtDate(la.application_date)}</dd>
    <dt>Approved</dt><dd>${fmtDate(la.approval_date)}</dd>
    <dt>Expected by</dt><dd>${fmtDate(la.expected_date)}</dd>
    <dt>Document</dt><dd>${esc(la.document_reference || '—')}</dd></dl>`;
  const next = LEGAL_NEXT[la.status];
  const d = ui.data.legalDraft || {};
  const val = k => d[k] !== undefined ? d[k] : la[k];
  const chosen = d.status || la.status;
  const form = can.legal() && next ? `<form class="form" data-form="legal" data-testid="legal-form" style="margin-top:14px;border-top:1px solid var(--line-2);padding-top:14px">
    <div class="fgrid">
      <div class="field"><label for="lg-status">Status</label><select id="lg-status" data-testid="legal-status">${[la.status, ...next].map(s => `<option ${s === chosen ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
      <div class="field"><label for="lg-auth">Authority name</label><input id="lg-auth" data-testid="legal-authority" value="${esc(val('authority_name'))}"></div>
      <div class="field"><label for="lg-ref">Application reference</label><input id="lg-ref" data-testid="legal-reference" value="${esc(val('application_reference'))}"></div>
      <div class="field"><label for="lg-adate">Application date</label><input id="lg-adate" type="date" data-testid="legal-app-date" value="${esc(val('application_date'))}"></div>
      <div class="field"><label for="lg-pdate">Approval date</label><input id="lg-pdate" type="date" data-testid="legal-approval-date" value="${esc(val('approval_date'))}"></div>
      <div class="field"><label for="lg-doc">Approval document <span class="req">Required for Approved</span></label><input id="lg-doc" data-testid="legal-document" value="${esc(val('document_reference'))}" placeholder="Link or file reference"></div>
    </div>
    <div class="row"><button class="btn primary" type="submit" data-testid="legal-save">Save Legal Approval</button><span class="small muted" id="lg-hint"></span></div>
  </form>` : '';
  return stepCard(p, 1, 'Legal Approval', 'Admin', summary + form);
}

function visitCard(p){
  const v = p.latest_visit;
  const open = p.steps.find(s => s.order === 2).status === 'active';
  const rework = v && v.status === 'rework' && v.rework_comment ? `<div class="banner rework" data-testid="rework-comment" style="margin-bottom:10px">${ico('alert')}<span><b>Rework requested:</b> ${esc(v.rework_comment)}</span></div>` : '';
  const action = can.visit() && open ? `<button class="btn primary sm" style="margin-top:10px" data-act="start-visit" data-pid="${p.id}" data-testid="visit-start">${ico('camera')}${v && v.status === 'rework' ? 'Resubmit site visit' : readDraft(p.id) ? 'Continue site visit' : 'Start site visit'}</button>` : '';
  const body = rework + (v ? `<dl class="kv"><dt>Latest visit</dt><dd>${pill(VISIT_PILL[v.status], VISIT_LABEL[v.status])}</dd>
    <dt>Submissions</dt><dd>${v.submission_count}</dd><dt>Derived progress</dt><dd data-testid="visit-progress">${pct(v.computed_progress)}${v.status === 'approved' ? '' : ' (pending approval)'}</dd></dl>` : '<span class="small muted">No site visit submitted yet.</span>') + action;
  return stepCard(p, 2, 'Site Visit', p.civil_engineer ? `${p.civil_engineer.name} · Civil Engineer` : 'Civil Engineer', body);
}

function reviewCard(p){
  const v = p.latest_visit;
  const waiting = p.steps.find(s => s.order === 3).status === 'active' && v && v.status === 'submitted';
  const body = can.review() && waiting ? `<button class="btn primary sm" data-act="open-review" data-vid="${v.id}" data-testid="review-open">${ico('eye')}Review submission</button>` : '';
  return stepCard(p, 3, 'Team Lead Review', 'Parvez · Team Lead', body);
}

/* ---------- site visit (Civil Engineer) ---------- */
let TEMPLATE = null;
const MEDIA = typeof API.uploadMedia === 'function';
const visitMedia = () => (ui.data.server && ui.data.server.media) || [];
const photosOf = ref => visitMedia().filter(m => m.kind === 'photo' && m.problem_ref === ref);
const needsPhoto = p => p.severity === 'High' || p.severity === 'Critical';
async function template(){ if (!TEMPLATE) TEMPLATE = await API.template(); return TEMPLATE; }
const draftKey = pid => `siteflow.draft.${ui.me.id}.${pid}`;
function readDraft(pid){ try { return JSON.parse(localStorage.getItem(draftKey(pid)) || 'null'); } catch (_) { return null; } }
function saveDraft(){ try { localStorage.setItem(draftKey(ui.p.pid), JSON.stringify(ui.data.draft)); ui.data.savedAt = Date.now(); } catch (_) {} const l = $('#savedlbl'); if (l) l.textContent = 'Draft saved on this device'; }
function dropDraft(pid){ try { localStorage.removeItem(draftKey(pid)); } catch (_) {} }
const localNow = () => { const d = new Date(); d.setSeconds(0, 0); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
const toLocalInput = iso => { const d = new Date(iso); return isNaN(d) ? localNow() : new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
const blankProblem = () => ({category: '', problem: '', other_text: '', severity: '', location: '', responsible_party: '', target_date: ''});

function draftFromVisit(v){
  const f = v.form || {}, loc = f.location || {};
  return {visit_at: localNow(), gps: loc.gps || null, manual: loc.manual || '', weather: f.weather || '', attendees: f.attendees || '',
    current_stage: v.current_stage || '', checklist: {...(v.checklist || {})}, no_issues: !!v.no_issues,
    problems: (v.problems || []).map(p => ({...blankProblem(), ...Object.fromEntries(Object.entries(p).map(([k, x]) => [k, x ?? '']))})),
    summary: f.summary || '', recommended_action: f.recommended_action || ''};
}
const emptyDraft = () => ({visit_at: localNow(), gps: null, manual: '', weather: '', attendees: '', current_stage: '', checklist: {},
  no_issues: false, problems: [], summary: '', recommended_action: ''});

const PROBLEM_LABELS = {category: 'category', problem: 'problem', other_text: 'description', severity: 'severity',
  location: 'location on site', responsible_party: 'responsible party', target_date: 'target fix date',
  photo: 'photo of the problem (High and Critical)'};
function visitLabel(path){
  const fixed = {visit_at: 'Visit date and time', location: 'Location (GPS or manual entry)', 'location.gps': 'GPS coordinates',
    weather: 'Weather', attendees: 'Attendees', current_stage: 'Construction stage', problems: 'Problems, or tick “No issues found”',
    no_issues: '“No issues found” cannot be ticked while problems are listed', summary: 'Summary', recommended_action: 'Recommended action'};
  if (fixed[path]) return fixed[path];
  if (path === 'photos'){
    const n = visitMedia().filter(x => x.kind === 'photo').length;
    return `Photos: at least ${TEMPLATE ? TEMPLATE.min_photos : ''} (${n} added)`;
  }
  let m = path.match(/^checklist\.(.+)$/);
  if (m){ const it = (TEMPLATE ? TEMPLATE.stages.flatMap(s => s.checklist) : []).find(i => i.id === m[1]); return `Checklist: ${it ? it.label : m[1]}`; }
  m = path.match(/^problems\[(\d+)\]\.(.+)$/);
  if (m) return `Problem ${+m[1] + 1}: ${PROBLEM_LABELS[m[2]] || m[2]}`;
  return path;
}

/* Mirrors the server's validation so the engineer sees what is missing before submitting. */
function visitMissing(d){
  const miss = [];
  const blank = v => !String(v ?? '').trim();
  if (blank(d.visit_at)) miss.push('visit_at');
  if (!d.gps && blank(d.manual)) miss.push('location');
  ['weather', 'attendees', 'current_stage'].forEach(k => { if (blank(d[k])) miss.push(k); });
  const stage = TEMPLATE.stages.find(s => s.name === d.current_stage);
  if (stage) stage.checklist.forEach(i => { if (!d.checklist[i.id]) miss.push('checklist.' + i.id); });
  if (!d.no_issues && !d.problems.length) miss.push('problems');
  if (d.no_issues && d.problems.length) miss.push('no_issues');
  d.problems.forEach((p, n) => {
    const at = `problems[${n}]`;
    if (blank(p.category)) miss.push(at + '.category');
    else if (p.category === 'Other'){ if (blank(p.other_text)) miss.push(at + '.other_text'); }
    else if (blank(p.problem)) miss.push(at + '.problem');
    ['severity', 'location', 'responsible_party', 'target_date'].forEach(k => { if (blank(p[k])) miss.push(`${at}.${k}`); });
  });
  if (MEDIA){
    if (visitMedia().filter(m => m.kind === 'photo').length < TEMPLATE.min_photos) miss.push('photos');
    d.problems.forEach((p, n) => { if (needsPhoto(p) && !photosOf(n).length) miss.push(`problems[${n}].photo`); });
  }
  ['summary', 'recommended_action'].forEach(k => { if (blank(d[k])) miss.push(k); });
  return miss;
}

function visitPayload(d){
  const s = v => (String(v ?? '').trim() || null);
  const stage = TEMPLATE.stages.find(x => x.name === d.current_stage);
  const ids = stage ? stage.checklist.map(i => i.id) : [];
  return {
    visit_at: d.visit_at ? new Date(d.visit_at).toISOString() : null,
    location: {gps: d.gps, manual: s(d.manual)},
    weather: s(d.weather), attendees: s(d.attendees), current_stage: s(d.current_stage),
    checklist: Object.fromEntries(Object.entries(d.checklist).filter(([k]) => ids.includes(k))),
    no_issues: d.no_issues,
    problems: d.problems.map(p => ({category: s(p.category), problem: p.category === 'Other' ? null : s(p.problem),
      other_text: p.category === 'Other' ? s(p.other_text) : null, severity: s(p.severity), location: s(p.location),
      responsible_party: s(p.responsible_party), target_date: s(p.target_date)})),
    summary: s(d.summary), recommended_action: s(d.recommended_action)
  };
}

V.visit = {
  load: async () => {
    const [p] = await Promise.all([API.project(ui.p.pid), template()]);
    ui.data.project = p;
    const last = p.latest_visit;
    ui.data.rework = last && last.status === 'rework' ? last : null;
    let d = readDraft(p.id);
    if (!d && ui.data.rework) d = draftFromVisit(await API.visit(last.id));
    ui.data.draft = d || emptyDraft();
    // Photos and video attach to a visit on the server; the typed fields stay on the device.
    const stepOpen = p.steps.find(s => s.order === 2).status === 'active';
    ui.data.server = MEDIA && stepOpen ? await API.openDraft(p.id) : null;
    ui.data.uploads = [];
  },
  html: () => {
    const p = ui.data.project, d = ui.data.draft, T = TEMPLATE;
    const open = p.steps.find(s => s.order === 2).status === 'active';
    if (!open) return `<div class="crumbs"><button data-act="open-project" data-pid="${p.id}">${ico('back')}${esc(p.name)}</button></div><section class="panel"><div class="empty">The Site Visit step is not open for this project.</div></section>`;
    const stage = T.stages.find(s => s.name === d.current_stage);
    const opt = (list, val, ph) => `<option value="">${esc(ph || 'Select')}</option>` + list.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('');
    const miss = visitMissing(d);
    return `<div class="crumbs"><button data-act="open-project" data-pid="${p.id}">${ico('back')}${esc(p.name)}</button>/<span>Site visit</span></div>
    <div class="head"><div><div class="eyebrow">Step 2 · Site Visit</div><h1>Site visit</h1><div class="sub">${esc(p.name)} · ${esc(p.location)}</div></div></div>
    ${ui.data.rework && ui.data.rework.rework_comment ? `<div class="banner rework" data-testid="rework-banner" style="margin-bottom:14px">${ico('alert')}<span><b>Rework requested by Parvez:</b> ${esc(ui.data.rework.rework_comment)}</span></div>` : ''}
    ${errBox()}
    <div class="act"><div class="form">
      <section class="sec"><div class="sec-h"><h3>${ico('form')}Visit details</h3></div><div class="sec-b"><div class="fgrid">
        <div class="field"><label for="v-at">Date and time <span class="req">Required</span></label><input id="v-at" type="datetime-local" data-v="visit_at" data-testid="visit-at" value="${esc(d.visit_at)}"></div>
        <div class="field"><label for="v-wx">Weather <span class="req">Required</span></label><input id="v-wx" data-v="weather" data-testid="visit-weather" value="${esc(d.weather)}" placeholder="e.g. Clear, light rain"></div>
        <div class="field full"><label for="v-att">Attendees <span class="req">Required</span></label><input id="v-att" data-v="attendees" data-testid="visit-attendees" value="${esc(d.attendees)}" placeholder="Names and roles"></div>
      </div></div></section>
      <section class="sec"><div class="sec-h"><h3>${ico('pin')}Location <span class="req">Required</span></h3></div><div class="sec-b form">
        ${d.gps ? `<div class="gps"><span class="coord">${d.gps.lat.toFixed(5)}, ${d.gps.lng.toFixed(5)}</span><span class="small muted">Device GPS</span><button class="btn sm ghost" data-act="clear-gps">Clear</button></div>`
          : `<div class="row"><button class="btn" data-act="gps" data-testid="visit-gps">${ico('pin')}Capture GPS</button><span class="small muted">or describe the location below</span></div>`}
        <div class="field"><label for="v-man">Manual location</label><input id="v-man" data-v="manual" data-testid="visit-location-manual" value="${esc(d.manual)}" placeholder="Plot, landmark, area"></div>
      </div></section>
      ${MEDIA ? photosSection() : ''}
      <section class="sec"><div class="sec-h"><h3>${ico('flow')}Construction stage <span class="req">Required</span></h3></div><div class="sec-b form">
        <div class="field"><label for="v-stage">Current stage</label><select id="v-stage" data-v="current_stage" data-rerender="1" data-testid="visit-stage">${opt(T.stages.map(s => s.name), d.current_stage, 'Select stage')}</select></div>
        ${stage ? `<div class="checks">${stage.checklist.map(i => `<div class="chk" style="justify-content:space-between;cursor:default"><span>${esc(i.label)}</span><select class="inp" style="width:auto" data-chk="${esc(i.id)}" data-testid="checklist-${esc(i.id)}">${opt(T.checklist_states, d.checklist[i.id], 'State')}</select></div>`).join('')}</div>` : '<span class="small muted">Pick a stage to see its checklist.</span>'}
      </div></section>
      <section class="sec"><div class="sec-h"><h3>${ico('alert')}Problems</h3><button class="btn sm" data-act="add-problem" data-testid="visit-add-problem" ${d.no_issues ? 'disabled' : ''}>${ico('plus')}Add problem</button></div><div class="sec-b form">
        <label class="chk"><input type="checkbox" data-v="no_issues" data-rerender="1" data-testid="visit-no-issues" ${d.no_issues ? 'checked' : ''} ${d.problems.length ? 'disabled' : ''}><span>No issues found</span></label>
        ${d.problems.map((pr, n) => `<div class="bbox" data-testid="problem-${n}">
          <div class="subh">Problem ${n + 1}<button class="btn icon ghost" data-act="del-problem" data-n="${n}" aria-label="Remove problem">${ico('trash')}</button></div>
          <div class="fgrid">
            <div class="field"><label>Category</label><select data-p="${n}.category" data-rerender="1" data-testid="problem-${n}-category">${opt(Object.keys(T.problems), pr.category)}</select></div>
            ${pr.category === 'Other' ? `<div class="field"><label>Describe the problem</label><input data-p="${n}.other_text" data-testid="problem-${n}-other" value="${esc(pr.other_text)}"></div>`
              : `<div class="field"><label>Problem</label><select data-p="${n}.problem" data-testid="problem-${n}-problem" ${pr.category ? '' : 'disabled'}>${opt(T.problems[pr.category] || [], pr.problem)}</select></div>`}
            <div class="field"><label>Severity</label><select data-p="${n}.severity" data-testid="problem-${n}-severity">${opt(T.severities, pr.severity)}</select></div>
            <div class="field"><label>Location on site</label><input data-p="${n}.location" data-testid="problem-${n}-location" value="${esc(pr.location)}"></div>
            <div class="field"><label>Responsible party</label><input data-p="${n}.responsible_party" data-testid="problem-${n}-party" value="${esc(pr.responsible_party)}"></div>
            <div class="field"><label>Target fix date</label><input type="date" data-p="${n}.target_date" data-testid="problem-${n}-date" value="${esc(pr.target_date)}"></div>
          </div>
          ${MEDIA ? `<div class="subh">Photos of this problem${needsPhoto(pr) ? ' <span class="req">Required for High and Critical</span>' : ''}</div>
          <div class="photos">${photosOf(n).map(mediaTile).join('')}${pendingTiles(n)}
            <button class="addph" data-act="pick-media" data-kind="photo" data-ref="${n}" data-capture="1" data-testid="problem-${n}-photo">${ico('camera')}Add photo</button></div>` : ''}
          </div>`).join('')}
      </div></section>
      <section class="sec"><div class="sec-h"><h3>${ico('doc')}Summary</h3></div><div class="sec-b"><div class="fgrid">
        <div class="field full"><label for="v-sum">Summary <span class="req">Required</span></label><textarea id="v-sum" rows="3" data-v="summary" data-testid="visit-summary">${esc(d.summary)}</textarea></div>
        <div class="field full"><label for="v-act">Recommended action <span class="req">Required</span></label><textarea id="v-act" rows="3" data-v="recommended_action" data-testid="visit-action">${esc(d.recommended_action)}</textarea></div>
      </div></div></section>
    </div>
    <div class="panel reqpanel" id="reqpanel">${reqPanel(miss)}</div></div>
    <div class="submitbar"><span class="small" id="sb-lbl">${sbLabel(miss)}</span><button class="btn primary" data-act="submit-visit" data-testid="visit-submit-mobile" ${miss.length ? 'disabled' : ''}>${ico('check')}Submit</button></div>`;
  }
};
function mediaTile(m){
  const tag = m.problem_ref != null ? `<span class="ph-tag">Problem ${m.problem_ref + 1}</span>` : '';
  const body = m.kind === 'photo' ? `<img data-mid="${m.id}" alt="Site photo taken ${esc(fmtStamp(m.captured_at))}">`
    : `<div class="ph-video">${ico('video')}<span>Video · ${(m.size / 1048576).toFixed(1)} MB</span></div>`;
  return `<div class="ph" data-testid="media-${m.id}" title="${esc(fmtStamp(m.captured_at))}${m.lat != null ? ` · ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : ''}">${body}${tag}
    <button data-act="del-media" data-id="${m.id}" data-testid="media-remove-${m.id}" aria-label="Remove">${ico('x')}</button></div>`;
}
const pendingTiles = ref => (ui.data.uploads || []).filter(u => u.ref === ref)
  .map(u => `<div class="ph ph-up" data-testid="upload-pending"><div class="ph-video">${ico('cloud')}<span>Uploading</span></div><i class="ph-bar" id="up-${u.id}" style="width:${Math.round(u.pct * 100)}%"></i></div>`).join('');

function photosSection(){
  const T = TEMPLATE, all = visitMedia(), photos = all.filter(m => m.kind === 'photo');
  const general = all.filter(m => m.problem_ref == null);
  return `<section class="sec" data-testid="visit-photos"><div class="sec-h"><h3>${ico('camera')}Photos <span class="req">Required</span></h3>
      <span class="pcount ${photos.length < T.min_photos ? 'short' : ''}" data-testid="photo-count">${photos.length} / ${T.min_photos} min</span></div>
    <div class="sec-b form">
      <div class="photos">${general.map(mediaTile).join('')}${pendingTiles(null)}
        <button class="addph" data-act="pick-media" data-kind="photo" data-capture="1" data-testid="photo-take">${ico('camera')}Take photo</button>
        <button class="addph" data-act="pick-media" data-kind="photo" data-testid="photo-upload">${ico('image')}Upload</button></div>
      <div class="row"><button class="btn sm" data-act="pick-media" data-kind="video" data-capture="1" data-testid="video-add">${ico('video')}Add video</button>
        <span class="small muted">Optional, up to ${T.max_video_mb} MB. Photos up to ${T.max_photo_mb} MB each.</span></div>
      <p class="small muted">Photos of a problem go on that problem below. Each photo keeps the time it was taken${ui.data.draft.gps ? ' and the GPS location' : ''}.</p>
    </div></section>`;
}

/* A file input per pick, so the camera opens straight away where the device supports capture. */
function pickFiles(kind, capture, ref){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.hidden = true;
  inp.accept = (kind === 'photo' ? TEMPLATE.photo_types : TEMPLATE.video_types).join(',');
  if (capture) inp.setAttribute('capture', 'environment');
  inp.multiple = kind === 'photo' && ref === null && !capture;
  inp.addEventListener('change', () => { const files = [...inp.files]; inp.remove(); uploadFiles(files, kind, ref); });
  document.body.appendChild(inp);
  inp.click();
}

async function uploadFiles(files, kind, ref){
  const T = TEMPLATE, types = kind === 'photo' ? T.photo_types : T.video_types;
  const limit = (kind === 'photo' ? T.max_photo_mb : T.max_video_mb) * 1048576;
  for (const f of files){
    if (!types.includes(f.type)){ toast(`${f.name || 'That file'} is not a supported ${kind}. Use ${types.map(t => t.split('/')[1].toUpperCase()).join(', ')}.`); continue; }
    if (f.size > limit){ toast(`${f.name || 'That file'} is over the ${limit / 1048576} MB limit for a ${kind}.`); continue; }
    const up = {id: Math.random().toString(36).slice(2), ref, pct: 0};
    ui.data.uploads.push(up); rerenderKeepScroll();
    // A camera file's lastModified is when it was taken; files older than a day use the upload time.
    const taken = f.lastModified && Date.now() - f.lastModified < 864e5 ? new Date(f.lastModified) : new Date();
    const gps = ui.data.draft.gps;
    try {
      const m = await API.uploadMedia(ui.data.server.id, f, {kind, problem_ref: ref, captured_at: taken.toISOString(),
        lat: gps ? gps.lat : null, lng: gps ? gps.lng : null}, pct => { up.pct = pct; const bar = $('#up-' + up.id); if (bar) bar.style.width = Math.round(pct * 100) + '%'; });
      ui.data.server.media.push(m);
    } catch (err){
      toast(err.status === 413 || err.status === 415 ? err.message : `Upload failed: ${err.message}`);
    } finally {
      ui.data.uploads = ui.data.uploads.filter(u => u !== up);
      if (ui.route === 'visit') rerenderKeepScroll();
    }
  }
}

const sbLabel = miss => miss.length ? `<b style="color:var(--bad)">${miss.length} missing</b>` : '<b style="color:var(--ok)">Ready to submit</b>';
const missCount = miss => `${miss.length} missing`;
const missList = miss => miss.length
  ? `<ul class="reqlist" data-testid="visit-missing">${miss.map(k => `<li class="no"><span class="ck"></span>${esc(visitLabel(k))}</li>`).join('')}</ul>`
  : `<div class="banner ok" data-testid="visit-ready">${ico('check')}<span>Everything required is filled in.</span></div>`;
function reqPanel(miss){
  return `<div class="panel-h"><h3>Required to submit</h3><span class="mono small" id="miss-count">${missCount(miss)}</span></div><div class="panel-b">
    <div id="miss-list">${missList(miss)}</div>
    <button class="btn primary" style="width:100%;margin-top:14px" data-act="submit-visit" data-testid="visit-submit" ${miss.length ? 'disabled' : ''}>${ico('check')}Submit for review</button>
    <div class="saved" style="margin-top:10px;justify-content:center">${ico('cloud')}<span id="savedlbl">${ui.data.savedAt ? 'Draft saved on this device' : 'Drafts save on this device as you type'}</span></div></div>`;
}
/* Updates the checklist in place. The submit buttons are never replaced here: a field's change
   event fires on blur, between mousedown and mouseup, and a swapped button would swallow the click. */
function refreshVisit(){
  const miss = visitMissing(ui.data.draft);
  const ml = $('#miss-list'); if (ml) ml.innerHTML = missList(miss);
  const mc = $('#miss-count'); if (mc) mc.textContent = missCount(miss);
  const sb = $('#sb-lbl'); if (sb) sb.innerHTML = sbLabel(miss);
  document.querySelectorAll('[data-act="submit-visit"]').forEach(b => { b.disabled = !!miss.length; });
}
function rerenderKeepScroll(){ const y = window.scrollY; render(); window.scrollTo(0, y); }

/* ---------- review (Team Lead) ---------- */
V.queue = {
  load: async () => { ui.data.queue = await API.reviewQueue(); ui.queueCount = ui.data.queue.length; },
  html: () => {
    const q = ui.data.queue;
    const waited = m => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`;
    return `<div data-testid="queue-view"><div class="head"><div><h1>Review queue</h1><div class="sub">${q.length ? `${q.length} site visit${q.length === 1 ? '' : 's'} waiting for your decision` : 'Nothing waiting for review'}</div></div></div>
      <section class="panel"><div class="tasks">${q.length ? q.map(v => `<button class="task task-review" data-act="open-review" data-vid="${v.id}" data-testid="queue-item-${v.id}">
        <span class="ti">${ico('eye')}</span>
        <span><b>${esc(v.project.name)}</b><span class="small muted">${esc(v.engineer ? v.engineer.name : '')} · ${esc(v.current_stage || '')} · submission ${v.submission_count}</span></span>
        <span class="meta">${pill('submitted', `Waiting ${waited(v.waiting_minutes)}`)}<span class="mono small muted">${pct(v.computed_progress)}</span></span></button>`).join('') : '<div class="empty">No site visits are waiting.</div>'}</div></section></div>`;
  }
};

V.review = {
  load: async () => { [ui.data.visit] = await Promise.all([API.visit(ui.p.vid), template()]); },
  html: () => {
    const v = ui.data.visit, f = v.form || {}, loc = f.location || {};
    const stage = TEMPLATE.stages.find(s => s.name === v.current_stage);
    const canAct = v.status === 'submitted';
    return `<div class="crumbs"><button data-go="queue">Review queue</button>/<span>${esc(v.project.name)}</span></div>
    <div class="head"><div><div class="eyebrow">Step 3 · Team Lead Review</div><h1>${esc(v.project.name)}</h1><div class="sub" data-testid="review-submission">Submission ${v.submission_count} by ${esc(v.engineer ? v.engineer.name : '')} · ${fmtStamp(v.submitted_at)}</div></div>
      <div class="row">${pill(VISIT_PILL[v.status], VISIT_LABEL[v.status])}<span class="pill">Derived progress ${pct(v.computed_progress)}</span></div></div>
    ${errBox()}
    <div class="act" data-testid="review-view"><div class="form">
      <section class="sec"><div class="sec-h"><h3>${ico('form')}Visit details</h3></div><div class="sec-b"><dl class="kv">
        <dt>Date and time</dt><dd>${fmtStamp(f.visit_at)}</dd><dt>Weather</dt><dd>${esc(f.weather)}</dd><dt>Attendees</dt><dd>${esc(f.attendees)}</dd>
        <dt>Location</dt><dd>${loc.gps ? `<span class="mono">${(+loc.gps.lat).toFixed(5)}, ${(+loc.gps.lng).toFixed(5)}</span> ` : ''}${esc(loc.manual || '')}</dd></dl></div></section>
      <section class="sec"><div class="sec-h"><h3>${ico('flow')}Stage: ${esc(v.current_stage)}</h3></div><div class="sec-b checks">
        ${(stage ? stage.checklist : []).map(i => `<div class="chk" style="justify-content:space-between;cursor:default"><span>${esc(i.label)}</span>${pill(v.checklist[i.id] === 'Done' ? 'done' : v.checklist[i.id] === 'In progress' ? 'active' : '', v.checklist[i.id] || '—')}</div>`).join('')}</div></section>
      <section class="sec"><div class="sec-h"><h3>${ico('alert')}Problems</h3></div><div class="sec-b form">
        ${v.no_issues ? '<span class="muted">No issues found.</span>' : v.problems.map((pr, n) => `<div class="bbox"><div class="row" style="justify-content:space-between"><b>${n + 1}. ${esc(pr.category === 'Other' ? pr.other_text : pr.problem)}</b>${pill(['High', 'Critical'].includes(pr.severity) ? 'rework' : 'active', pr.severity)}</div>
          <dl class="kv small"><dt>Category</dt><dd>${esc(pr.category)}</dd><dt>Location</dt><dd>${esc(pr.location)}</dd><dt>Responsible</dt><dd>${esc(pr.responsible_party)}</dd><dt>Fix by</dt><dd>${fmtDate(pr.target_date)}</dd></dl>
          ${reviewMedia((v.media || []).filter(m => m.problem_ref === n), `problem-${n}`)}</div>`).join('')}</div></section>
      ${(v.media || []).length ? `<section class="sec" data-testid="review-media"><div class="sec-h"><h3>${ico('camera')}Site photos and video</h3><span class="pcount">${(v.media || []).filter(m => m.kind === 'photo').length} photos</span></div>
        <div class="sec-b">${reviewMedia((v.media || []).filter(m => m.problem_ref == null), 'site')}</div></section>` : ''}
      <section class="sec"><div class="sec-h"><h3>${ico('doc')}Summary</h3></div><div class="sec-b"><dl class="kv"><dt>Summary</dt><dd>${esc(f.summary)}</dd><dt>Recommended action</dt><dd>${esc(f.recommended_action)}</dd></dl></div></section>
    </div>
    <div class="panel reqpanel"><div class="panel-h"><h3>Decision</h3></div><div class="panel-b form">
      ${canAct ? `<div class="field"><label for="rv-c">Comment</label><textarea id="rv-c" rows="4" data-testid="review-comment" placeholder="Required when requesting rework">${esc(ui.p.comment)}</textarea></div>
        <button class="btn primary" data-act="review-approve" data-testid="review-approve">${ico('check')}Approve</button>
        <button class="btn danger" data-act="review-rework" data-testid="review-rework">Request rework</button>` : `<p class="muted">This visit is ${esc(VISIT_LABEL[v.status].toLowerCase())}; no decision is pending.</p>`}
      ${v.reviews.length ? `<div class="subh" style="margin-top:6px">History</div>${v.reviews.slice().reverse().map(r => `<div class="small"><b>${esc(r.reviewer ? r.reviewer.name : '')}</b> <span class="muted">${fmtStamp(r.at)} · ${r.decision === 'rework' ? 'Rework' : 'Approved'}</span>${r.comment ? `<div>${esc(r.comment)}</div>` : ''}</div>`).join('')}` : ''}
    </div></div></div>`;
  }
};

/* Read-only media grid; a tap opens the larger view with capture time and GPS. */
function reviewMedia(list, where){
  if (!list.length) return where === 'site' ? '<span class="small muted">No other photos.</span>' : '';
  return `<div class="photos" data-testid="review-media-${where}">${list.map(m => `<button class="ph" data-act="open-media" data-id="${m.id}" data-testid="review-tile-${m.id}" aria-label="Open ${m.kind}">
    ${m.kind === 'photo' ? `<img data-mid="${m.id}" alt="Site photo">` : `<div class="ph-video">${ico('video')}<span>Video</span></div>`}
    <span class="ph-tag">${esc(fmtShortTime(m.captured_at))}</span></button>`).join('')}</div>`;
}
const fmtShortTime = iso => new Date(iso).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});

function lightbox(){
  const all = [...(ui.data.visit ? ui.data.visit.media || [] : []), ...((ui.data.server && ui.data.server.media) || []), ...(ui.data.lbMedia || [])];
  const m = all.find(x => x.id === ui.lightbox);
  if (!m) return '';
  return `<div class="lightbox" data-testid="lightbox" role="dialog" aria-label="Photo"><div class="lb-body">
    ${m.kind === 'photo' ? `<img data-mid="${m.id}" alt="Site photo">` : `<video data-mid="${m.id}" controls playsinline></video>`}
    <div class="lb-meta"><span>${m.captured_at ? fmtStamp(m.captured_at) : 'Photo of the problem'}${m.captured_at == null ? '' : m.lat != null ? ` · <span class="mono">${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</span>` : ' · no GPS'}</span>
      <span>${m.problem_ref != null ? `Problem ${m.problem_ref + 1} · ` : ''}${esc(m.uploader ? m.uploader.name : '')}</span>
      <button class="btn sm" data-act="close-media" data-testid="lightbox-close">Close</button></div></div></div>`;
}

async function decide(decision){
  const v = ui.data.visit, comment = ($('#rv-c') ? $('#rv-c').value : '').trim();
  ui.p.comment = comment;
  if (decision === 'rework' && !comment){ ui.error = {message: 'Add a comment so the engineer knows what to fix.', items: []}; render(); return; }
  try {
    await API.review(v.id, {decision, comment: comment || null});
    toast(decision === 'approve' ? 'Approved. Progress is now official.' : 'Sent back for rework.');
    await go('project', {pid: v.project.id});
  } catch (err){ setError(err, {comment: 'Comment'}); render(); }
}

/* ---------- render ---------- */
function render(){
  document.body.classList.toggle('anon', !ui.me);
  if (!ui.me){ $('#side').innerHTML = ''; $('#tabs').innerHTML = ''; $('#main').innerHTML = V.login.html(); return; }
  const v = V[ui.route] || V.projects;
  $('#main').innerHTML = shell() + (ui.loadError ? `<div class="errbox" data-testid="load-error">${esc(ui.loadError)}</div>` : v.html()) + lightbox();
  document.body.classList.toggle('focus', ui.route === 'visit');
  if (ui.route === 'project') syncLegalSave();
  hydrateMedia();
}

/* Thumbnails are fetched with the sign-in token after each render. */
function hydrateMedia(){
  if (!MEDIA) return;
  document.querySelectorAll('img[data-mid]:not([src])').forEach(async img => {
    try { img.src = await API.mediaUrl(+img.dataset.mid); } catch (_) { img.alt = 'Photo could not be loaded'; }
  });
  document.querySelectorAll('video[data-mid]:not([src])').forEach(async v => {
    try { v.src = await API.mediaUrl(+v.dataset.mid); } catch (_) {}
  });
}

/* Save stays disabled for Approved until a document reference is entered. */
function syncLegalSave(){
  const st = $('#lg-status'), doc = $('#lg-doc'), btn = $('[data-testid="legal-save"]');
  if (!st || !btn) return;
  const blocked = st.value === 'Approved' && !doc.value.trim();
  btn.disabled = blocked;
  $('#lg-hint').textContent = blocked ? 'Attach the approval document to save as Approved.' : '';
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const g = e.target.closest('[data-go]'); if (g){ go(g.dataset.go); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  switch (a.dataset.act){
    case 'open-project': go('project', {pid: +a.dataset.pid}); break;
    case 'sign-out': API.logout(); showLogin(); break;
    case 'show-activate': ui.activating = true; ui.error = null; render(); break;
    case 'hide-activate': ui.activating = false; ui.error = null; render(); break;
    case 'invite-client': {
      const name = ($('#iv-name').value || '').trim(), email = ($('#iv-email').value || '').trim();
      if (!name || !email){ toast('Enter the client\'s name and email.'); break; }
      a.disabled = true;
      try { ui.data.invite = await API.inviteClient(ui.data.project.id, name, email); ui.data.clients = await API.projectClients(ui.data.project.id); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break; }
    case 'copy-code': {
      const code = ui.data.invite && ui.data.invite.code;
      try { await navigator.clipboard.writeText(code); toast('Code copied.'); } catch (_) { toast('Select the code and copy it.'); }
      break; }
    case 'set-server': API.setBase($('#li-api').value.trim()); toast(`Server set to ${API.base()}`); break;
    case 'start-visit': go('visit', {pid: +a.dataset.pid}); break;
    case 'demo-login':
      try { ui.me = await API.login(a.dataset.email, API.demoPassword); ui.error = null; await go(home()); }
      catch (err){ ui.error = err.message; render(); }
      break;
    case 'reset-demo':
      // The viewer blocks confirm(), so a second tap confirms.
      if (!a.dataset.confirm){ a.dataset.confirm = '1'; a.textContent = 'Tap again to reset'; setTimeout(() => { if (a.isConnected){ delete a.dataset.confirm; a.textContent = 'Reset demo data'; } }, 3000); break; }
      API.resetDemo(); try { Object.keys(localStorage).filter(k => k.startsWith('siteflow.draft.')).forEach(k => localStorage.removeItem(k)); } catch (_) {}
      toast('Demo data reset.'); await go(home()); break;
    case 'open-review': go('review', {vid: +a.dataset.vid}); break;
    case 'add-problem': ui.data.draft.problems.push(blankProblem()); ui.data.draft.no_issues = false; saveDraft(); rerenderKeepScroll(); break;
    case 'del-problem': {
      const n = +a.dataset.n;
      // Photos are tagged by problem position: untag this problem's photos, shift those below it up.
      if (MEDIA) try {
        for (const m of visitMedia().filter(x => x.problem_ref != null && x.problem_ref >= n)){
          const ref = m.problem_ref === n ? null : m.problem_ref - 1;
          Object.assign(m, await API.retagMedia(m.id, ref));
        }
      } catch (err){ toast(err.message); break; }
      ui.data.draft.problems.splice(n, 1); saveDraft(); rerenderKeepScroll(); break; }
    case 'open-media': ui.lightbox = +a.dataset.id; rerenderKeepScroll(); break;
    case 'client-open': go('client-project', {pid: +a.dataset.pid}); break;
    case 'client-unfold': { const n = +a.dataset.n, u = ui.p.unfold || [];
      ui.p.unfold = u.includes(n) ? u.filter(x => x !== n) : [...u, n]; rerenderKeepScroll(); break; }
    case 'client-review': go('client-signoff', {sid: +a.dataset.sid}); break;
    case 'signoff-create': {
      const key = a.dataset.key, title = ($('#so-title-' + key).value || '').trim(), summary = ($('#so-sum-' + key).value || '').trim();
      if (!title || !summary){ toast('Add a title and a summary for the client.'); break; }
      try { await API.createSignoff(ui.data.project.id, {stage_key: key, title, summary}); await reloadSignoffs(); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break; }
    case 'signoff-attach': {
      const id = +a.dataset.id, inp = document.createElement('input');
      inp.type = 'file'; inp.hidden = true; inp.accept = 'application/pdf,image/jpeg,image/png,image/webp';
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; inp.remove(); if (!f) return;
        try { await API.uploadSignoffAttachment(id, f); await reloadSignoffs(); ui.error = null; } catch (err){ toast(err.message); }
        rerenderKeepScroll();
      });
      document.body.appendChild(inp); inp.click(); break; }
    case 'signoff-remove':
      try { await API.removeSignoffAttachment(+a.dataset.id, +a.dataset.aid); await reloadSignoffs(); } catch (err){ toast(err.message); }
      rerenderKeepScroll(); break;
    case 'signoff-send':
      a.disabled = true;
      try { await API.sendSignoff(+a.dataset.id); toast('Sent. The client sees it in the client app.'); await V.project.load(); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break;
    case 'open-stage': ui.p.openStage = ui.p.openStage === a.dataset.key ? null : a.dataset.key; rerenderKeepScroll(); break;
    case 'stage-complete': {
      const key = a.dataset.key, note = (($('#st-note-' + key) || {}).value || '').trim();
      if (!note){ toast('Add a note on what was completed.'); break; }
      a.disabled = true;
      try { await API.completeStage(ui.data.project.id, key, note); toast('Stage completed.'); await V.project.load(); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break; }
    case 'open-photo': ui.data.lbMedia = [{id: +a.dataset.mid, kind: 'photo', captured_at: null, lat: null, problem_ref: null, uploader: null}];
      ui.lightbox = +a.dataset.mid; rerenderKeepScroll(); break;
    case 'resolve': ui.p.resolving = +a.dataset.id; rerenderKeepScroll(); { const i = $('#rs-' + a.dataset.id); if (i) i.focus(); } break;
    case 'resolve-cancel': ui.p.resolving = null; rerenderKeepScroll(); break;
    case 'resolve-confirm': {
      const note = (($('#rs-' + a.dataset.id) || {}).value || '').trim();
      if (!note){ toast('Say how the problem was fixed.'); break; }
      try { await API.resolveProblem(+a.dataset.id, note); ui.p.resolving = null; toast('Problem resolved.'); await V.project.load(); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break; }
    case 'open-note':
      try { await API.readNotification(+a.dataset.id); } catch (_) {}
      if (a.dataset.pid) await go(isClient() ? 'client-project' : 'project', {pid: +a.dataset.pid}); else await go('alerts');
      break;
    case 'read-all':
      try { await API.readAllNotifications(); ui.unread = 0; toast('All notifications marked read.'); } catch (err){ toast(err.message); }
      await go('alerts'); break;
    case 'flag-clear': ui.p.clearing = +a.dataset.id; rerenderKeepScroll(); { const i = $('#fr-' + a.dataset.id); if (i) i.focus(); } break;
    case 'flag-cancel': ui.p.clearing = null; rerenderKeepScroll(); break;
    case 'flag-confirm': {
      const reason = ($('#fr-' + a.dataset.id) || {}).value || '';
      if (!reason.trim()){ toast('Give a reason for clearing this red flag.'); break; }
      try { await API.clearFlag(+a.dataset.id, reason.trim()); ui.p.clearing = null; toast('Red flag cleared. The reason is in the audit trail.'); await V.dashboard.load(); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break; }
    case 'flt-reset': e.preventDefault(); saveFilters({}); await go('dashboard'); break;
    case 'close-media': ui.lightbox = null; rerenderKeepScroll(); break;
    case 'pick-media': pickFiles(a.dataset.kind, !!a.dataset.capture, a.dataset.ref === undefined ? null : +a.dataset.ref); break;
    case 'del-media':
      try { await API.deleteMedia(+a.dataset.id); ui.data.server.media = visitMedia().filter(m => m.id !== +a.dataset.id); rerenderKeepScroll(); }
      catch (err){ toast(err.message); }
      break;
    case 'clear-gps': ui.data.draft.gps = null; saveDraft(); rerenderKeepScroll(); break;
    case 'gps':
      if (!navigator.geolocation){ toast('GPS is not available here. Describe the location instead.'); break; }
      a.disabled = true; a.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(pos => {
        ui.data.draft.gps = {lat: pos.coords.latitude, lng: pos.coords.longitude}; saveDraft(); rerenderKeepScroll(); toast('Location captured.');
      }, () => { rerenderKeepScroll(); toast('Could not get a GPS fix. Describe the location instead.'); }, {enableHighAccuracy: true, timeout: 12000, maximumAge: 60000});
      break;
    case 'submit-visit': {
      const d = ui.data.draft;
      if (visitMissing(d).length){ refreshVisit(); toast('Some required items are missing.'); break; }
      a.disabled = true;
      try {
        const v = await API.submitVisit(ui.p.pid, visitPayload(d));
        dropDraft(ui.p.pid);
        toast(`Submitted for review. Derived progress ${pct(v.computed_progress)}.`);
        await go('project', {pid: ui.p.pid});
      } catch (err){ setError(err, visitLabel); rerenderKeepScroll(); window.scrollTo(0, 0); }
      break; }
    case 'review-approve': decide('approve'); break;
    case 'review-rework': decide('rework'); break;
  }
});

document.addEventListener('submit', async e => {
  const form = e.target.closest('[data-form]'); if (!form) return;
  e.preventDefault();
  const btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  try {
    switch (form.dataset.form){
      case 'activate': {
        ui.loginEmail = $('#ac-email').value.trim();
        ui.activateCode = $('#ac-code').value.trim();
        const password = $('#ac-pass').value;
        // Keep what was typed across the re-render; only a rejected code is cleared.
        if (password.length < 10){ ui.error = 'Choose a password of at least 10 characters.'; render(); return; }
        try { ui.me = await API.activate(ui.loginEmail, ui.activateCode, password); }
        catch (err){ ui.error = err.message; if (err.status === 400) ui.activateCode = ''; render(); return; }
        ui.error = null; ui.activating = false; ui.activateCode = ''; toast('Welcome to SiteFlow.'); await go(home()); break;
      }
      case 'login': {
        ui.loginEmail = $('#li-email').value.trim();
        try { ui.me = await API.login(ui.loginEmail, $('#li-pass').value); }
        catch (err){ ui.error = err.message; render(); const pw = $('#li-pass'); if (pw) pw.focus(); return; }
        ui.error = null; await go(home()); break;
      }
      case 'new-project': {
        const body = {name: $('#np-name').value.trim(), location: $('#np-loc').value.trim(),
          civil_engineer_id: +$('#np-eng').value || null, legal_expected_date: $('#np-date').value || null};
        const miss = [!body.name && 'Project name', !body.location && 'Location', !body.civil_engineer_id && 'Civil Engineer'].filter(Boolean);
        ui.p.form = body;
        if (miss.length){ ui.error = {message: `${miss.join(', ')} ${miss.length === 1 ? 'is' : 'are'} required.`, items: []}; render(); return; }
        try { const p = await API.createProject(body); toast(`${p.name} created. Legal Approval is open.`); await go('project', {pid: p.id}); }
        catch (err){ setError(err); render(); }
        break;
      }
      case 'legal': {
        const p = ui.data.project, la = p.legal_approval;
        const body = {};
        const status = $('#lg-status').value; if (status !== la.status) body.status = status;
        const vals = {authority_name: '#lg-auth', application_reference: '#lg-ref', application_date: '#lg-adate', approval_date: '#lg-pdate', document_reference: '#lg-doc'};
        const draft = {status};
        Object.entries(vals).forEach(([k, sel]) => { const v = $(sel).value.trim(); draft[k] = v; if (v && v !== (la[k] || '')) body[k] = v; });
        try { ui.data.project = await API.updateLegal(p.id, body); ui.error = null; ui.data.legalDraft = null; toast(status === 'Approved' ? 'Legal Approval approved. Site Visit is open.' : 'Legal Approval saved.'); }
        catch (err){ setError(err, LEGAL_FIELDS); ui.data.legalDraft = draft; }
        render(); break;
      }
    }
  } finally { if (btn && btn.isConnected) btn.disabled = false; if (ui.route === 'project') syncLegalSave(); }
});

function setProblem(el){ const [n, k] = el.dataset.p.split('.'); const pr = ui.data.draft.problems[+n]; pr[k] = el.value; if (k === 'category'){ pr.problem = ''; pr.other_text = ''; } }
document.addEventListener('input', e => {
  const el = e.target;
  if (ui.route === 'visit' && ui.data.draft && el.tagName !== 'SELECT' && el.type !== 'checkbox'){
    if (el.dataset.v){ ui.data.draft[el.dataset.v] = el.value; saveDraft(); refreshVisit(); return; }
    if (el.dataset.p){ setProblem(el); saveDraft(); refreshVisit(); return; }
  }
  if (el.id === 'lg-doc') syncLegalSave();
});
let fltTimer = null;
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.flt || el.tagName === 'SELECT' || el.type === 'date') return;
  clearTimeout(fltTimer); fltTimer = setTimeout(() => applyFilter(el), 350);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.flt && (el.tagName === 'SELECT' || el.type === 'date')){ applyFilter(el); return; }
  if (ui.route === 'visit' && ui.data.draft){
    const d = ui.data.draft;
    if (el.dataset.v) d[el.dataset.v] = el.type === 'checkbox' ? el.checked : el.value;
    else if (el.dataset.chk) d.checklist[el.dataset.chk] = el.value;
    else if (el.dataset.p) setProblem(el);
    else return;
    saveDraft();
    if (el.dataset.rerender) rerenderKeepScroll(); else refreshVisit();
    return;
  }
  if (el.id === 'lg-status') syncLegalSave();
});
window.addEventListener('online', () => render());
window.addEventListener('offline', () => render());
if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
  window.Capacitor.Plugins.App.addListener('backButton', () => { if (ui.route !== home() && ui.me) go(home()); else window.Capacitor.Plugins.App.exitApp(); });
}

/* ---------- boot ---------- */
(async () => {
  if (!API.signedIn()) return showLogin();
  try { ui.me = await API.me(); await go(home()); }
  catch (e) { showLogin(API.signedIn() ? e.message : null); }
})();
})();
