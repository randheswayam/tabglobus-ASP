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
  if (can.review() && route !== 'queue') API.reviewQueue().then(q => { ui.queueCount = q.length; shell(); }).catch(() => {});
}
function showLogin(msg){ ui.me = null; ui.route = 'login'; ui.error = msg || null; render(); }
API.onSignedOut(() => showLogin('Your session has ended. Sign in again.'));

/* ---------- render: shell ---------- */
function shell(){
  if (!ui.me) return '';
  const u = ui.me;
  const nav = [['projects', 'folder', 'Projects'], ...(can.review() ? [['queue', 'eye', 'Review queue']] : [])];
  const cur = ui.route === 'review' ? 'queue' : ['project', 'new-project', 'visit'].includes(ui.route) ? 'projects' : ui.route;
  const count = r => r === 'queue' && ui.queueCount ? `<span class="count" data-testid="queue-count">${ui.queueCount}</span>` : '';
  const who = `<span data-testid="signed-in-as"><b>${esc(u.name)}</b> <span class="muted small">· ${ROLES[u.role]}</span></span>`;
  $('#side').innerHTML = `
    <div class="brand"><span class="brand-mark">${ico('logo')}</span><div><b>SiteFlow</b><small>Residential · MVP</small></div></div>
    <div class="nav">${nav.map(([r, i, l]) => `<button data-go="${r}" data-testid="nav-${r}" class="${cur === r ? 'on' : ''}">${ico(i)}${l}${count(r)}</button>`).join('')}</div>
    <div class="side-foot">
      <div class="whois"><span class="eyebrow">Signed in</span>${who}</div>
      <button class="btn ghost sm" data-act="sign-out" data-testid="sign-out">Sign out</button>
      <div class="credit">SiteFlow by TAN GLOBUS AI</div>
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
  location: 'location on site', responsible_party: 'responsible party', target_date: 'target fix date'};
function visitLabel(path){
  const fixed = {visit_at: 'Visit date and time', location: 'Location (GPS or manual entry)', 'location.gps': 'GPS coordinates',
    weather: 'Weather', attendees: 'Attendees', current_stage: 'Construction stage', problems: 'Problems, or tick “No issues found”',
    no_issues: '“No issues found” cannot be ticked while problems are listed', summary: 'Summary', recommended_action: 'Recommended action'};
  if (fixed[path]) return fixed[path];
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
          </div></div>`).join('')}
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
          <dl class="kv small"><dt>Category</dt><dd>${esc(pr.category)}</dd><dt>Location</dt><dd>${esc(pr.location)}</dd><dt>Responsible</dt><dd>${esc(pr.responsible_party)}</dd><dt>Fix by</dt><dd>${fmtDate(pr.target_date)}</dd></dl></div>`).join('')}</div></section>
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
    case 'start-visit': go('visit', {pid: +a.dataset.pid}); break;
    case 'open-review': go('review', {vid: +a.dataset.vid}); break;
    case 'add-problem': ui.data.draft.problems.push(blankProblem()); ui.data.draft.no_issues = false; saveDraft(); rerenderKeepScroll(); break;
    case 'del-problem': ui.data.draft.problems.splice(+a.dataset.n, 1); saveDraft(); rerenderKeepScroll(); break;
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

function setProblem(el){ const [n, k] = el.dataset.p.split('.'); const pr = ui.data.draft.problems[+n]; pr[k] = el.value; if (k === 'category'){ pr.problem = ''; pr.other_text = ''; } }
document.addEventListener('input', e => {
  const el = e.target;
  if (ui.route === 'visit' && ui.data.draft && el.tagName !== 'SELECT' && el.type !== 'checkbox'){
    if (el.dataset.v){ ui.data.draft[el.dataset.v] = el.value; saveDraft(); refreshVisit(); return; }
    if (el.dataset.p){ setProblem(el); saveDraft(); refreshVisit(); return; }
  }
  if (el.id === 'lg-doc') syncLegalSave();
});
document.addEventListener('change', e => {
  const el = e.target;
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
  window.Capacitor.Plugins.App.addListener('backButton', () => { if (ui.route !== 'projects' && ui.me) go('projects'); else window.Capacitor.Plugins.App.exitApp(); });
}

/* ---------- boot ---------- */
(async () => {
  if (!API.signedIn()) return showLogin();
  try { ui.me = await API.me(); await go('projects'); }
  catch (e) { showLogin(API.signedIn() ? e.message : null); }
})();
})();
