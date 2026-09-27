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
const ROLES = {architect: 'Architect', team_lead: 'Team Lead', civil_engineer: 'Civil Engineer', admin: 'Admin'};
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
  ui.route = route; ui.p = p; ui.error = null; ui.loadError = null; ui.data = {};
  const v = V[route];
  if (v && v.load){
    $('#main').innerHTML = shell() + '<div class="empty">Loading…</div>';
    try { await v.load(); } catch (e) { if (!API.signedIn()) return showLogin(); ui.loadError = e.message; }
  }
  render(); window.scrollTo(0, 0);
}
function showLogin(msg){ ui.me = null; ui.route = 'login'; ui.error = msg || null; render(); }
API.onSignedOut(() => showLogin('Your session has ended. Sign in again.'));

/* ---------- render: shell ---------- */
function shell(){
  if (!ui.me) return '';
  const u = ui.me;
  const nav = [['projects', 'folder', 'Projects']];
  const cur = ['project', 'new-project', 'visit'].includes(ui.route) ? 'projects' : ui.route;
  const who = `<span data-testid="signed-in-as"><b>${esc(u.name)}</b> <span class="muted small">· ${ROLES[u.role]}</span></span>`;
  $('#side').innerHTML = `
    <div class="brand"><span class="brand-mark">${ico('logo')}</span><div><b>SiteFlow</b><small>Residential · MVP</small></div></div>
    <div class="nav">${nav.map(([r, i, l]) => `<button data-go="${r}" data-testid="nav-${r}" class="${cur === r ? 'on' : ''}">${ico(i)}${l}</button>`).join('')}</div>
    <div class="side-foot">
      <div class="whois"><span class="eyebrow">Signed in</span>${who}</div>
      <button class="btn ghost sm" data-act="sign-out" data-testid="sign-out">Sign out</button>
      <div class="credit">SiteFlow by TAN GLOBUS AI</div>
    </div>`;
  $('#tabs').innerHTML = nav.map(([r, i, l]) => `<button data-go="${r}" class="${cur === r ? 'on' : ''}">${ico(i)}${l}</button>`).join('');
  return `<div class="mtop"><div class="brand"><span class="brand-mark">${ico('logo')}</span><b>SiteFlow</b></div><button class="btn ghost sm" data-act="sign-out" data-testid="sign-out">Sign out</button></div>
    ${navigator.onLine === false ? `<div class="offline">${ico('cloud')}Offline. Drafts stay on this device; submit when you are back in coverage.</div>` : ''}`;
}

/* ---------- small components ---------- */
const pill = (cls, label, testid) => `<span class="pill ${cls}"${testid ? ` data-testid="${testid}"` : ''}><span class="dot"></span>${esc(label)}</span>`;
const errBox = () => ui.error ? `<div class="errbox" data-testid="form-error" style="margin-bottom:14px">${esc(ui.error.message)}${ui.error.items && ui.error.items.length ? `<ul>${ui.error.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>` : '';
function setError(e, labels){
  const items = e instanceof API.ApiError ? [...e.missing.map(k => `Missing: ${(labels && labels[k] || k).toLowerCase()}`), ...e.invalid.map(k => `Invalid: ${(labels && labels[k] || k).toLowerCase()}`)] : [];
  ui.error = {message: e.message, items};
}
function projectCard(p){
  const steps = ['Legal Approval', 'Site Visit', 'Team Lead Review'];
  const at = steps.indexOf(p.current_step);
  const cls = i => p.current_step === null ? 'done' : i < at ? 'done' : i === at ? 'active' : '';
  return `<button class="pcard" data-act="open-project" data-pid="${p.id}" data-testid="project-card-${p.id}">
    <div><h3>${esc(p.name)}</h3><div class="loc">${esc(p.location)}</div></div>
    <div class="ministep">${steps.map((s, i) => `<i class="${cls(i)}" title="${esc(s)}"></i>`).join('')}</div>
    <div class="now"><span>${p.current_step ? `<span class="muted">Now:</span> <b>${esc(p.current_step)}</b>` : '<b>Workflow complete</b>'}</span><span class="mono muted">${pct(p.official_progress)}</span></div>
    <div class="row small muted">${p.civil_engineer ? `<span>${esc(p.civil_engineer.name)}</span>` : ''}${p.latest_visit_status ? pill(VISIT_PILL[p.latest_visit_status], VISIT_LABEL[p.latest_visit_status]) : ''}</div>
  </button>`;
}
function auditText(e){
  const d = e.detail || {};
  switch (e.action){
    case 'project.created': return 'Project created';
    case 'legal.updated': return d.from === d.to ? 'Legal Approval details updated' : `Legal Approval: ${d.from} to ${d.to}`;
    case 'step.activated': return `${d.step} opened`;
    case 'step.completed': return `${d.step} completed`;
    case 'step.locked': return `${d.step} locked`;
    case 'site_visit.submitted': return `Site visit submitted (submission ${d.submission}), derived progress ${pct(d.computed_progress)}`;
    case 'site_visit.approved': return `Site visit approved, progress ${pct(d.official_progress)} is official`;
    case 'site_visit.rework_requested': return `Rework requested: “${d.comment}”`;
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
      <form class="form" data-form="login">
        <div class="field"><label for="li-email">Email</label><input id="li-email" data-testid="login-email" type="email" autocomplete="username" value="${esc(ui.loginEmail)}" required></div>
        <div class="field"><label for="li-pass">Password</label><input id="li-pass" data-testid="login-password" type="password" autocomplete="current-password" required></div>
        <button class="btn primary" type="submit" data-testid="login-submit">Sign in</button>
      </form>
      <details class="small muted"><summary>Server</summary>
        <div class="field" style="margin-top:8px"><label for="li-api">SiteFlow server address</label><input id="li-api" data-testid="login-server" value="${esc(API.base())}"></div>
        <button class="btn sm" data-act="set-server" style="margin-top:8px">Use this server</button>
      </details>
      <div class="credit">SiteFlow by TAN GLOBUS AI</div>
    </div></div>`};

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
  load: async () => { ui.data.project = await API.project(ui.p.pid); },
  html: () => {
    const p = ui.data.project;
    const cur = p.steps.find(s => s.status === 'active');
    return `<div class="crumbs"><button data-go="projects">Projects</button>/<span>${esc(p.name)}</span></div>
    <div class="head"><div><h1 data-testid="project-title">${esc(p.name)}</h1><div class="sub">${esc(p.location)}</div></div>
      <div class="row"><span class="pill">Residential v${p.template.version}</span><span class="pill ${cur ? 'active' : 'done'}" data-testid="official-progress">Official progress ${pct(p.official_progress)}</span></div></div>
    <div class="panel stepper-wrap"><ol class="stepper" style="padding:4px 16px">${p.steps.map(s => `<li class="st st-${s.status === 'completed' ? 'done' : s.status}" data-testid="step-${s.order}"><button type="button"><span class="st-n">${s.status === 'completed' ? ico('check') : s.order}</span><span class="st-l">${esc(s.name)}</span><span class="st-s">${STEP_LABEL[s.status]}</span></button></li>`).join('')}</ol></div>
    ${errBox()}
    <div class="grid2">
      <div class="steps">${legalCard(p)}${visitCard(p)}${reviewCard(p)}</div>
      <div class="stack">
        <section class="panel"><div class="panel-h"><h3>Project</h3></div><div class="panel-b"><dl class="kv">
          <dt>Location</dt><dd>${esc(p.location)}</dd>
          <dt>Civil Engineer</dt><dd>${esc(p.civil_engineer ? p.civil_engineer.name : '—')}</dd>
          <dt>Template</dt><dd>Residential v${p.template.version}</dd></dl></div></section>
        <section class="panel"><div class="panel-h"><h3>Audit trail</h3></div><div class="panel-b audit" data-testid="audit-list">${p.audit.slice().reverse().map(e => `<div><span class="mono muted small">${fmtStamp(e.at)}</span><span>${esc(auditText(e))} <span class="muted">· ${esc(e.actor || '')}</span></span></div>`).join('')}</div></section>
      </div>
    </div>`;
  }
};

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
  const body = v ? `<dl class="kv"><dt>Latest visit</dt><dd>${pill(VISIT_PILL[v.status], VISIT_LABEL[v.status])}</dd>
    <dt>Submissions</dt><dd>${v.submission_count}</dd><dt>Derived progress</dt><dd data-testid="visit-progress">${pct(v.computed_progress)}${v.status === 'approved' ? '' : ' (pending approval)'}</dd></dl>` : '<span class="small muted">No site visit submitted yet.</span>';
  return stepCard(p, 2, 'Site Visit', p.civil_engineer ? `${p.civil_engineer.name} · Civil Engineer` : 'Civil Engineer', body);
}

function reviewCard(p){
  return stepCard(p, 3, 'Team Lead Review', 'Parvez · Team Lead', '');
}

/* ---------- render ---------- */
function render(){
  document.body.classList.toggle('anon', !ui.me);
  if (!ui.me){ $('#side').innerHTML = ''; $('#tabs').innerHTML = ''; $('#main').innerHTML = V.login.html(); return; }
  const v = V[ui.route] || V.projects;
  $('#main').innerHTML = shell() + (ui.loadError ? `<div class="errbox" data-testid="load-error">${esc(ui.loadError)}</div>` : v.html());
  document.body.classList.toggle('focus', ui.route === 'visit');
  if (ui.route === 'project') syncLegalSave();
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
    case 'set-server': API.setBase($('#li-api').value.trim()); toast(`Server set to ${API.base()}`); break;
  }
});

document.addEventListener('submit', async e => {
  const form = e.target.closest('[data-form]'); if (!form) return;
  e.preventDefault();
  const btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  try {
    switch (form.dataset.form){
      case 'login': {
        ui.loginEmail = $('#li-email').value.trim();
        try { ui.me = await API.login(ui.loginEmail, $('#li-pass').value); }
        catch (err){ ui.error = err.message; render(); const pw = $('#li-pass'); if (pw) pw.focus(); return; }
        ui.error = null; await go('projects'); break;
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

document.addEventListener('input', e => { if (e.target.id === 'lg-doc') syncLegalSave(); });
document.addEventListener('change', e => { if (e.target.id === 'lg-status') syncLegalSave(); });
window.addEventListener('online', () => render());
window.addEventListener('offline', () => render());
if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App){
  window.Capacitor.Plugins.App.addListener('backButton', () => { if (ui.route !== 'projects' && ui.me) go('projects'); else window.Capacitor.Plugins.App.exitApp(); });
}

/* ---------- boot ---------- */
(async () => {
  if (!API.signedIn()) return showLogin();
  try { ui.me = await API.me(); await go('projects'); }
  catch (e) { showLogin(API.signedIn() ? e.message : null); }
})();
})();
