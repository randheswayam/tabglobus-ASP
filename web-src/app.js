/* global SiteFlowAPI, wfIcon */
(function(){
'use strict';
/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const today = () => ymd(new Date());
const fmtDate = s => s ? parseYmd(s).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) : '—';
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
  rupee: '<path d="M7 5h10M7 9h10M7 5c6 0 6 8 0 8l7 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'
};
const ico = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* ---------- reference data ---------- */
const API = SiteFlowAPI;
const ROLES = {architect: 'Architect', team_lead: 'Team Lead', civil_engineer: 'Civil Engineer', admin: 'Admin', client: 'Client',
  structural_consultant: 'Structural Consultant', mep_consultant: 'MEP Consultant', interior_designer: 'Interior Designer',
  accounts: 'Accounts', office_coordinator: 'Office Coordinator'};
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
  review: () => ui.me && ui.me.role === 'team_lead',
  admin: () => ui.me && ui.me.role === 'admin',
  // Client fees: Accounts records them; the principal architect reads them on the overview (and may record).
  fees: () => !!API.fees && !!ui.me && (ui.me.role === 'accounts' || !!ui.me.principal),
  principal: () => !!API.principalOverview && !!ui.me && !!ui.me.principal
};

/* ---------- toast ---------- */
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600); }

/* ---------- navigation ---------- */
async function go(route, p = {}){
  ui.route = route; ui.p = p; ui.error = null; ui.loadError = null; ui.data = {}; ui.lightbox = null;
  if (typeof hideCallout === 'function') hideCallout();
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
      ...(can.review() ? [['queue', 'eye', 'Review queue']] : []), ...(ui.me.role === 'accounts' && can.fees() ? [['fees', 'doc', 'Fees']] : []),
      ...(API.notifications ? [['alerts', 'bell', 'Notifications']] : []),
      ...(can.admin() && API.adminUsers ? [['team', 'users', 'Team'], ['import', 'doc', 'Import projects']] : [])];
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
      ${API.demo ? '' : `<button class="btn ghost sm" data-act="sign-out-all" data-testid="signout-all">Sign out on all devices</button>`}
      ${API.demo ? `<button class="btn ghost sm" data-act="reset-demo" data-testid="reset-demo">Reset demo data</button>` : ''}
      <div class="credit">${API.demo ? 'Demo with sample data · ' : ''}SiteFlow by TAN GLOBUS AI</div>
    </div>`;
  $('#tabs').innerHTML = nav.map(([r, i, l]) => `<button data-go="${r}" data-testid="tab-${r}" class="${cur === r ? 'on' : ''}">${ico(i)}${l}${count(r)}</button>`).join('');
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
/* ---------- workflow callout: the whole flow, drawn like the architect's diagram ----------
   One shared tooltip element (#wf-callout), filled from data the page already has (no extra request). Hover or
   keyboard focus on a project row or card opens it; on a touch screen the first tap opens it and a second closes. */
const WF = {};  // project id -> row with workflow, registered as rows render
function wfTrigger(p){
  if (!p || !p.workflow) return '';
  WF[p.id] = p;
  return `data-wf-pid="${p.id}" aria-describedby="wf-callout" tabindex="0"`;
}
const WF_COUNT_LABEL = [['done', 'completed'], ['waiting', 'waiting'], ['delayed', 'delayed'], ['upcoming', 'upcoming']];
function wfBox(s){
  const mark = HEALTH_MARK[s.health];
  return `<div class="wfc-box h-${s.health}" data-testid="wfc-stage-${s.key}">${wfIcon(s.icon)}<div><b>${s.number ? esc(s.number) + '. ' : ''}${esc(s.label)}</b>
    <div class="st">${mark ? ico(mark) : ''}${esc(s.health === 'done' && s.reason === 'Completed before SiteFlow' ? 'Completed · before SiteFlow' : HEALTH_LABEL[s.health].replace(/^./, c => c.toUpperCase()))}</div>
    ${s.reason && (s.health === 'waiting' || s.health === 'delayed') ? `<div class="small">${esc(s.reason)}</div>` : ''}</div></div>`;
}
function wfFlow(ph){
  const by = Object.fromEntries(ph.stages.map(s => [s.key, s]));
  const arrow = '<div class="wfc-arrow" aria-hidden="true">↓</div>';
  const col = (title, keys) => `<div class="wfc-col"><div class="wfc-col-h">${title}</div>${keys.filter(k => by[k]).map(k => wfBox(by[k])).join(arrow)}</div>`;
  if (by.predesign_site_visit || by.concept)  // Phase 2: the Site and Studio workstreams side by side
    return `<div class="wfc-row two">${col('Site workstream', ['predesign_site_visit', 'investigations'])}${col('Studio workstream', ['concept', 'tentative_elevations'])}</div>`;
  const parts = [], used = new Set();
  for (const s of ph.stages){
    if (used.has(s.key)) continue;
    if (s.key === 'architectural_package' && by.structural_package){  // 8A and 8B run in parallel
      parts.push(`<div class="wfc-row two">${wfBox(s)}${wfBox(by.structural_package)}</div>`); used.add('structural_package');
    } else parts.push(wfBox(s));
    used.add(s.key);
    if (s.key === 'requirements_signoff') parts.push('<div class="wfc-loop">↺ Client review and rework: changes asked by the client come back as a new version</div>');
  }
  return parts.join(arrow);
}
function wfCalloutHtml(p){
  const wf = p.workflow, c = wf.counts, total = Object.values(c).reduce((a, b) => a + b, 0);
  return `<div class="wfc-h"><div><b>${esc(p.name)}</b><div class="small muted">${p.phase ? `Phase ${p.phase.number} · ${esc(p.phase.name)} · ` : ''}${c.done} of ${total} done</div></div>
      <button class="btn sm" data-act="open-project" data-force="1" data-pid="${p.id}" data-testid="wfc-open-${p.id}">Open project</button></div>
    <div class="wfc-legend" data-testid="wfc-counts">${WF_COUNT_LABEL.map(([k, l]) => `<span class="wfc-box h-${k}" style="display:inline-flex;padding:1px 6px">${HEALTH_MARK[k] ? ico(HEALTH_MARK[k]) : ''}${c[k]} ${l}</span>`).join('')}</div>
    ${wf.phases.map(ph => `<div class="wfc-ph" data-testid="wfc-phase-${ph.number}"><div class="wfc-ph-name">${ph.number}. ${esc(ph.name)}</div><div class="wfc-flow">${wfFlow(ph)}</div></div>`).join('')}`;
}
let wfOpenFor = null, wfHoverT = null;
function showCallout(el, pinned){
  const p = WF[el.dataset.wfPid]; if (!p) return;
  const box = $('#wf-callout');
  // A hover callout is a tooltip clicks pass through; a tapped one stays clickable for its Open project button.
  box.classList.toggle('pinned', !!pinned);
  if (wfOpenFor !== String(p.id)){ box.innerHTML = wfCalloutHtml(p); box.setAttribute('data-testid', `wf-callout-${p.id}`); }
  box.hidden = false; box.style.maxHeight = ''; wfOpenFor = String(p.id);
  // Beside a narrow card, else below the row (or above it): never over the row that opened it.
  const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
  let left, top;
  if (r.right + 8 + w <= innerWidth - 8){ left = r.right + 8; top = Math.min(Math.max(8, r.top), innerHeight - h - 8); }
  else {
    // Below or above the row, whichever has more room; the callout scrolls inside that space.
    left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    const below = innerHeight - r.bottom - 14, above = r.top - 14;
    const room = Math.max(below, above);
    box.style.maxHeight = `${Math.max(160, room)}px`;
    const hh = Math.min(box.offsetHeight, Math.max(160, room));
    top = below >= above ? r.bottom + 6 : r.top - hh - 6;
  }
  box.style.left = `${left}px`; box.style.top = `${Math.max(8, top)}px`;
}
function hideCallout(){ clearTimeout(wfHoverT); const box = $('#wf-callout'); if (box){ box.hidden = true; } wfOpenFor = null; }

/* The 10 phases as icons, each coloured by its health (worst stage wins), with a tooltip of its stages.
   Hover or focus shows the tooltip; a tap toggles it. Colour is never the only signal: aria-label and tooltip text. */
const HEALTH_LABEL = {done: 'completed', waiting: 'waiting', delayed: 'delayed', upcoming: 'upcoming'};
const HEALTH_MARK = {done: 'check', waiting: 'cal', delayed: 'alert', upcoming: ''};
function phaseStrip(p){
  const wf = p.workflow;
  if (!wf || typeof wfIcon !== 'function') return legacySteps(p);
  return `<div class="pstrip" data-testid="phase-strip-${p.id}">${wf.phases.map(ph => `<span class="picon h-${ph.health}" role="img" tabindex="0" data-act="phase-tip"
      data-testid="phase-icon-${p.id}-${ph.number}" aria-label="Phase ${ph.number}, ${esc(ph.name)}: ${HEALTH_LABEL[ph.health]}">${wfIcon(ph.icon)}
      <span class="ptip" role="tooltip"><b>Phase ${ph.number} · ${esc(ph.name)}</b>${ph.stages.map(s => `<span class="pt-row h-${s.health}">${HEALTH_MARK[s.health] ? ico(HEALTH_MARK[s.health]) : '<i class="pt-dot"></i>'}<span>${s.number ? esc(s.number) + '. ' : ''}${esc(s.label)}<br><span class="small">${esc(HEALTH_LABEL[s.health])}${s.reason && s.health !== 'done' ? ' · ' + esc(s.reason) : ''}</span></span></span>`).join('')}</span></span>`).join('')}</div>`;
}
/* The project image (a render of the 3D model) as a thumbnail; the current phase's icon when there is none. */
function projectThumb(p, size = 'sm'){
  const alt = `${esc(p.name)} — 3D view`;
  if (p.image && API.projectImageUrl) return `<span class="pthumb ${size}" data-testid="project-thumb-${p.id}"><img data-pimg="${p.id}" data-pstamp="${esc(p.image.updated_at || '')}" alt="${alt}"></span>`;
  const ph = p.workflow && p.workflow.phases.find(x => x.health === 'waiting' || x.health === 'delayed');
  const icon = ph ? ph.icon : (p.workflow ? 'key' : 'folder');
  return `<span class="pthumb ${size} none" data-testid="project-thumb-${p.id}" aria-hidden="true">${typeof wfIcon === 'function' ? wfIcon(icon) : ''}</span>`;
}
function legacySteps(p){
  const at = p.phase ? p.phase.number : 0;
  const cls = n => !p.phase ? '' : n < at ? 'done' : n === at ? 'active' : '';
  return `<div class="ministep" aria-label="Phase ${at} of 10">${Array.from({length: 10}, (_, i) => `<i class="${cls(i + 1)}"></i>`).join('')}</div>`;
}
function projectCard(p){
  const at = p.phase ? p.phase.number : 0;
  const now = (p.current_stages || []).join(' + ');
  return `<div class="pcard" role="button" tabindex="0" data-act="open-project" data-pid="${p.id}" data-testid="project-card-${p.id}" aria-label="Open ${esc(p.name)}, phase ${at} of 10" ${wfTrigger(p)}>
    <div class="pcard-h">${projectThumb(p, 'md')}<div><h3>${esc(p.name)}</h3><div class="loc">${esc(p.location)}</div></div></div>
    ${phaseStrip(p)}
    <div class="now"><span>${now ? `<span class="muted">Now:</span> <b>${esc(now)}</b>` : '<b>All stages complete</b>'}</span><span class="mono muted">${pct(p.official_progress)}</span></div>
    ${p.phase ? `<div class="small muted">Phase ${p.phase.number} · ${esc(p.phase.name)}</div>` : ''}
    <div class="row small muted">${p.civil_engineer ? `<span>${esc(p.civil_engineer.name)}</span>` : ''}${p.latest_visit_status ? pill(VISIT_PILL[p.latest_visit_status], VISIT_LABEL[p.latest_visit_status]) : ''}</div>
  </div>`;
}
function auditText(e){
  const d = e.detail || {};
  switch (e.action){
    case 'project.created': return d.start_stage ? `Project created, onboarded mid-way (earlier stages confirmed by ${d.historical_confirmed_by})` : 'Project created';
    case 'stage.completed': return `Stage completed: ${d.stage}${d.note ? `. ${d.note}` : ''}`;
    case 'stage.exception_recorded': return `Exception recorded on ${d.stage}: ${d.reason}`;
    case 'member.added': return `Added to the project: ${d.user}`;
    case 'fee_plan.updated': return 'Fee plan updated';
    case 'member.removed': return `Removed from the project: ${d.user}`;
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
      <li><b>Meera Joshi</b> opens the dashboard: red flags, and Gokhale Residence waiting for the client.</li>
      <li><b>Mr. Gokhale</b> (client) opens the elevations and signs off the design freeze.</li>
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

V.dashboard = {
  load: async () => {
    ui.data.filters = savedFilters();
    const [d, po] = await Promise.all([API.dashboard(ui.data.filters), can.principal() ? API.principalOverview() : null, template()]);
    ui.data.dash = d; ui.data.po = po;
    // Engineer choices come from the dashboard itself; only the Architect may list users.
    const seen = {}; d.all_projects.forEach(p => { if (p.civil_engineer) seen[p.civil_engineer.id] = p.civil_engineer.name; });
    ui.data.engineers = {...(ui.data.engineers || {}), ...seen};
  },
  html: () => {
    const d = ui.data.dash, f = ui.data.filters;
    const n = Object.keys(f).length;
    return `<div data-testid="dashboard-view"><div class="head"><div><h1>Dashboard</h1><div class="sub">${d.all_projects.length} project${d.all_projects.length === 1 ? '' : 's'}${n ? ` matching ${n} filter${n === 1 ? '' : 's'}` : ''} · ${d.needs_attention.length} need${d.needs_attention.length === 1 ? 's' : ''} attention</div></div>
      ${can.create() ? `<button class="btn primary" data-go="new-project">${ico('plus')}New project</button>` : ''}</div>
    ${ui.data.po ? principalOverview(ui.data.po) : ''}
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
          ${d.all_projects.length ? `<div class="tbl-wrap"><table class="ftable dash-table"><thead><tr><th>Project</th><th>Stage</th><th>Client</th><th>Progress</th><th>Open problems</th><th>Last visit</th><th>Flags</th></tr></thead><tbody>
            ${d.all_projects.map(p => `<tr data-act="open-project" data-pid="${p.id}" data-testid="dash-row-${p.id}" class="clickable" ${wfTrigger(p)}>
              <td><div class="row" style="gap:8px;align-items:flex-start">${projectThumb(p)}<div><b>${esc(p.name)}</b><div class="small muted">${esc(p.location)}</div></div></div></td>
              <td>${p.phase ? `<span class="small muted">Phase ${p.phase.number}</span><div>${esc((p.current_stages || []).join(' + ') || 'Complete')}</div>${p.workflow ? phaseStrip(p) : ''}` : esc(p.current_step || 'Complete')}</td>
              <td>${p.client ? esc(p.client) : '<span class="muted small">Not invited</span>'}${p.waiting_for_client ? `<div>${pill('submitted', 'Waiting for client')}</div>` : ''}</td>
              <td class="mono">${pct(p.official_progress)}</td>
              <td class="mono">${p.open_problems}</td><td class="small">${p.last_visit_at ? fmtStamp(p.last_visit_at) : '<span class="muted">None yet</span>'}</td>
              <td>${p.flag_labels.map(l => pill('rework', l)).join(' ') || '<span class="muted small">None</span>'}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty">No projects match these filters.</div>'}</section>
      </div>
      <div class="stack">
        <section class="panel" data-testid="panel-major"><div class="panel-h"><h2>Major Problems</h2><span class="small muted">Open High and Critical</span></div>
          ${d.major_problems.length ? `<div class="feed">${d.major_problems.map(majorRow).join('')}</div>` : '<div class="empty">No open High or Critical problems.</div>'}</section>
        <section class="panel" data-testid="panel-waiting-client"><div class="panel-h"><h2>Waiting for client</h2><span class="small muted">Longest wait first</span></div>
          ${(d.waiting_for_client || []).length ? `<div class="tasks">${d.waiting_for_client.map(r => `<button class="task" data-act="open-project" data-pid="${r.id}">
            <span class="ti">${ico('check')}</span><span><b>${esc(r.name)}</b><span class="small muted">${esc(r.waiting_for_client.stage)} · version ${r.waiting_for_client.version} · ${esc(r.client || '')}</span></span>
            <span class="meta">${pill(r.flag_labels.includes('Client decision overdue') ? 'rework' : 'submitted', `${r.waiting_for_client.days_waiting} day${r.waiting_for_client.days_waiting === 1 ? '' : 's'}`)}</span></button>`).join('')}</div>`
            : '<div class="empty">No sign-off is waiting for a client.</div>'}</section>
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
  return `<div class="task attn-row" data-testid="attention-${p.id}" ${wfTrigger(p)}>
    <span class="ti" style="background:var(--bad-soft);color:var(--bad)">${ico('flag')}</span>
    <span><b class="row" style="gap:8px">${projectThumb(p)}<button class="linkish" data-act="open-project" data-pid="${p.id}">${esc(p.name)}</button></b><span class="small muted">${esc(p.location)} · ${esc(p.current_step || 'Complete')}</span>
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
      ${sel('fl-phase', 'Phase', [[1, '1 Initiation'], [2, '2 Pre-design'], [3, '3 Structural'], [4, '4 Design development'], [5, '5 Client approval'],
        [6, '6 Detailed drawings'], [7, '7 Construction'], [8, '8 Civil completion'], [9, '9 Finishing'], [10, '10 Handover']], f.phase)}
      ${sel('fl-client_pending', 'Waiting for client', [['true', 'Yes'], ['false', 'No']], f.client_pending)}
      ${sel('fl-step', 'Construction step', [['Legal Approval', 'Legal Approval'], ['Site Visit', 'Site Visit'], ['Team Lead Review', 'Team Lead Review']], f.step)}
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
V.team = {
  load: async () => { ui.data.users = await API.adminUsers(); },
  html: () => {
    const staff = Object.entries(ROLES).filter(([k]) => k !== 'client');
    const made = ui.data.created;
    return `<div data-testid="team-view"><div class="head"><div><h1>Team</h1><div class="sub">${ui.data.users.length} people · staff and clients</div></div></div>
      ${errBox()}
      ${made ? `<div class="banner info"><span><b>${esc(made.user.name)} can now sign in.</b> Temporary password:
        <span class="mono code-text" data-testid="temp-password">${esc(made.temporary_password)}</span><br>
        <span class="small">Shown only once. Pass it on yourself; SiteFlow does not send it.</span></span></div>` : ''}
      <section class="panel"><div class="panel-h"><h3>Add a team member</h3></div>
        <form class="panel-b fgrid" data-form="add-user">
          <div class="field"><label for="au-name">Name</label><input id="au-name" data-testid="add-user-name" required></div>
          <div class="field"><label for="au-email">Email</label><input id="au-email" type="email" data-testid="add-user-email" required></div>
          <div class="field"><label for="au-role">Role</label><select id="au-role" data-testid="add-user-role">${staff.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
          <div class="field"><button class="btn primary" type="submit" data-testid="add-user-submit">${ico('plus')}Add</button></div>
        </form></section>
      <section class="panel"><div class="panel-h"><h3>People</h3></div><div class="tbl-wrap"><table class="ftable">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>${ui.data.users.map(u => {
          const fixed = u.role === 'client' || u.id === ui.me.id;
          return `<tr data-testid="user-row-${u.id}"><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td>
          <td>${fixed ? esc(ROLES[u.role] || u.role) : `<select data-testid="user-role-${u.id}" aria-label="Role of ${esc(u.name)}">${staff.map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`}</td>
          <td>${fixed ? pill(u.active ? 'done' : '', u.active ? 'Active' : 'Inactive') : `<label class="row small"><input type="checkbox" data-testid="user-active-${u.id}" ${u.active ? 'checked' : ''}> Active</label> ${u.active ? '' : pill('', 'Inactive')}`}</td>
          <td>${fixed ? `<span class="small muted">${u.role === 'client' ? 'Managed by invite' : 'You'}</span>` : `<button class="btn sm" data-act="user-save" data-uid="${u.id}" data-testid="user-save-${u.id}">Save</button>`}</td></tr>`;
        }).join('')}</tbody></table></div></section></div>`;
  }
};

/* Admin: bring the in-progress projects in from a spreadsheet saved as CSV (PRD 7.19). Preview first; nothing is
   written until Import. Errors are shown as text on each row, not only by colour. */
V.import = {
  load: async () => {
    const [users, batches] = await Promise.all([API.adminUsers(), API.importBatches()]);
    ui.data.architects = users.filter(u => u.role === 'architect' && u.active); ui.data.batches = batches;
  },
  html: () => {
    const pv = ui.data.preview, res = ui.data.result;
    return `<div data-testid="import-view"><div class="head"><div><h1>Import projects</h1><div class="sub">Bring in projects already in progress, at their current stage.</div></div>
      <button class="btn" data-act="import-template" data-testid="import-template">${ico('doc')}Download the template</button></div>
      ${errBox()}
      <section class="panel"><div class="panel-h"><h3>1. Choose the file</h3></div><div class="panel-b stack" style="gap:10px">
        <p class="small muted">Fill in the template in Excel or Google Sheets and save it as CSV (UTF-8). Leave current_stage blank for a new project; for a project already under way, give the stage key and who confirms the earlier stages.</p>
        <div class="row"><input type="file" accept=".csv,text/csv" id="im-file" data-testid="import-file" aria-label="CSV file">
          <button class="btn primary sm" data-act="import-preview" data-testid="import-preview">Check the file</button>
          ${ui.data.importFile ? `<span class="small muted" data-testid="import-checked-file">Checked: ${esc(ui.data.importFile.name)}</span>` : ''}</div>
      </div></section>
      ${pv ? `<section class="panel" data-testid="import-preview-table"><div class="panel-h"><h3>2. Check each row</h3>
          <span class="small" data-testid="import-counts">${pv.counts.rows} rows · ${pv.counts.ok} ready · ${pv.counts.errors} with errors</span></div>
        <div class="tbl-wrap"><table class="ftable"><thead><tr><th>Row</th><th>Project</th><th>Current stage</th><th>Civil engineer</th><th>Result</th></tr></thead><tbody>
          ${pv.rows.map(r => `<tr data-testid="import-row-${r.row}" class="${r.ok ? '' : 'row-bad'}"><td class="mono">${r.row}</td><td>${esc(r.values.project_name || '—')}</td>
            <td>${esc(r.values.current_stage || 'New project')}</td><td>${esc(r.values.civil_engineer_email)}</td>
            <td>${r.ok ? pill('done', 'Ready') : `${pill('rework', 'Error')}<ul class="small">${r.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="panel-b fgrid">
          <div class="field"><label for="im-arch">Project Architect for these projects</label><select id="im-arch" data-testid="import-architect">${ui.data.architects.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
          <div class="field"><span class="lbl">If a row has errors</span>
            <label class="radio small"><input type="radio" name="im-mode" value="all_or_nothing" data-testid="import-mode-all" checked> Import nothing until every row is fixed</label>
            <label class="radio small"><input type="radio" name="im-mode" value="valid_rows_only" data-testid="import-mode-valid"> Import the ready rows only</label></div>
          <div class="field full"><button class="btn primary" data-act="import-commit" data-testid="import-commit">Import</button></div>
        </div></section>` : ''}
      ${res ? `<section class="panel" data-testid="import-result"><div class="panel-h"><h3>Imported ${res.projects.length} project${res.projects.length === 1 ? '' : 's'}</h3></div>
        <div class="panel-b stack" style="gap:6px">${res.projects.map(p => `<button class="btn ghost sm" data-act="open-project" data-pid="${p.id}" data-testid="import-project-${p.id}">${esc(p.name)}</button>`).join('')}</div></section>` : ''}
      ${ui.data.batches.length ? `<section class="panel"><div class="panel-h"><h3>Earlier imports</h3></div><div class="panel-b audit">
        ${ui.data.batches.map(b => `<div><span class="mono muted small">${fmtStamp(b.at)}</span><span>${esc(b.filename)} · ${b.imported} of ${b.rows} imported · ${esc(b.mode === 'all_or_nothing' ? 'all or nothing' : 'ready rows only')} · ${esc(b.by ? b.by.name : '')}</span></div>`).join('')}</div></section>` : ''}
    </div>`;
  }
};

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

const normName = n => String(n || '').replace(/\s+/g, ' ').trim().toLowerCase();

V['client-signoff'] = {
  load: async () => { ui.data.so = await API.clientSignoff(ui.p.sid); ui.data.docUrl = null; },
  html: () => {
    const s = ui.data.so, opened = s.attachments.filter(a => a.viewed).length, total = s.attachments.length;
    const doc = s.attachments.find(a => a.id === ui.p.openDoc);
    return `<div data-testid="client-signoff"><div class="crumbs"><button data-act="client-open" data-pid="${s.project.id}">${ico('back')}${esc(s.project.name)}</button>/<span>Sign-off</span></div>
      <div class="head"><div><div class="eyebrow">${esc(s.stage)} · version ${s.version}</div><h1>${esc(s.title)}</h1>
        <div class="sub">Sent ${fmtStamp(s.sent_at)}. Review every document, then sign off or ask for changes.</div></div>
        <div class="row">${pill({sent: 'submitted', approved: 'done', changes_requested: 'rework'}[s.status], {sent: 'Waiting for you', approved: 'Signed', changes_requested: 'Changes requested'}[s.status])}</div></div>
      ${errBox()}
      <div class="act"><div class="form">
        <section class="sec"><div class="sec-h"><h3>${ico('doc')}What you are approving</h3></div><div class="sec-b"><p class="so-summary">${esc(s.summary)}</p></div></section>
        <section class="sec"><div class="sec-h"><h3>${ico('image')}Documents</h3><span class="pcount ${opened < total ? 'short' : ''}">${opened} of ${total} opened</span></div>
          <div class="sec-b mlist">${s.attachments.map(a => `<div class="mitem doc-row">${ico(a.content_type === 'application/pdf' ? 'doc' : 'image')}<span>${esc(a.filename)}</span>
            ${a.viewed ? pill('done', 'Opened') : pill('', 'Not opened')}
            <button class="btn sm" data-act="client-doc" data-aid="${a.id}" data-testid="signoff-open-${a.id}">${ui.p.openDoc === a.id ? 'Showing' : 'Open'}</button></div>`).join('')}</div>
          ${doc && ui.data.docUrl ? `<div class="doc-viewer" data-testid="signoff-viewer">${doc.content_type === 'application/pdf'
            ? `<iframe src="${ui.data.docUrl}" title="${esc(doc.filename)}"></iframe>` : `<img src="${ui.data.docUrl}" alt="${esc(doc.filename)}">`}
            <a class="btn sm ghost" href="${ui.data.docUrl}" download="${esc(doc.filename)}">Download ${esc(doc.filename)}</a></div>` : ''}
        </section>
      </div>
      <div class="panel reqpanel"><div class="panel-h"><h3>Your decision</h3></div><div class="panel-b form">
        ${s.can_respond ? `
          <ul class="reqlist" data-testid="signoff-checklist">
            <li class="${opened === total ? 'ok' : 'no'}"><span class="ck">${opened === total ? ico('check') : ''}</span>Open every document (${opened} of ${total} opened)</li>
            <li class="no" id="so-need-confirm"><span class="ck"></span>Tick the confirmation</li>
            <li class="no" id="so-need-name"><span class="ck"></span>Type your full name: ${esc(ui.me.name)}</li></ul>
          <label class="chk so-confirm"><input type="checkbox" id="so-confirm" data-testid="signoff-confirm"><span>${esc(s.confirmation_text)}</span></label>
          <div class="field"><label for="so-name">Your full name</label><input id="so-name" data-testid="signoff-name" autocomplete="name" placeholder="${esc(ui.me.name)}"></div>
          <button class="btn primary" data-act="client-approve" data-testid="signoff-approve" disabled>${ico('check')}Sign off version ${s.version}</button>
          <div class="subh">Or ask for changes</div>
          <div class="field"><label for="so-changes">What should change?</label><textarea id="so-changes" rows="3" data-testid="signoff-changes-comment"></textarea></div>
          <button class="btn danger" data-act="client-changes" data-testid="signoff-request-changes">Ask for changes</button>`
        : s.status === 'approved' ? `<div class="banner ok">${ico('check')}<span>You signed this version as ${esc(s.signer_name)} on ${fmtStamp(s.responded_at)}.</span></div>`
        : `<div class="banner rework">${ico('alert')}<span>You asked for changes on ${fmtStamp(s.responded_at)}: “${esc(s.response_comment)}”. Your architect will send a new version.</span></div>`}
      </div></div></div></div>`;
  }
};

/* Approve unlocks only when every document is opened, the box is ticked and the typed name is the client's. */
function syncApprove(){
  const btn = $('[data-testid="signoff-approve"]'); if (!btn || !ui.data.so) return;
  const allOpened = ui.data.so.attachments.every(a => a.viewed);
  const confirmed = $('#so-confirm').checked, named = normName($('#so-name').value) === normName(ui.me.name) && !!normName(ui.me.name);
  const mark = (id, ok) => { const li = $(id); if (li){ li.className = ok ? 'ok' : 'no'; li.querySelector('.ck').innerHTML = ok ? ico('check') : ''; } };
  mark('#so-need-confirm', confirmed); mark('#so-need-name', named);
  btn.disabled = !(allOpened && confirmed && named);
}

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
            <div class="phase-h">${ph.icon && typeof wfIcon === 'function' ? `<span class="picon ${done ? 'h-done' : cur ? 'h-waiting' : 'h-upcoming'}" aria-hidden="true">${wfIcon(ph.icon)}</span>` : `<span class="phase-n">${ph.number}</span>`}<b>${esc(ph.name)}</b>
              ${done ? `<button class="btn ghost sm" data-act="client-unfold" data-n="${ph.number}" data-testid="client-unfold-${ph.number}">${folded ? `Completed · show ${ph.stages.length} stage${ph.stages.length === 1 ? '' : 's'}` : 'Hide'}</button>` : ''}</div>
            ${folded ? '' : ph.stages.map(s => { const [cls, label] = CLIENT_STATE[s.state];
              return `<div class="cstage" data-testid="client-stage-${s.key}"><div><b>${s.number ? esc(s.number) + '. ' : ''}${esc(s.label)}</b>
                <div class="small muted">${esc(s.detail)}</div>
                ${s.signed ? `<div class="small signed">${ico('check')}Signed by ${esc(s.signed.by)} on ${fmtStamp(s.signed.at)} (version ${s.signed.version})</div>`
                  : s.is_signoff && s.state !== 'historical' ? `<div class="small muted">${ico('flag')}Your sign-off</div>` : ''}</div>
                <div class="cstage-s">${pill(cls, label)}${s.completed_at ? `<span class="small muted">${fmtDate(ymd(new Date(s.completed_at)))}</span>` : ''}</div></div>`; }).join('')}
          </div>`; }).join('')}</div></section>
      ${p.shared_updates.length ? `<section class="panel" data-testid="client-updates"><div class="panel-h"><h2>Updates from your architect</h2></div>
        <div class="panel-b stack" style="gap:14px">${p.shared_updates.map(u => `<div class="cupdate"><div class="small muted">${fmtStamp(u.shared_at)}${u.stage ? ` · ${esc(u.stage)} stage` : ''}</div>
          <p>${esc(u.note)}</p>${u.photos.length ? `<div class="photos">${u.photos.map(ph => `<div class="ph"><img data-cuid="${u.id}" data-cmid="${ph.id}" alt="Site photo"></div>`).join('')}</div>` : ''}</div>`).join('')}</div></section>` : ''}
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
  load: async () => { [ui.data.engineers] = await Promise.all([API.engineers(), template()]); },
  html: () => {
    const eng = ui.data.engineers || [];
    const f = ui.p.form || {};
    const flow = (TEMPLATE && TEMPLATE.flow) || [];
    return `<div class="crumbs"><button data-go="projects">Projects</button>/<span>New project</span></div>
    <div class="head"><div><h1>New project</h1><div class="sub">Residential workflow: 18 stages from project setup to handover, with client sign-off at the major milestones.</div></div></div>
    ${errBox()}
    <form class="sec" data-form="new-project"><div class="sec-h"><h3>Project</h3></div><div class="sec-b"><div class="fgrid">
      <div class="field"><label for="np-name">Project name <span class="req">Required</span></label><input id="np-name" data-testid="np-name" value="${esc(f.name)}" placeholder="e.g. Pashan Residence"></div>
      <div class="field"><label for="np-loc">Location <span class="req">Required</span></label><input id="np-loc" data-testid="np-location" value="${esc(f.location)}" placeholder="Plot, road, area, city"></div>
      <div class="field"><label for="np-eng">Civil Engineer <span class="req">Required</span></label><select id="np-eng" data-testid="np-engineer">${eng.map(u => `<option value="${u.id}" ${String(u.id) === String(f.civil_engineer_id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="np-date">Legal Approval expected by</label><input id="np-date" data-testid="np-legal-date" type="date" value="${esc(f.legal_expected_date)}"></div>
      <div class="field full subh">Client and site <span class="small muted">optional; the client's contacts are staff-only</span></div>
      <div class="field"><label for="np-client">Client name</label><input id="np-client" data-testid="np-client" value="${esc(f.client_name)}" placeholder="Family, person or company"></div>
      <div class="field"><label for="np-client-phone">Signatory phone</label><input id="np-client-phone" data-testid="np-client-phone" type="tel" value="${esc(f.client_phone)}" placeholder="+91"></div>
      <div class="field"><label for="np-client-email">Signatory email</label><input id="np-client-email" data-testid="np-client-email" type="email" value="${esc(f.client_email)}"></div>
      <div class="field"><label for="np-site">Site address</label><input id="np-site" data-testid="np-site" value="${esc(f.site_address)}" placeholder="Plot and road"></div>
      <div class="field"><label for="np-city">City</label><input id="np-city" data-testid="np-city" value="${esc(f.site_city)}" placeholder="Pune"></div>
      ${flow.length ? `<details class="field full onboard" ${f.start_stage ? 'open' : ''}><summary data-testid="np-in-progress"><b>Already in progress?</b> <span class="small muted">Start the project at its current stage.</span></summary>
        <div class="fgrid" style="margin-top:10px">
          <div class="field"><label for="np-start">Current stage</label><select id="np-start" data-testid="np-start"><option value="">A new project (start at Project setup)</option>
            ${TEMPLATE.phases.map(ph => `<optgroup label="Phase ${ph.number} · ${esc(ph.name)}">${flow.filter(s => s.phase === ph.number && s.key !== flow[0].key)
              .map(s => `<option value="${s.key}" ${s.key === f.start_stage ? 'selected' : ''}>${s.number ? esc(s.number) + '. ' : ''}${esc(s.label)}</option>`).join('')}</optgroup>`).join('')}</select></div>
          <div class="field"><label for="np-confirmer">Earlier stages confirmed by</label><input id="np-confirmer" data-testid="np-confirmer" value="${esc(f.historical_confirmed_by)}" placeholder="Who confirms they were done"></div>
          <p class="small muted full">Earlier stages are recorded as “Historical — completed before SiteFlow”. They are never shown as client sign-offs, and all normal rules apply from the current stage.</p>
        </div></details>` : ''}
      <div class="field full"><button class="btn primary" type="submit" data-testid="np-submit">Create project</button></div>
    </div></div></form>`;
  }
};

V.project = {
  load: async () => {
    const [p, visits, problems, stages, clients] = await Promise.all([API.project(ui.p.pid), API.visits ? API.visits(ui.p.pid) : null,
      API.problems ? API.problems(ui.p.pid) : null, API.stages ? API.stages(ui.p.pid) : null,
      API.projectClients ? API.projectClients(ui.p.pid) : null, template()]);
    ui.data.project = p; ui.data.visits = visits; ui.data.problems = problems; ui.data.stages = stages; ui.data.clients = clients;
    ui.data.signoffs = API.signoffs ? await API.signoffs(ui.p.pid) : [];
    if (can.admin() && API.projectMembers){
      [ui.data.members, ui.data.allUsers] = await Promise.all([API.projectMembers(ui.p.pid), API.adminUsers()]);
    }
  },
  html: () => {
    const p = ui.data.project;
    const cur = p.steps.find(s => s.status === 'active');
    return `<div class="crumbs"><button data-go="projects">Projects</button>/<span>${esc(p.name)}</span></div>
    <div class="head"><div class="row" style="gap:12px">${projectThumb(p, 'lg')}<div><h1 data-testid="project-title">${esc(p.name)}</h1><div class="sub">${esc(p.location)}</div>
      ${can.create() || can.admin() ? `<div class="row small" style="gap:6px;margin-top:4px"><button class="btn ghost sm" data-act="project-image" data-testid="project-image-upload">${ico('camera')}${p.image ? 'Replace project image' : 'Add project image'}</button>
        ${p.image ? '<button class="btn ghost sm" data-act="project-image-remove" data-testid="project-image-remove">Remove</button>' : ''}</div>` : ''}</div></div>
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
          ${p.client ? `<dt>Client</dt><dd data-testid="project-client">${esc(p.client.name)}${p.client.contacts.filter(c => c.is_signatory).map(c => `<div class="small muted">${esc(c.name)}${c.phone ? ` · ${esc(c.phone)}` : ''}${c.email ? ` · ${esc(c.email)}` : ''}</div>`).join('')}</dd>` : ''}
          ${p.site ? `<dt>Site</dt><dd data-testid="project-site">${esc(p.site.address)}${p.site.city ? `, ${esc(p.site.city)}` : ''}</dd>` : ''}
          <dt>Civil Engineer</dt><dd>${esc(p.civil_engineer ? p.civil_engineer.name : '—')}</dd>
          <dt>Template</dt><dd>Residential v${p.template.version}</dd></dl></div></section>
        ${p.fee_plan ? feePlanPanel(p) : ''}
        ${ui.data.clients ? clientPanel(ui.data.clients) : ''}
        ${ui.data.members ? membersPanel(ui.data.members, ui.data.allUsers || []) : ''}
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
/* Commercial: the server sends fee_plan only to roles allowed to see it; Architect, Admin and Accounts may edit. */
const money = (v, cur) => v == null ? '—' : `${cur === 'INR' ? '₹' : cur + ' '}${Number(v).toLocaleString('en-IN', {maximumFractionDigits: 2})}`;
function feePlanPanel(p){
  const f = p.fee_plan, edit = ui.me && ['architect', 'admin', 'accounts'].includes(ui.me.role);
  return `<section class="panel" data-testid="fee-plan-panel"><div class="panel-h"><h3>Fee plan</h3><span class="small muted">Commercial · not shown to site staff or clients</span></div><div class="panel-b">
    <dl class="kv"><dt>Contract value</dt><dd data-testid="fee-contract-value">${esc(money(f.contract_value, f.currency))}</dd>
      <dt>Fee basis</dt><dd>${esc(f.fee_basis || '—')}</dd>${f.fee_notes ? `<dt>Notes</dt><dd>${esc(f.fee_notes)}</dd>` : ''}</dl>
    ${edit ? `<details class="onboard" style="margin-top:10px"><summary data-testid="fee-edit">Edit fee plan</summary><div class="fgrid" style="margin-top:10px">
      <div class="field"><label for="fp-value">Contract value</label><input id="fp-value" data-testid="fee-value" inputmode="decimal" value="${esc(f.contract_value || '')}"></div>
      <div class="field"><label for="fp-cur">Currency</label><input id="fp-cur" data-testid="fee-currency" maxlength="3" value="${esc(f.currency)}"></div>
      <div class="field full"><label for="fp-basis">Fee basis</label><input id="fp-basis" data-testid="fee-basis" value="${esc(f.fee_basis || '')}"><span class="small muted">${esc((TEMPLATE && TEMPLATE.fee_basis_help) || '')}</span></div>
      <div class="field full"><label for="fp-notes">Notes</label><input id="fp-notes" data-testid="fee-notes" value="${esc(f.fee_notes || '')}"></div>
      <div class="field full"><button class="btn sm primary" data-act="fee-save" data-testid="fee-save">Save fee plan</button></div></div></details>` : ''}
  </div></section>`;
}

/* Principal architect only (the server refuses everyone else): completion, client fees, major milestones and
   major issues for every project. Each state has a word beside its colour. */
const MS_WORD = {done: 'Done', waiting: 'Waiting', delayed: 'Delayed', upcoming: 'Not started'};
function milestoneStrip(r){
  return `<div class="pstrip" data-testid="po-milestones-${r.id}">${r.milestones.map(m => `<span class="picon h-${m.health}" role="img"
    aria-label="${esc(m.label)}: ${HEALTH_LABEL[m.health]}" title="${esc(m.label)}: ${esc(MS_WORD[m.health])}">${typeof wfIcon === 'function' ? wfIcon(m.icon) : ''}</span>`).join('')}</div>`;
}
function issueItem(i){
  const resolved = i.status === 'resolved';
  return `<div class="po-issue" data-testid="po-issue-${i.id}">
    <div class="row">${pill(i.severity === 'Critical' ? 'rework' : 'submitted', i.severity)} <b>${esc(i.problem)}</b>${resolved ? pill('done', 'Resolved') : i.overdue ? pill('rework', 'Overdue') : ''}</div>
    <div class="small">${esc(i.location)} · Responsible: ${esc(i.responsible_party)} · Target ${esc(fmtDate(i.target_date))} · Open ${i.days_open} day${i.days_open === 1 ? '' : 's'}</div>
    ${resolved ? `<div class="small"><span class="muted">Resolution:</span> ${esc(i.resolution_note || '—')}${i.resolved_by ? ` · ${esc(i.resolved_by.name)}` : ''}</div>`
      : i.recommended_action ? `<div class="small"><span class="muted">Action:</span> ${esc(i.recommended_action)}</div>` : ''}
  </div>`;
}
function principalRow(r){
  const f = r.fees, open = ui.p.poOpen === r.id;
  return `<div class="po-row" data-testid="po-row-${r.id}">
    <div class="po-sum">${projectThumb(r)}<div class="po-name"><b>${esc(r.name)}</b><div class="small muted">${esc(r.location)}</div></div>
      <div class="po-cell"><span class="eyebrow">Complete</span><b class="mono">${pct(r.completion.percent)}</b><span class="small muted">Construction ${pct(r.completion.construction_progress)}</span></div>
      <div class="po-cell"><span class="eyebrow">Due</span><b class="mono">${esc(money(f.due, f.currency))}</b></div>
      <div class="po-cell"><span class="eyebrow">Received</span><b class="mono">${esc(money(f.received, f.currency))}</b></div>
      <div class="po-cell"><span class="eyebrow">Outstanding</span><b class="mono">${esc(money(f.outstanding, f.currency))}</b></div>
      <div class="po-cell"><span class="eyebrow">Major issues</span><b class="mono" data-testid="po-issues-${r.id}">${r.issues.open.length}</b></div>
      ${milestoneStrip(r)}
      <button class="btn ghost sm" data-act="po-toggle" data-pid="${r.id}" data-testid="po-toggle-${r.id}" aria-expanded="${open}">${open ? 'Hide' : 'Details'}</button></div>
    ${open ? `<div class="po-detail grid2" data-testid="po-detail-${r.id}">
      <div><h4>Major milestones</h4><ul class="po-ms">${r.milestones.map(m => `<li class="h-${m.health}"><b>${m.number ? esc(m.number) + '. ' : ''}${esc(m.label)}</b>
        <span class="small">${esc(MS_WORD[m.health])}${m.completed_at ? ` · ${esc(fmtStamp(m.completed_at))}` : ''}${m.completed_by ? ` · ${esc(m.completed_by.name)}` : ''}${m.reason && (m.health !== 'done' || !m.completed_at) ? ` · ${esc(m.reason)}` : ''}</span></li>`).join('')}</ul></div>
      <div><h4>Major issues</h4>${r.issues.open.length ? r.issues.open.map(i => issueItem(i)).join('') : '<div class="small muted">No open High or Critical issues.</div>'}
        ${r.issues.resolved.length ? `<h4>Recently resolved</h4>${r.issues.resolved.map(i => issueItem(i)).join('')}` : ''}</div>
    </div>` : ''}
  </div>`;
}
function principalOverview(po){
  const t = po.portfolio, fees = t.fees.length ? t.fees : [{currency: 'INR', due: 0, received: 0, outstanding: 0}];
  const sum = k => fees.map(x => esc(money(x[k], x.currency))).join(' + ');
  return `<section class="panel" data-testid="principal-overview"><div class="panel-h"><h2>Principal overview</h2><span class="small muted">Only you see this</span></div>
    <div class="kpis">
      <div class="kpi"><b>${t.projects}</b><span>Projects</span></div>
      <div class="kpi"><b>${pct(t.average_completion)}</b><span>Average completion</span></div>
      <div class="kpi"><b data-testid="po-due">${sum('due')}</b><span>Fees due</span></div>
      <div class="kpi"><b data-testid="po-received">${sum('received')}</b><span>Fees received</span></div>
      <div class="kpi ${fees.some(x => Number(x.outstanding) > 0) ? 'attn' : ''}"><b data-testid="po-outstanding">${sum('outstanding')}</b><span>Outstanding</span></div>
      <div class="kpi ${t.open_major_issues ? 'alert' : ''}"><b>${t.open_major_issues}</b><span>Open major issues</span></div>
      <div class="kpi"><b>${t.milestones_waiting}</b><span>Milestones waiting</span></div>
    </div>
    ${po.projects.length ? `<div class="po-list">${po.projects.map(principalRow).join('')}</div>` : '<div class="empty">No projects yet.</div>'}
  </section>`;
}

/* Accounts: client fees due and received per project. Entries can't be edited; a correction is a negative
   entry with a reason. */
V.fees = {
  load: async () => {
    ui.data.projects = await API.projects();
    const pid = ui.p.pid || (ui.data.projects[0] && ui.data.projects[0].id);
    ui.data.pid = pid;
    ui.data.ledger = pid ? await API.fees(pid) : null;
  },
  html: () => {
    const list = ui.data.projects, L = ui.data.ledger, t = L && L.totals;
    return `<div data-testid="fees-view"><div class="head"><div><h1>Client fees</h1><div class="sub">Fees due and received · seen only by Accounts and the principal architect</div></div></div>
      ${errBox()}
      ${list.length ? `<section class="panel"><div class="panel-b row"><label for="fe-project">Project</label>
        <select id="fe-project" data-testid="fees-project">${list.map(p => `<option value="${p.id}" ${p.id === ui.data.pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div></section>` : '<section class="panel"><div class="empty">You are not on any project yet.</div></section>'}
      ${L ? `<div class="kpis" data-testid="fees-totals">
          <div class="kpi"><b>${esc(money(t.due, t.currency))}</b><span>Due</span></div>
          <div class="kpi"><b>${esc(money(t.received, t.currency))}</b><span>Received</span></div>
          <div class="kpi ${Number(t.outstanding) > 0 ? 'attn' : ''}"><b>${esc(money(t.outstanding, t.currency))}</b><span>Outstanding</span></div></div>
        <section class="panel"><div class="panel-h"><h3>Record an entry</h3></div>
          <form class="panel-b fgrid" data-form="fee-record">
            <div class="field"><label for="fe-kind">Type</label><select id="fe-kind" data-testid="fee-kind"><option value="due">Fee due</option><option value="received">Payment received</option></select></div>
            <div class="field"><label for="fe-amount">Amount (${esc(t.currency)})</label><input id="fe-amount" data-testid="fee-amount" inputmode="decimal" required></div>
            <div class="field"><label for="fe-date">Date</label><input id="fe-date" type="date" data-testid="fee-date" value="${today()}" required></div>
            <div class="field"><label for="fe-ref">Reference</label><input id="fe-ref" data-testid="fee-reference" maxlength="120" placeholder="Needed for a payment received"></div>
            <div class="field full"><label for="fe-note">Note</label><input id="fe-note" data-testid="fee-note" placeholder="A correction (negative amount) needs a reason"></div>
            <div class="field full"><button class="btn primary" type="submit" data-testid="fee-submit">${ico('plus')}Record</button></div>
          </form></section>
        <section class="panel"><div class="panel-h"><h3>Entries</h3></div>
          ${L.entries.length ? `<div class="tbl-wrap"><table class="ftable" data-testid="fees-entries"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th><th>Note</th><th>Recorded by</th></tr></thead><tbody>
            ${L.entries.map(e => `<tr><td>${esc(fmtDate(e.date))}</td><td>${e.kind === 'due' ? 'Fee due' : 'Payment received'}</td><td class="mono">${esc(money(e.amount, e.currency))}</td>
              <td>${esc(e.reference || '—')}</td><td>${esc(e.note || '')}</td><td class="small">${esc(e.recorded_by ? e.recorded_by.name : '')}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty" data-testid="fees-entries">No entries yet.</div>'}</section>` : ''}
    </div>`;
  }
};

/* Admin only: who is on the project. Clients join through the invite, so they are not offered here. */
function membersPanel(members, all){
  const on = new Set(members.map(m => m.id));
  const candidates = all.filter(u => u.active && u.role !== 'client' && !on.has(u.id));
  return `<section class="panel" data-testid="members-panel"><div class="panel-h"><h3>Team on this project</h3></div><div class="panel-b stack" style="gap:10px">
    ${members.map(m => `<div class="person" data-testid="member-${m.id}"><span class="av">${esc(initials(m.name))}</span><div style="flex:1"><b>${esc(m.name)}</b>
      <div class="small muted">${esc(ROLES[m.role] || m.role)}${m.active ? '' : ' · Inactive'}</div></div>
      ${m.removable ? `<button class="btn ghost sm" data-act="member-remove" data-uid="${m.id}" data-testid="member-remove-${m.id}">Remove</button>`
        : `<span class="small muted">${m.role === 'client' ? 'Client' : 'Required'}</span>`}</div>`).join('')}
    ${candidates.length ? `<div class="row"><select id="mb-add" data-testid="member-add-select" aria-label="Add a team member">
      ${candidates.map(u => `<option value="${u.id}">${esc(u.name)} · ${esc(ROLES[u.role] || u.role)}</option>`).join('')}</select>
      <button class="btn sm" data-act="member-add" data-testid="member-add">${ico('plus')}Add to project</button></div>` : ''}
  </div></section>`;
}

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
    <span class="stage-b"><b>${esc(s.label)}</b><span class="small muted">${esc(s.workstream)} · ${esc(ROLES[s.owner_role] || s.owner_role)}${s.signed_by_client ? ' · signed by the client' : ''}${(s.attachments || []).length ? ` · <span data-testid="stage-file-count-${s.key}">${s.attachments.length} file${s.attachments.length === 1 ? '' : 's'}</span>` : ''}</span></span>
    ${pill(cls, label)}</button>`;
}
function stageDetail(s){
  return `<div class="stage-detail" data-testid="stage-detail-${s.key}">
    <p class="small">${esc(s.detail)}${s.prd_stage != null ? ` <span class="pill" data-testid="stage-prd-${s.key}" title="Stage number in the SiteFlow PRD">PRD stage ${s.prd_stage}</span>` : ''}</p>
    ${s.reasons.length ? `<ul class="reasons">${s.reasons.map(r => `<li>${ico('alert')}<span>${esc(r)}</span></li>`).join('')}</ul>` : ''}
    ${s.historical ? `<div class="banner info">${ico('flag')}<span><b>${esc(s.historical.label)}</b>. Confirmed by ${esc(s.historical.confirmed_by || 'not recorded')}. ${esc(s.historical.note || '')}</span></div>` : ''}
    ${s.state === 'completed' ? `<div class="small"><b>Completed</b> ${fmtStamp(s.completed_at)}${s.completed_by ? ` by ${esc(s.completed_by.name)}` : ''}${s.completion_note ? `: ${esc(s.completion_note)}` : ''}</div>` : ''}
    ${(s.exceptions || []).map(x => `<div class="banner info" data-testid="stage-exception-note-${s.key}-${x.gate}">${ico('flag')}<span><b>Exception recorded</b> by ${esc(x.by ? x.by.name : 'someone')} ${fmtStamp(x.at)}: ${esc(x.reason)}</span></div>`).join('')}
    ${(s.gates || []).includes('client_signoff') && s.state !== 'historical' ? signoffComposer(s) : ''}
    ${s.can_record_exception && (s.open_exceptions || []).length ? exceptionForm(s) : ''}
    ${(s.attachments || []).length || s.can_attach ? stageFiles(s) : ''}
    ${s.evidence_reason ? `<div class="banner rework" data-testid="stage-evidence-${s.key}">${ico('alert')}<span>${esc(s.evidence_reason)}</span></div>` : ''}
    ${s.can_complete ? `<div class="flag-clear-form"><input class="inp" id="st-note-${s.key}" data-testid="stage-note-${s.key}" placeholder="What was completed? (required)" aria-label="Completion note">
      <button class="btn sm primary" data-act="stage-complete" data-key="${s.key}" data-testid="stage-complete-${s.key}" ${(s.evidence_missing || []).length ? 'disabled' : ''}>${ico('check')}Mark complete</button></div>` : ''}
  </div>`;
}

/* Files on a stage: photos show as thumbnails; video, PDF and AutoCAD drawings as chips that download. */
const FILE_ICON = {photo: 'camera', video: 'video', document: 'doc', cad: 'split'};
const kb = n => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
function stageFiles(s){
  const files = s.attachments || [], up = ui.p.stageUpload && ui.p.stageUpload.key === s.key ? ui.p.stageUpload : null;
  const me = ui.me && ui.me.id;
  return `<div class="stage-files" data-testid="stage-files-${s.key}">
    ${files.length ? `<div class="sf-list">${files.map(f => `<div class="sf ${f.kind}" data-testid="stage-file-${f.id}">
      ${f.kind === 'photo' ? `<button class="sf-thumb" data-act="stage-file-open" data-key="${s.key}" data-id="${f.id}" aria-label="Open ${esc(f.filename)}"><img data-sfid="${f.id}" data-sfkey="${s.key}" alt="${esc(f.filename)}"></button>`
        : `<span class="sf-ic">${ico(FILE_ICON[f.kind] || 'doc')}</span>`}
      <span class="sf-meta"><button class="linkish" data-act="stage-file-open" data-key="${s.key}" data-id="${f.id}">${esc(f.filename)}</button>
        <span class="small muted">${esc(f.kind === 'cad' ? 'AutoCAD drawing' : f.kind === 'document' ? 'PDF' : f.kind)} · ${kb(f.size)}${f.uploaded_by ? ` · ${esc(f.uploaded_by.name)}` : ''}</span></span>
      ${!f.completed_at && s.state !== 'completed' && f.uploaded_by && f.uploaded_by.id === me ? `<button class="btn ghost sm" data-act="stage-file-remove" data-key="${s.key}" data-id="${f.id}" data-testid="stage-file-remove-${f.id}">Remove</button>` : ''}
    </div>`).join('')}</div>` : ''}
    ${up ? `<div class="small" data-testid="stage-upload-progress">Uploading ${esc(up.name)}… ${Math.round(up.pct * 100)}%</div>` : ''}
    ${s.can_attach && s.state !== 'completed' ? `<div class="row sf-add">
      <button class="btn sm" data-act="stage-attach" data-kind="photo" data-key="${s.key}" data-testid="stage-attach-photo-${s.key}">${ico('camera')}Add photo</button>
      <button class="btn sm" data-act="stage-attach" data-kind="video" data-key="${s.key}" data-testid="stage-attach-video-${s.key}">${ico('video')}Add video</button>
      <button class="btn sm" data-act="stage-attach" data-kind="file" data-key="${s.key}" data-testid="stage-attach-file-${s.key}">${ico('doc')}Add drawing or document</button></div>
      <div class="small muted">Photos, videos, PDFs and AutoCAD drawings (DWG, DXF). Files are kept with the stage once it is completed.</div>` : ''}
  </div>`;
}

const STAGE_ACCEPT = {photo: 'image/jpeg,image/png,image/webp', video: 'video/mp4,video/webm', file: '.dwg,.dxf,.pdf,application/pdf'};
function pickStageFile(key, kind){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.hidden = true; inp.accept = STAGE_ACCEPT[kind];
  if (kind === 'photo') inp.setAttribute('capture', 'environment');
  inp.multiple = kind !== 'video';
  inp.addEventListener('change', async () => {
    const files = [...inp.files]; inp.remove();
    for (const f of files){
      ui.p.stageUpload = {key, name: f.name, pct: 0}; rerenderKeepScroll();
      try { await API.uploadStageFile(ui.data.project.id, key, f, pct => { ui.p.stageUpload = {key, name: f.name, pct}; const el = $('[data-testid="stage-upload-progress"]'); if (el) el.textContent = `Uploading ${f.name}… ${Math.round(pct * 100)}%`; }); }
      catch (err){ toast(err.message); }
    }
    ui.p.stageUpload = null;
    try { ui.data.stages = await API.stages(ui.data.project.id); } catch (_) {}
    rerenderKeepScroll();
  });
  document.body.appendChild(inp);
  inp.click();
}

/* A placeholder gate (a check SiteFlow doesn't have yet) passes only with a recorded, reasoned exception. */
const GATE_NAME = {payment: 'Payment check', finding_disposition: 'Site findings check', issue_closure: 'Coordination issues check',
  document_status: 'Drawing status check', checklist: 'Civil completion checklist'};
function exceptionForm(s){
  const open = s.open_exceptions;
  return `<div class="flag-clear-form" data-testid="stage-exception-form-${s.key}">
    ${open.length > 1 ? `<select id="ex-gate-${s.key}" data-testid="stage-exception-gate-${s.key}" aria-label="Check to pass">${open.map(g => `<option value="${g}">${esc(GATE_NAME[g] || g)}</option>`).join('')}</select>`
      : `<input type="hidden" id="ex-gate-${s.key}" value="${open[0]}"><span class="small muted">${esc(GATE_NAME[open[0]] || open[0])}</span>`}
    <input class="inp" id="ex-reason-${s.key}" data-testid="stage-exception-reason-${s.key}" placeholder="Reason for the exception (required)" aria-label="Reason for the exception">
    <button class="btn sm" data-act="stage-exception" data-key="${s.key}" data-testid="stage-exception-${s.key}">${ico('flag')}Record exception</button></div>`;
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
  load: async () => {
    [ui.data.visit] = await Promise.all([API.visit(ui.p.vid), template()]);
    ui.data.shared = ui.data.visit.status === 'approved' && API.sharedUpdates
      ? (await API.sharedUpdates(ui.data.visit.project.id)).filter(u => u.visit_id === ui.data.visit.id) : [];
  },
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
      ${v.status === 'approved' && (can.create() || can.review()) ? shareUpdateForm(v) : ''}
      ${v.reviews.length ? `<div class="subh" style="margin-top:6px">History</div>${v.reviews.slice().reverse().map(r => `<div class="small"><b>${esc(r.reviewer ? r.reviewer.name : '')}</b> <span class="muted">${fmtStamp(r.at)} · ${r.decision === 'rework' ? 'Rework' : 'Approved'}</span>${r.comment ? `<div>${esc(r.comment)}</div>` : ''}</div>`).join('')}` : ''}
    </div></div></div>`;
  }
};

/* Share an approved visit with the client: a note and the photos the Architect picks. Nothing else is shown. */
function shareUpdateForm(v){
  const photos = (v.media || []).filter(m => m.kind === 'photo');
  const done = ui.data.shared || [];
  return `<div class="form so-form" data-testid="share-update"><div class="subh">Share with the client</div>
    ${done.map(u => `<div class="banner ok">${ico('check')}<span><b>Shared with the client</b> ${fmtStamp(u.shared_at)} by ${esc(u.shared_by.name)}: “${esc(u.note)}” (${u.photo_ids.length} photo${u.photo_ids.length === 1 ? '' : 's'})</span></div>`).join('')}
    <p class="small muted">The client sees only this note and the photos you tick. Problems, comments and the rest of the visit stay internal.</p>
    <div class="share-photos">${photos.map(m => `<label class="share-ph"><input type="checkbox" value="${m.id}" data-testid="share-photo-${m.id}"><img data-mid="${m.id}" alt="Site photo"></label>`).join('')}</div>
    <div class="field"><label for="sh-note">Note for the client</label><textarea id="sh-note" rows="3" data-testid="share-note" placeholder="What has been done and what comes next"></textarea></div>
    <button class="btn primary sm" data-act="share-update" data-testid="share-submit">${ico('eye')}Share with the client</button></div>`;
}

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
  if (API.projectImageUrl && !isClient()) document.querySelectorAll('img[data-pimg]:not([src])').forEach(async img => {
    const big = img.closest('.pthumb.lg');
    try { img.src = await API.projectImageUrl(+img.dataset.pimg, big ? 'full' : 'thumb', img.dataset.pstamp); } catch (_) { img.alt = 'Project image could not be loaded'; }
  });
  if (API.stageFileUrl && ui.data.project) document.querySelectorAll('img[data-sfid]:not([src])').forEach(async img => {
    try { img.src = await API.stageFileUrl(ui.data.project.id, img.dataset.sfkey, +img.dataset.sfid); } catch (_) { img.alt = 'Photo could not be loaded'; }
  });
  if (API.clientUpdatePhotoUrl) document.querySelectorAll('img[data-cuid]:not([src])').forEach(async img => {
    try { img.src = await API.clientUpdatePhotoUrl(+img.dataset.cuid, +img.dataset.cmid); } catch (_) { img.alt = 'Photo could not be loaded'; }
  });
  if (!MEDIA || isClient()) return;
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
let lastPointer = 'mouse';
document.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; }, true);
document.addEventListener('mouseover', e => {
  if (lastPointer === 'touch') return;
  const el = e.target.closest('[data-wf-pid]');
  clearTimeout(wfHoverT);
  if (!el || e.target.closest('.pstrip')) return;
  if (wfOpenFor === el.dataset.wfPid) return;
  wfHoverT = setTimeout(() => { if (el.matches(':hover')) showCallout(el); }, 350);  // a short pause, not a flash
});
document.addEventListener('mouseout', e => {
  if (lastPointer === 'touch' || !wfOpenFor) return;
  const to = e.relatedTarget;
  if (to && (to.closest('#wf-callout') || (to.closest('[data-wf-pid]') || {}).dataset?.wfPid === wfOpenFor)) return;
  if (e.target.closest('#wf-callout') || e.target.closest('[data-wf-pid]')) hideCallout();
});
// Keyboard focus opens the callout; a tap's focus doesn't (the tap itself toggles it).
document.addEventListener('focusin', e => { if (lastPointer === 'touch') return; const el = e.target.closest && e.target.closest('[data-wf-pid]'); if (el && e.target === el) showCallout(el); });
document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('[data-wf-pid]') && !(e.relatedTarget && e.relatedTarget.closest('#wf-callout'))) hideCallout(); });

document.addEventListener('change', e => { if (e.target.id === 'fe-project') go('fees', {pid: +e.target.value}); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ document.querySelectorAll('.picon.open').forEach(x => x.classList.remove('open')); hideCallout(); return; }
  const el = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && el.matches && el.matches('[role="button"][data-act]')){ e.preventDefault(); el.click(); }
});

document.addEventListener('click', async e => {
  const g = e.target.closest('[data-go]'); if (g){ go(g.dataset.go); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  switch (a.dataset.act){
    case 'open-project':
      if (!a.dataset.force && a.dataset.wfPid && lastPointer === 'touch'){
        if (wfOpenFor === a.dataset.wfPid) hideCallout(); else showCallout(a, true);
        break;
      }
      hideCallout(); go('project', {pid: +a.dataset.pid}); break;
    case 'po-toggle': { const id = +a.dataset.pid; ui.p.poOpen = ui.p.poOpen === id ? null : id; rerenderKeepScroll(); break; }
    case 'phase-tip': {
      const open = a.classList.contains('open');
      document.querySelectorAll('.picon.open').forEach(x => x.classList.remove('open'));
      if (!open) a.classList.add('open');
      break; }
    case 'sign-out': await API.logout(); showLogin(); break;
    case 'import-template': {
      try { const url = await API.importTemplateUrl(); const link = document.createElement('a');
        link.href = url; link.download = 'siteflow-projects-template.csv'; link.click(); }
      catch (err){ setError(err); render(); }
      break;
    }
    case 'import-preview': {
      const f = $('#im-file') && $('#im-file').files[0];
      if (!f){ toast('Choose the CSV file first.'); break; }
      ui.data.importFile = f; ui.data.result = null;
      try { ui.data.preview = await API.importPreview(f); ui.error = null; }
      catch (err){ ui.data.preview = null; setError(err); }
      render(); break;
    }
    case 'import-commit': {
      const mode = (document.querySelector('input[name="im-mode"]:checked') || {}).value || 'all_or_nothing';
      a.disabled = true;
      try {
        ui.data.result = await API.importCommit(ui.data.importFile, mode, +$('#im-arch').value);
        ui.data.preview = null; ui.error = null; ui.data.batches = await API.importBatches();
        toast(`Imported ${ui.data.result.projects.length} projects.`);
      } catch (err){ setError(err); ui.data.batches = await API.importBatches(); }
      render(); break;
    }
    case 'user-save': {
      const id = +a.dataset.uid;
      const role = $(`[data-testid="user-role-${id}"]`).value, active = $(`[data-testid="user-active-${id}"]`).checked;
      try { await API.updateUser(id, {role, active}); await V.team.load(); ui.error = null; toast('Saved.'); }
      catch (err){ setError(err); }
      render(); break;
    }
    case 'member-add': {
      const uid = +$('#mb-add').value;
      try { await API.addMember(ui.p.pid, uid); await V.project.load(); ui.error = null; toast('Added to the project.'); }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break;
    }
    case 'member-remove': {
      try { await API.removeMember(ui.p.pid, +a.dataset.uid); await V.project.load(); ui.error = null; toast('Removed from the project.'); }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break;
    }
    case 'sign-out-all':
      try { await API.logoutAll(); showLogin('You are signed out on all your devices.'); }
      catch (err){ setError(err); render(); }
      break;
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
    case 'share-update': {
      const note = ($('#sh-note').value || '').trim();
      const ids = [...document.querySelectorAll('[data-testid^="share-photo-"]:checked')].map(x => +x.value);
      if (!note){ toast('Write a short note for the client.'); break; }
      a.disabled = true;
      try { await API.shareUpdate(ui.data.visit.id, note, ids); toast('Shared with the client.'); await V.review.load(); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break; }
    case 'client-unfold': { const n = +a.dataset.n, u = ui.p.unfold || [];
      ui.p.unfold = u.includes(n) ? u.filter(x => x !== n) : [...u, n]; rerenderKeepScroll(); break; }
    case 'client-review': go('client-signoff', {sid: +a.dataset.sid}); break;
    case 'client-doc': {
      const aid = +a.dataset.aid;
      const keep = {confirm: ($('#so-confirm') || {}).checked, name: ($('#so-name') || {}).value, changes: ($('#so-changes') || {}).value};
      try {
        ui.data.docUrl = await API.clientDocumentUrl(ui.data.so.id, aid);  // opening it records the review
        ui.p.openDoc = aid;
        const att = ui.data.so.attachments.find(x => x.id === aid); if (att) att.viewed = true;
      } catch (err){ toast(err.message); }
      rerenderKeepScroll();
      if ($('#so-confirm')){ $('#so-confirm').checked = !!keep.confirm; $('#so-name').value = keep.name || ''; $('#so-changes').value = keep.changes || ''; syncApprove(); }
      break; }
    case 'client-approve': {
      a.disabled = true;
      try { await API.approveSignoff(ui.data.so.id, $('#so-name').value); toast('Signed off. Thank you.'); await go('client-project', {pid: ui.data.so.project.id}); }
      catch (err){ setError(err); rerenderKeepScroll(); }
      break; }
    case 'client-changes': {
      const comment = ($('#so-changes').value || '').trim();
      if (!comment){ toast('Say what should change so your architect can prepare a new version.'); break; }
      try { await API.requestChanges(ui.data.so.id, comment); toast('Sent to your architect.'); await go('client-project', {pid: ui.data.so.project.id}); }
      catch (err){ setError(err); rerenderKeepScroll(); }
      break; }
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
    case 'fee-save': {
      const v = $('#fp-value').value.trim();
      const body = {contract_value: v === '' ? null : v, currency: $('#fp-cur').value.trim() || null,
        fee_basis: $('#fp-basis').value, fee_notes: $('#fp-notes').value};
      try { await API.updateFeePlan(ui.data.project.id, body); toast('Fee plan saved.'); await V.project.load(); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break; }
    case 'project-image': {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.hidden = true; inp.accept = 'image/jpeg,image/png,image/webp';
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; inp.remove(); if (!f) return;
        try { await API.setProjectImage(ui.data.project.id, f); await V.project.load(); toast('Project image saved.'); }
        catch (err){ toast(err.message); }
        rerenderKeepScroll();
      });
      document.body.appendChild(inp); inp.click(); break; }
    case 'project-image-remove': {
      try { await API.removeProjectImage(ui.data.project.id); await V.project.load(); toast('Project image removed.'); }
      catch (err){ toast(err.message); }
      rerenderKeepScroll(); break; }
    case 'stage-attach': pickStageFile(a.dataset.key, a.dataset.kind); break;
    case 'stage-file-remove': {
      try { await API.removeStageFile(ui.data.project.id, a.dataset.key, +a.dataset.id); ui.data.stages = await API.stages(ui.data.project.id); toast('File removed.'); }
      catch (err){ toast(err.message); }
      rerenderKeepScroll(); break; }
    case 'stage-file-open': {
      try { const url = await API.stageFileUrl(ui.data.project.id, a.dataset.key, +a.dataset.id);
        const f = ((ui.data.stages.phases || []).flatMap(p => p.stages).find(x => x.key === a.dataset.key) || {attachments: []}).attachments.find(x => x.id === +a.dataset.id);
        const link = document.createElement('a'); link.href = url; link.download = f ? f.filename : 'file'; link.click(); }
      catch (err){ toast(err.message); }
      break; }
    case 'stage-exception': {
      const key = a.dataset.key, gate = $('#ex-gate-' + key).value, reason = (($('#ex-reason-' + key) || {}).value || '').trim();
      if (!reason){ toast('Give a reason for the exception.'); break; }
      a.disabled = true;
      try { await API.recordException(ui.data.project.id, key, gate, reason); toast('Exception recorded.'); await V.project.load(); ui.error = null; }
      catch (err){ setError(err); }
      rerenderKeepScroll(); break; }
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
      case 'fee-record': {
        const body = {kind: $('#fe-kind').value, amount: $('#fe-amount').value.trim().replace(/,/g, ''), date: $('#fe-date').value,
          reference: $('#fe-ref').value.trim() || null, note: $('#fe-note').value.trim() || null};
        try { await API.recordFee(ui.data.pid, body); ui.data.ledger = await API.fees(ui.data.pid); ui.error = null; toast('Entry recorded.'); }
        catch (err){ setError(err, {amount: 'Amount', reference: 'Reference', note: 'Note (reason for the correction)', date: 'Date'}); }
        render(); break;
      }
      case 'add-user': {
        const body = {name: $('#au-name').value.trim(), email: $('#au-email').value.trim(), role: $('#au-role').value};
        try { ui.data.created = await API.createUser(body); ui.data.users = await API.adminUsers(); ui.error = null; }
        catch (err){ setError(err); }
        render(); break;
      }
      case 'login': {
        ui.loginEmail = $('#li-email').value.trim();
        try { ui.me = await API.login(ui.loginEmail, $('#li-pass').value); }
        catch (err){ ui.error = err.message; render(); const pw = $('#li-pass'); if (pw) pw.focus(); return; }
        ui.error = null; await go(home()); break;
      }
      case 'new-project': {
        const start = $('#np-start') ? $('#np-start').value : '', confirmer = $('#np-confirmer') ? $('#np-confirmer').value.trim() : '';
        const val = id => ($(id) ? $(id).value.trim() : '');
        const cl = {client_name: val('#np-client'), client_phone: val('#np-client-phone'), client_email: val('#np-client-email'),
          site_address: val('#np-site'), site_city: val('#np-city')};
        const body = {name: $('#np-name').value.trim(), location: $('#np-loc').value.trim(),
          civil_engineer_id: +$('#np-eng').value || null, legal_expected_date: $('#np-date').value || null,
          ...(start ? {start_stage: start, historical_confirmed_by: confirmer} : {}),
          ...(cl.client_name ? {client: {name: cl.client_name,
            contacts: cl.client_phone || cl.client_email ? [{name: cl.client_name, phone: cl.client_phone || null, email: cl.client_email || null, is_signatory: true}] : []}} : {}),
          ...(cl.site_address ? {site: {address: cl.site_address, city: cl.site_city || null}} : {})};
        const miss = [!body.name && 'Project name', !body.location && 'Location', !body.civil_engineer_id && 'Civil Engineer'].filter(Boolean);
        ui.p.form = {...body, start_stage: start, historical_confirmed_by: confirmer, ...cl};
        if (miss.length){ ui.error = {message: `${miss.join(', ')} ${miss.length === 1 ? 'is' : 'are'} required.`, items: []}; render(); return; }
        if (start && !confirmer){ ui.error = {message: 'Who confirmed the earlier stages? Add a name to onboard a project mid-way.', items: []}; render(); return; }
        try { const p = await API.createProject(body); toast(`${p.name} created. ${(p.current_stages || []).join(' + ') || 'The first stage'} is open.`); await go('project', {pid: p.id}); }
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
document.addEventListener('input', e => { if (e.target.id === 'so-name') syncApprove(); });
document.addEventListener('change', e => { if (e.target.id === 'so-confirm') syncApprove(); });

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
