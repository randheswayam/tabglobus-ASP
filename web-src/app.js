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
const ROLES = {admin: 'Principal Architect', pm: 'Project Manager', architect: 'Architect', site: 'Site Engineer', civil: 'Civil Engineer', accounts: 'Accounts'};
const USERS = [
  {id: 'u1', name: 'Anita Deshpande', role: 'admin'},
  {id: 'u2', name: 'Rohan Kulkarni', role: 'pm'},
  {id: 'u3', name: 'Meera Joshi', role: 'architect'},
  {id: 'u4', name: 'Sameer Patil', role: 'site'},
  {id: 'u5', name: 'Farhan Shaikh', role: 'civil'},
  {id: 'u6', name: 'Priya Nair', role: 'accounts'}
];
const FIELD_TYPES = {text: 'Short text', textarea: 'Long text', number: 'Number', date: 'Date', select: 'Choice'};

function residentialTemplate(){
  return {
    id: 'tpl-res', name: 'Residential Bungalow', desc: 'Site-first flow for independent homes and villas', version: 1, updated: addDays(-30),
    history: [{v: 1, date: addDays(-30), note: 'Initial version'}],
    steps: [
      {id: 's-req', name: 'Client Requirement', type: 'form', role: 'architect', sla: 2, fields: [
        {k: 'brief', label: 'Client brief', type: 'textarea', req: true},
        {k: 'rooms', label: 'Rooms and spaces required', type: 'text', req: true, ph: 'e.g. 4 BHK, home office, puja room'},
        {k: 'budget', label: 'Indicative budget (₹ lakh)', type: 'number', req: true},
        {k: 'possession', label: 'Target possession date', type: 'date', req: false}
      ]},
      {id: 's-visit', name: 'Site Visit', type: 'capture', role: 'site', sla: 2, minPhotos: 5, gps: true, video: false, voice: false,
        fields: [
          {k: 'visitDate', label: 'Visit date', type: 'date', req: true},
          {k: 'people', label: 'People present', type: 'text', req: true, ph: 'Names and roles'},
          {k: 'dims', label: 'Site dimensions', type: 'text', req: true, ph: 'e.g. 40 ft × 60 ft'},
          {k: 'area', label: 'Plot area (sq ft)', type: 'number', req: false},
          {k: 'facing', label: 'Plot facing', type: 'select', options: ['North', 'East', 'South', 'West', 'North-East', 'North-West', 'South-East', 'South-West'], req: false},
          {k: 'condition', label: 'Existing structure', type: 'select', options: ['Vacant plot', 'Structure to retain', 'Structure to demolish', 'Under construction'], req: true},
          {k: 'obs', label: 'Site observations', type: 'textarea', req: true, ph: 'Levels, trees, drainage, seepage, neighbouring buildings'},
          {k: 'next', label: 'Next steps', type: 'textarea', req: true}
        ],
        checklist: ['Boundary markers verified', 'Neighbouring structures photographed', 'Water and drainage points noted', 'Electricity supply point noted']
      },
      {id: 's-review', name: 'Site Visit Review', type: 'review', role: 'admin', sla: 1},
      {id: 's-assess', name: 'Survey and Civil Assessment', type: 'parallel', sla: 3,
        milestone: {name: 'Site Assessment Complete', pay: 10},
        branches: [
          {id: 'b-survey', name: 'Architect Survey', role: 'architect', fields: [
            {k: 'levels', label: 'Site levels and contour notes', type: 'textarea', req: true},
            {k: 'setbacks', label: 'Setbacks front, side, rear (m)', type: 'text', req: true, ph: 'e.g. 3.0 / 1.5 / 1.5'},
            {k: 'fsi', label: 'Permissible FSI', type: 'number', req: false}
          ]},
          {id: 'b-civil', name: 'Civil Assessment', role: 'civil', fields: [
            {k: 'soil', label: 'Soil type', type: 'select', options: ['Murum', 'Black cotton', 'Hard rock', 'Mixed fill'], req: true},
            {k: 'structure', label: 'Structural feasibility notes', type: 'textarea', req: true},
            {k: 'test', label: 'Soil test recommended', type: 'select', options: ['Yes', 'No'], req: false}
          ]}
        ]
      },
      {id: 's-concept', name: 'Concept Design', type: 'form', role: 'architect', sla: 7,
        milestone: {name: 'Concept Ready for Client', pay: 20},
        fields: [
          {k: 'options', label: 'Concept options prepared', type: 'number', req: true},
          {k: 'summary', label: 'Design summary for client', type: 'textarea', req: true},
          {k: 'link', label: 'Drawing set link', type: 'text', req: false}
        ]}
    ]
  };
}
function renovationTemplate(){
  return {
    id: 'tpl-reno', name: 'Renovation Quick Assessment', desc: 'Short flow for interiors and renovation enquiries', version: 1, updated: addDays(-12),
    history: [{v: 1, date: addDays(-12), note: 'Initial version'}],
    steps: [
      {id: 'r-visit', name: 'Site Visit', type: 'capture', role: 'site', sla: 1, minPhotos: 3, gps: true, video: true, voice: false,
        fields: [
          {k: 'visitDate', label: 'Visit date', type: 'date', req: true},
          {k: 'people', label: 'People present', type: 'text', req: true},
          {k: 'rooms', label: 'Areas to renovate', type: 'text', req: true},
          {k: 'obs', label: 'Site observations', type: 'textarea', req: true},
          {k: 'next', label: 'Next steps', type: 'textarea', req: true}
        ],
        checklist: ['Society permission status noted', 'Wet areas inspected for seepage']
      },
      {id: 'r-review', name: 'Site Visit Review', type: 'review', role: 'pm', sla: 1},
      {id: 'r-est', name: 'Cost Estimate', type: 'form', role: 'pm', sla: 3, milestone: {name: 'Estimate Shared', pay: 15},
        fields: [
          {k: 'amount', label: 'Estimate (₹ lakh)', type: 'number', req: true},
          {k: 'scope', label: 'Scope summary', type: 'textarea', req: true}
        ]}
    ]
  };
}

/* ---------- state ---------- */
const KEY = 'siteflow.v1';
let S = null;
const ui = {route: 'dashboard', p: {}, draft: null, errors: null, savedAt: null};
function load(){ try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) {} return null; }
let saveT = null;
function save(now){
  clearTimeout(saveT);
  const go = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); ui.savedAt = Date.now(); } catch (e) { toast('Device storage is full. Remove some photos and try again.'); } };
  if (now) go(); else saveT = setTimeout(go, 300);
}
const me = () => S.users.find(u => u.id === S.me);
const userById = id => S.users.find(u => u.id === id);
const proj = id => S.projects.find(p => p.id === id);
const tpl = id => S.templates.find(t => t.id === id);
const assignee = (p, role) => userById(p.team[role]);

/* ---------- workflow engine ---------- */
function audit(p, text, t){ p.audit.unshift({t: t || Date.now(), by: me() ? me().name : 'System', text}); }
function notify(text, o = {}){
  S.notes.unshift({id: uid('n'), t: o.t || Date.now(), text, role: o.role || 'all', pid: o.pid || null, kind: o.kind || 'info', ch: o.ch || ['In-app', 'Push'], read: false});
  S.notes = S.notes.slice(0, 80);
}
function instantiate(t, p){
  p.templateId = t.id; p.templateVersion = t.version; p.templateName = t.name;
  p.steps = clone(t.steps).map(s => {
    const x = Object.assign(s, {status: 'locked', due: null, data: {}, photos: [], media: [], gps: null, checks: {}, comments: []});
    if (x.branches) x.branches.forEach(b => Object.assign(b, {status: 'locked', data: {}, due: null}));
    return x;
  });
}
function activate(p, i, t){
  const s = p.steps[i]; if (!s) return;
  s.status = 'active'; s.due = addDays(s.sla, t ? ymd(new Date(t)) : undefined);
  if (s.type === 'parallel'){
    s.branches.forEach(b => { b.status = 'active'; b.due = s.due; const u = assignee(p, b.role);
      notify(`${b.name} assigned to ${u ? u.name : ROLES[b.role]} on ${p.name}`, {role: b.role, pid: p.id, t, ch: ['In-app', 'Push', 'Email']}); });
    audit(p, `Parallel stage started: ${s.branches.map(b => b.name).join(' + ')}`, t);
  } else {
    const u = assignee(p, s.role);
    notify(`${s.type === 'review' ? 'Review needed' : 'New activity'}: ${s.name} on ${p.name}`, {role: s.role, pid: p.id, t, ch: ['In-app', 'Push', 'Email']});
    audit(p, `${s.name} assigned to ${u ? u.name : ROLES[s.role]}, due ${fmtShort(s.due)}`, t);
  }
}
function fireMilestone(p, s, t){
  const m = s.milestone; if (!m) return;
  const meet = addDays(2, t ? ymd(new Date(t)) : undefined);
  p.milestones.push({name: m.name, pay: m.pay, at: t || Date.now(), meeting: meet});
  audit(p, `Milestone reached: ${m.name}`, t);
  notify(`Milestone reached on ${p.name}: ${m.name}`, {role: 'pm', pid: p.id, kind: 'ms', t, ch: ['In-app', 'Email']});
  if (m.pay) notify(`Payment trigger: invoice request for ${m.pay}% of fee, ${p.name} (${m.name})`, {role: 'accounts', pid: p.id, kind: 'ms', t, ch: ['In-app', 'Email']});
  notify(`Client update ready to send to ${p.client}: ${m.name}`, {role: 'pm', pid: p.id, kind: 'ms', t, ch: ['In-app']});
  notify(`Review meeting scheduled ${fmtShort(meet)} for ${p.name}`, {role: 'all', pid: p.id, kind: 'info', t, ch: ['Calendar', 'Email']});
}
function completeStep(p, i, t){
  const s = p.steps[i]; s.status = 'done'; s.doneAt = t || Date.now();
  fireMilestone(p, s, t);
  if (i + 1 < p.steps.length) activate(p, i + 1, t);
  else { p.status = 'complete'; audit(p, 'Workflow complete', t); notify(`${p.name}: all workflow steps complete`, {role: 'pm', pid: p.id, kind: 'ok', t}); }
}
function submitStep(p, i, bi, t){
  const s = p.steps[i];
  if (s.type === 'parallel'){
    const b = s.branches[bi]; b.status = 'done'; b.doneAt = t || Date.now();
    audit(p, `${b.name} submitted`, t);
    if (s.branches.every(x => x.status === 'done')) { audit(p, 'All parallel activities complete', t); completeStep(p, i, t); return `${b.name} submitted. Parallel stage complete: next activity started.`; }
    return `${b.name} submitted. Waiting on ${s.branches.filter(x => x.status !== 'done').map(x => x.name).join(', ')}.`;
  }
  s.submittedAt = t || Date.now();
  audit(p, `${s.name} submitted${s.photos.length ? ` with ${s.photos.length} photos` : ''}`, t);
  const nx = p.steps[i + 1];
  if (nx && nx.type === 'review'){ s.status = 'submitted'; activate(p, i + 1, t); return `${s.name} submitted for review.`; }
  completeStep(p, i, t); return `${s.name} complete. Next activity started.`;
}
function reviewStep(p, i, ok, comment, t){
  const r = p.steps[i], target = p.steps[i - 1];
  if (ok){
    target.status = 'done'; target.doneAt = t || Date.now();
    if (comment) target.comments.push({t: t || Date.now(), by: me().name, text: comment, kind: 'approve'});
    audit(p, `${target.name} approved${comment ? `: "${comment}"` : ''}`, t);
    fireMilestone(p, target, t);
    notify(`${target.name} approved on ${p.name}`, {role: target.role, pid: p.id, kind: 'ok', t});
    completeStep(p, i, t);
  } else {
    r.status = 'locked'; r.due = null;
    target.status = 'rework'; target.due = addDays(1);
    target.comments.push({t: t || Date.now(), by: me().name, text: comment, kind: 'rework'});
    audit(p, `${target.name} sent back for rework: "${comment}"`, t);
    notify(`Rework requested on ${target.name}, ${p.name}: ${comment}`, {role: target.role, pid: p.id, kind: 'warn', t, ch: ['In-app', 'Push', 'Email']});
  }
}
function openItems(p){
  const out = [];
  p.steps.forEach((s, i) => {
    if (s.type === 'parallel'){ s.branches.forEach((b, bi) => { if (b.status === 'active') out.push({p, i, bi, s, name: b.name, role: b.role, due: b.due, status: 'active', type: 'form', esc: b.escalated}); }); }
    else if (s.status === 'active' || s.status === 'rework') out.push({p, i, s, name: s.name, role: s.role, due: s.due, status: s.status, type: s.type, esc: s.escalated});
  });
  return out;
}
function checkEscalations(){
  S.projects.forEach(p => p.steps.forEach(s => {
    const list = s.type === 'parallel' ? s.branches.filter(b => b.status === 'active') : ((s.status === 'active' || s.status === 'rework') ? [s] : []);
    list.forEach(x => { if (x.due && daysUntil(x.due) < 0 && !x.escalated){
      x.escalated = true; const pm = assignee(p, 'pm');
      notify(`Overdue: ${x.name} on ${p.name} was due ${fmtShort(x.due)}. Escalated to ${pm ? pm.name : 'Project Manager'}.`, {role: 'pm', pid: p.id, kind: 'warn', ch: ['In-app', 'Email', 'Push']});
      audit(p, `${x.name} overdue, escalated to ${pm ? pm.name : 'Project Manager'}`);
    }});
  }));
}

/* ---------- validation ---------- */
function reqItems(s, t){
  const items = [];
  (t.fields || []).forEach(f => { if (f.req) items.push({label: f.label, ok: String(t.data[f.k] ?? '').trim() !== '', k: f.k}); });
  if (s.type === 'capture'){
    if (s.minPhotos) items.push({label: `Photos, minimum ${s.minPhotos} (${t.photos.length} added)`, ok: t.photos.length >= s.minPhotos, k: '_photos'});
    if (s.gps) items.push({label: 'Site location captured', ok: !!t.gps, k: '_gps'});
    if (s.video) items.push({label: 'Walkthrough video', ok: t.media.some(m => m.kind === 'video'), k: '_video'});
    if (s.voice) items.push({label: 'Voice note', ok: t.media.some(m => m.kind === 'voice'), k: '_voice'});
    (s.checklist || []).forEach((c, ci) => items.push({label: c, ok: !!t.checks[ci], k: '_chk' + ci}));
  }
  return items;
}

/* ---------- demo photos ---------- */
function makePhoto(seed, stamp){
  const c = document.createElement('canvas'); c.width = 480; c.height = 360; const g = c.getContext('2d');
  let r = seed * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const sky = g.createLinearGradient(0, 0, 0, 220); sky.addColorStop(0, `hsl(${200 + rnd() * 15},55%,${62 + rnd() * 10}%)`); sky.addColorStop(1, '#e9eef0');
  g.fillStyle = sky; g.fillRect(0, 0, 480, 360);
  g.fillStyle = `hsl(${30 + rnd() * 10},28%,${46 + rnd() * 8}%)`; g.fillRect(0, 240 + rnd() * 20, 480, 140);
  const n = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++){
    const w = 90 + rnd() * 120, h = 90 + rnd() * 150, x = rnd() * 400 - 20, y = 260 - h;
    g.fillStyle = `hsl(30,6%,${60 + rnd() * 18}%)`; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(40,50,55,.55)';
    for (let yy = y + 12; yy < y + h - 16; yy += 26) for (let xx = x + 10; xx < x + w - 16; xx += 24) if (rnd() > .25) g.fillRect(xx, yy, 12, 14);
    g.fillStyle = 'rgba(60,60,60,.5)'; for (let yy = y; yy < y + h; yy += 26) g.fillRect(x - 4, yy, w + 8, 3);
  }
  if (rnd() > .4){ g.strokeStyle = '#d99613'; g.lineWidth = 4; const cx = 60 + rnd() * 360; g.beginPath(); g.moveTo(cx, 260); g.lineTo(cx, 40); g.lineTo(cx + 150, 40); g.stroke(); g.beginPath(); g.moveTo(cx + 120, 40); g.lineTo(cx + 120, 110); g.lineWidth = 1.5; g.stroke(); }
  g.fillStyle = 'hsl(95,30%,38%)'; for (let k = 0; k < 4; k++){ g.beginPath(); g.arc(rnd() * 480, 250 + rnd() * 20, 12 + rnd() * 16, 0, 7); g.fill(); }
  stampPhoto(g, 480, 360, stamp);
  return c.toDataURL('image/jpeg', 0.6);
}
function stampPhoto(g, w, h, text){
  if (!text) return;
  const fs = Math.max(11, Math.round(w / 36));
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, h - fs * 1.9, w, fs * 1.9);
  g.fillStyle = '#fff'; g.font = `${fs}px ui-monospace, monospace`; g.fillText(text, fs * .6, h - fs * .6);
}
function readImage(file, stamp){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const max = 900, sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height); stampPhoto(g, c.width, c.height, stamp);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.62));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read image')); };
    img.src = url;
  });
}

/* ---------- seed ---------- */
function seed(){
  S = {users: clone(USERS), me: isNative ? 'u4' : 'u1', templates: [residentialTemplate(), renovationTemplate()], projects: [], notes: [], pending: 0, v: 1};
  const H = 36e5, now = Date.now();
  const team = {admin: 'u1', pm: 'u2', architect: 'u3', site: 'u4', civil: 'u5', accounts: 'u6'};
  const mk = (id, name, client, address, lat, lng, tid, start) => { const p = {id, name, client, address, lat, lng, start, team: clone(team), audit: [], milestones: [], status: 'active', created: start}; instantiate(tpl(tid), p); S.projects.push(p); return p; };
  const photos = (n, base, lat, lng) => Array.from({length: n}, (_, k) => ({id: uid('ph'), src: makePhoto(base + k, `${fmtShort(today())} 10:${String(12 + k * 3).padStart(2, '0')}  ${lat.toFixed(5)}, ${lng.toFixed(5)}`), t: now - 20 * H}));
  const fill = (s, extra) => { s.fields.forEach(f => { if (extra[f.k] !== undefined) s.data[f.k] = extra[f.k]; }); };
  const reqData = {brief: 'Independent family home for a couple with two children and visiting parents. Wants natural light, a courtyard and a ground-floor bedroom for elders.', rooms: '4 BHK, home office, puja room, 2-car parking', budget: 180, possession: addDays(420)};

  // 1. Baner Residence: site visit in progress, draft started
  let p = mk('p-baner', 'Baner Residence', 'Mr. and Mrs. Gokhale', 'Plot 14, Baner Road, Pune', 18.55903, 73.78681, 'tpl-res', addDays(-6));
  S.me = 'u3'; activate(p, 0, now - 140 * H); fill(p.steps[0], reqData); submitStep(p, 0, 0, now - 50 * H);
  p.steps[1].due = today();
  Object.assign(p.steps[1].data, {visitDate: today(), people: 'Sameer Patil (Site), Mr. Gokhale (Client)', facing: 'East'});
  p.steps[1].photos = photos(2, 11, p.lat, p.lng);

  // 2. Riverside Apartments: site visit submitted, awaiting review
  p = mk('p-river', 'Riverside Apartments', 'Riverside Developers LLP', 'Survey No. 52, Kharadi, Pune', 18.55152, 73.93481, 'tpl-res', addDays(-9));
  S.me = 'u3'; activate(p, 0, now - 210 * H); fill(p.steps[0], {brief: 'G+4 residential block with 16 flats on a riverside plot. Developer wants stilt parking and a rooftop amenity deck.', rooms: '16 × 2 BHK, stilt parking, rooftop deck', budget: 950});
  submitStep(p, 0, 0, now - 160 * H);
  S.me = 'u4'; const v = p.steps[1];
  fill(v, {visitDate: addDays(-1), people: 'Sameer Patil (Site), Mr. Shah (Developer rep)', dims: '120 ft × 85 ft', area: 10200, facing: 'North-East', condition: 'Vacant plot', obs: 'Plot slopes roughly 1.2 m towards the river edge on the east side. Water seepage marks on the neighbouring compound wall (west). Two mature mango trees near the north boundary.', next: 'Contour survey of east edge. Civil team to check flood line and soil bearing near river side.'});
  v.photos = photos(6, 31, p.lat, p.lng); v.gps = {lat: p.lat, lng: p.lng, acc: 8, src: 'Device GPS'}; v.checks = {0: true, 1: true, 2: true, 3: true};
  v.media = [{kind: 'doc', name: '7-12 extract Survey 52.pdf', size: 412000}];
  submitStep(p, 1, 0, now - 20 * H);

  // 3. Kothrud Clinic: parallel stage, one branch done, other overdue
  p = mk('p-koth', 'Kothrud Clinic', 'Dr. Apte', 'Karve Road, Kothrud, Pune', 18.50741, 73.80772, 'tpl-res', addDays(-16));
  S.me = 'u3'; activate(p, 0, now - 380 * H); fill(p.steps[0], {brief: 'Ground floor clinic with first floor residence for the doctor. Separate entries for clinic and home.', rooms: 'Clinic: reception, 2 consult rooms. Home: 3 BHK', budget: 140}); submitStep(p, 0, 0, now - 340 * H);
  S.me = 'u4'; const kv = p.steps[1];
  fill(kv, {visitDate: addDays(-12), people: 'Sameer Patil, Dr. Apte', dims: '50 ft × 70 ft', area: 3500, facing: 'West', condition: 'Structure to demolish', obs: 'Old load-bearing house, cracks in rear wall. Road-side drain at higher level than plot.', next: 'Demolition permission. Civil to confirm plinth level.'});
  kv.photos = photos(5, 51, p.lat, p.lng); kv.gps = {lat: p.lat, lng: p.lng, acc: 11, src: 'Device GPS'}; kv.checks = {0: true, 1: true, 2: true, 3: true};
  submitStep(p, 1, 0, now - 300 * H);
  S.me = 'u1'; reviewStep(p, 2, true, 'Good capture. Proceed.', now - 120 * H);
  p.steps[3].due = addDays(-1); p.steps[3].branches.forEach(b => b.due = addDays(-1));
  S.me = 'u3'; fill(p.steps[3].branches[0], {levels: 'Plot 0.45 m below road. Rear corner lowest.', setbacks: '3.0 / 1.5 / 2.25', fsi: 1.1}); submitStep(p, 3, 0, now - 30 * H);

  // 4. Aundh Villa: at concept design, milestone fired
  p = mk('p-aundh', 'Aundh Villa', 'Mrs. Kapoor', 'ITI Road, Aundh, Pune', 18.56187, 73.80734, 'tpl-res', addDays(-24));
  S.me = 'u3'; activate(p, 0, now - 570 * H); fill(p.steps[0], reqData); submitStep(p, 0, 0, now - 530 * H);
  S.me = 'u4'; const av = p.steps[1];
  fill(av, {visitDate: addDays(-20), people: 'Sameer Patil, Mrs. Kapoor', dims: '60 ft × 80 ft', area: 4800, facing: 'North', condition: 'Vacant plot', obs: 'Level plot with a large gulmohar tree at the centre that the client wants to keep.', next: 'Plan the courtyard around the tree.'});
  av.photos = photos(5, 71, p.lat, p.lng); av.gps = {lat: p.lat, lng: p.lng, acc: 6, src: 'Device GPS'}; av.checks = {0: true, 1: true, 2: true, 3: true};
  submitStep(p, 1, 0, now - 480 * H);
  S.me = 'u1'; reviewStep(p, 2, true, '', now - 450 * H);
  S.me = 'u3'; fill(p.steps[3].branches[0], {levels: 'Level within 150 mm.', setbacks: '4.5 / 3.0 / 3.0'}); submitStep(p, 3, 0, now - 400 * H);
  S.me = 'u5'; fill(p.steps[3].branches[1], {soil: 'Murum', structure: 'Isolated footings at 1.5 m. Tree roots to be protected with a root barrier.', test: 'Yes'}); submitStep(p, 3, 1, now - 380 * H);
  p.steps[4].due = addDays(4);

  S.me = isNative ? 'u4' : 'u1';
  S.notes.forEach(n => n.read = true);
  S.notes.slice(0, 4).forEach(n => n.read = false);
  S.projects.forEach(p => p.audit.forEach(a => { if (a.by === 'System') a.by = 'Demo'; }));
  checkEscalations();
  save(true);
}

/* ---------- toast ---------- */
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600); }

/* ---------- render: shell ---------- */
function myNotes(){ const r = me().role; return S.notes.filter(n => n.role === 'all' || n.role === r || r === 'admin'); }
function unread(){ return myNotes().filter(n => !n.read).length; }
function go(route, p = {}){ ui.route = route; ui.p = p; ui.errors = null; if (route === 'template-edit') ui.draft = clone(tpl(p.id)); render(); window.scrollTo(0, 0); }

function renderShell(){
  const u = me(), n = unread();
  const nav = [['dashboard', 'home', 'Dashboard'], ['projects', 'folder', 'Projects'], ['templates', 'flow', 'Workflow templates'], ['alerts', 'bell', 'Notifications']];
  const cur = ui.route.startsWith('template') ? 'templates' : (['project', 'activity', 'new-project'].includes(ui.route) ? 'projects' : ui.route);
  const userSel = id => `<select id="${id}" data-act="switch-user" aria-label="Viewing as">${S.users.map(x => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${esc(x.name)} · ${ROLES[x.role]}</option>`).join('')}</select>`;
  $('#side').innerHTML = `
    <div class="brand"><span class="brand-mark">${ico('logo')}</span><div><b>SiteFlow</b><small>Studio · MVP</small></div></div>
    <div class="nav">${nav.map(([r, i, l]) => `<button data-go="${r}" class="${cur === r ? 'on' : ''}">${ico(i)}${l}${r === 'alerts' && n ? `<span class="count">${n}</span>` : ''}</button>`).join('')}
      <button data-act="capture-now">${ico('camera')}Start site visit</button></div>
    <div class="side-foot">
      <div class="whois"><span class="eyebrow">Viewing as</span>${userSel('who-side')}</div>
      <button class="btn ghost sm" data-act="reset">Reset demo data</button>
      <div class="credit">Prototype by TAN GLOBUS AI</div>
    </div>`;
  const tabs = [['dashboard', 'home', 'Home'], ['projects', 'folder', 'Projects'], ['capture', 'camera', 'Capture'], ['templates', 'flow', 'Setup'], ['alerts', 'bell', 'Alerts']];
  $('#tabs').innerHTML = tabs.map(([r, i, l]) => r === 'capture'
    ? `<button class="cap" data-act="capture-now"><span class="c">${ico('camera')}</span><small>${l}</small></button>`
    : `<button data-go="${r}" class="${cur === r ? 'on' : ''}">${ico(i)}${l}${r === 'alerts' && n ? `<span class="count">${n}</span>` : ''}</button>`).join('');
  return `<div class="mtop"><div class="brand"><span class="brand-mark">${ico('logo')}</span><b>SiteFlow</b></div>${userSel('who-top')}</div>
    ${navigator.onLine === false ? `<div class="offline">${ico('cloud')}Offline. Captures are saved on this device and will sync when you reconnect.${S.pending ? ` ${S.pending} waiting.` : ''}</div>` : ''}`;
}

/* ---------- small components ---------- */
function statusText(s){
  if (s.type === 'review' && s.status === 'active') return 'Awaiting review';
  return {locked: 'Not started', active: 'In progress', submitted: 'In review', rework: 'Rework', done: 'Done'}[s.status];
}
function statusPill(st, label){ const cls = {locked: '', active: 'active', submitted: 'submitted', rework: 'rework', done: 'done'}[st] || st; return `<span class="pill ${cls}"><span class="dot"></span>${esc(label)}</span>`; }
function duePill(due){
  if (!due) return '';
  const d = daysUntil(due);
  if (d < 0) return `<span class="pill overdue">${ico('alert')}Overdue ${-d}d</span>`;
  if (d === 0) return `<span class="pill active">Due today</span>`;
  return `<span class="pill">Due ${fmtShort(due)}</span>`;
}
function progress(p){ const n = p.steps.length, d = p.steps.filter(s => s.status === 'done').length; return Math.round(d / n * 100); }
function current(p){ return p.steps.find(s => s.status !== 'done'); }
function taskIcon(type){ return type === 'capture' ? 'camera' : type === 'review' ? 'eye' : 'form'; }

function taskRow(it){
  const u = assignee(it.p, it.role);
  const lbl = it.type === 'review' ? 'Awaiting review' : it.status === 'rework' ? 'Rework' : 'In progress';
  return `<button class="task task-${it.type}" data-act="open-activity" data-pid="${it.p.id}" data-i="${it.i}" ${it.bi !== undefined ? `data-bi="${it.bi}"` : ''}>
    <span class="ti">${ico(taskIcon(it.type))}</span>
    <span><b>${esc(it.name)}</b><span class="small muted">${esc(it.p.name)} · ${esc(u ? u.name : ROLES[it.role])}</span></span>
    <span class="meta">${statusPill(it.status === 'rework' ? 'rework' : it.type === 'review' ? 'submitted' : 'active', lbl)}${duePill(it.due)}</span></button>`;
}
function projectCard(p){
  const c = current(p);
  return `<button class="pcard" data-act="open-project" data-pid="${p.id}">
    <div><h3>${esc(p.name)}</h3><div class="loc">${esc(p.client)} · ${esc(p.address.split(',').slice(-2).join(',').trim())}</div></div>
    <div class="ministep">${p.steps.map(s => `<i class="${s.status}" title="${esc(s.name)}"></i>`).join('')}</div>
    <div class="now"><span>${c ? `<span class="muted">Now:</span> <b>${esc(c.name)}</b>` : '<b>Complete</b>'}</span><span class="mono muted">${progress(p)}%</span></div>
    <div class="row small muted"><span class="pill">${esc(p.templateName)} v${p.templateVersion}</span>${c && c.due ? duePill(c.type === 'parallel' ? (c.branches.find(b => b.status === 'active') || c).due : c.due) : ''}</div>
  </button>`;
}
function noteItem(n){
  const icn = n.kind === 'ok' ? 'check' : n.kind === 'warn' ? 'alert' : n.kind === 'ms' ? 'flag' : 'bell';
  return `<div class="fi ${n.kind} ${n.read ? '' : 'unread'}"><span class="fic">${ico(icn)}</span><div><div>${esc(n.text)}</div>
    <div class="when"><span>${fmtTime(n.t)}</span><span>· ${n.role === 'all' ? 'Everyone' : ROLES[n.role]}</span>${n.ch.map(c => `<span class="ch">${c}</span>`).join('')}</div></div></div>`;
}

/* ---------- views ---------- */
const V = {};
V.dashboard = () => {
  const u = me();
  const all = S.projects.flatMap(openItems);
  const mine = all.filter(it => it.role === u.role);
  const reviews = all.filter(it => it.type === 'review').length;
  const overdue = all.filter(it => it.due && daysUntil(it.due) < 0).length;
  const active = S.projects.filter(p => p.status !== 'complete').length;
  const hr = new Date().getHours(); const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const ms = S.projects.flatMap(p => p.milestones.map(m => Object.assign({p}, m))).sort((a, b) => b.at - a.at).slice(0, 4);
  return `<div class="head"><div><div class="eyebrow">${new Date().toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long'})}</div><h1>${greet}, ${esc(u.name.split(' ')[0])}</h1><div class="sub">${ROLES[u.role]} · ${mine.length ? `${mine.length} ${mine.length === 1 ? 'activity needs' : 'activities need'} you` : 'Nothing waiting on you right now'}</div></div>
    <div class="row"><button class="btn" data-go="new-project">${ico('plus')}New project</button><button class="btn primary" data-act="capture-now">${ico('camera')}Start site visit</button></div></div>
    <div class="kpis">
      <div class="kpi"><b>${active}</b><span>Active projects</span></div>
      <div class="kpi attn"><b>${all.length}</b><span>Open activities</span></div>
      <div class="kpi"><b>${reviews}</b><span>Awaiting review</span></div>
      <div class="kpi ${overdue ? 'alert' : ''}"><b>${overdue}</b><span>Overdue and escalated</span></div>
    </div>
    <div class="grid2">
      <div class="stack">
        <section class="panel"><div class="panel-h"><h2>My activities</h2><span class="small muted">${ROLES[u.role]}</span></div>
          <div class="tasks">${mine.length ? mine.map(taskRow).join('') : `<div class="empty">No open activities for ${ROLES[u.role]}. Switch the “Viewing as” user to see other roles' work.</div>`}</div></section>
        <section class="panel"><div class="panel-h"><h2>All open activities</h2><span class="small muted">Across ${S.projects.length} projects</span></div>
          <div class="tasks">${all.filter(it => it.role !== u.role).map(taskRow).join('') || '<div class="empty">No other open activities.</div>'}</div></section>
        <section><div class="head" style="margin-bottom:12px"><h2>Projects</h2><button class="btn ghost sm" data-go="projects">View all</button></div><div class="pcards">${S.projects.slice(0, 4).map(projectCard).join('')}</div></section>
      </div>
      <div class="stack">
        <section class="panel"><div class="panel-h"><h2>Milestones and triggers</h2></div>
          <div class="feed">${ms.length ? ms.map(m => `<div class="fi ms"><span class="fic">${ico('flag')}</span><div><div><b>${esc(m.name)}</b> · ${esc(m.p.name)}</div><div class="when"><span>${fmtTime(m.at)}</span>${m.pay ? `<span class="ch">Invoice ${m.pay}% of fee</span>` : ''}<span class="ch">Client update</span><span class="ch">Meeting ${fmtShort(m.meeting)}</span></div></div></div>`).join('') : '<div class="empty">No milestones yet.</div>'}</div></section>
        <section class="panel"><div class="panel-h"><h2>Recent notifications</h2><button class="btn ghost sm" data-go="alerts">All</button></div>
          <div class="feed">${myNotes().slice(0, 6).map(noteItem).join('') || '<div class="empty">No notifications.</div>'}</div></section>
      </div>
    </div>`;
};

V.projects = () => `<div class="head"><div><h1>Projects</h1><div class="sub">${S.projects.length} projects running on configured workflow templates</div></div><button class="btn primary" data-go="new-project">${ico('plus')}New project</button></div>
  <div class="pcards">${S.projects.map(projectCard).join('')}</div>`;

V.project = () => {
  const p = proj(ui.p.pid); if (!p) return V.projects();
  const ci = p.steps.findIndex(s => s.status !== 'done');
  const roles = [...new Set(['pm', ...p.steps.flatMap(s => s.branches ? s.branches.map(b => b.role) : [s.role])])];
  return `<div class="crumbs"><button data-go="projects">Projects</button>/<span>${esc(p.name)}</span></div>
  <div class="head"><div><h1>${esc(p.name)}</h1><div class="sub">${esc(p.client)} · ${esc(p.address)}</div></div>
    <div class="row"><span class="pill">${esc(p.templateName)} v${p.templateVersion}</span><span class="pill ${p.status === 'complete' ? 'done' : 'active'}">${p.status === 'complete' ? 'Complete' : progress(p) + '% complete'}</span></div></div>
  <div class="panel stepper-wrap"><ol class="stepper" style="padding:4px 16px">${p.steps.map((s, i) => `<li class="st st-${s.status}"><button data-act="open-activity" data-pid="${p.id}" data-i="${i}"><span class="st-n">${s.status === 'done' ? ico('check') : i + 1}</span><span class="st-l">${esc(s.name)}</span><span class="st-s">${statusText(s)}</span></button></li>`).join('')}</ol></div>
  <div class="grid2">
    <div class="steps">${p.steps.map((s, i) => {
      const u = s.role ? assignee(p, s.role) : null;
      const kind = s.type === 'capture' ? 'Field capture' : s.type === 'review' ? 'Review gate' : s.type === 'parallel' ? 'Parallel activities' : 'Form';
      return `<div class="scard ${i === ci ? 'cur' : ''}"><div><div class="eyebrow">Step ${i + 1} · ${kind}</div><h3 style="margin:2px 0">${esc(s.name)}</h3>
        <div class="who">${s.type === 'parallel' ? 'All branches must complete' : esc(u ? u.name : ROLES[s.role]) + ' · ' + ROLES[s.role]}${s.milestone ? ` · <span style="color:var(--warn)">${ico('flag')} ${esc(s.milestone.name)}</span>` : ''}</div></div>
        <div class="row">${statusPill(s.status, statusText(s))}${s.status !== 'done' && s.status !== 'locked' && s.type !== 'parallel' ? duePill(s.due) : ''}${s.type !== 'parallel' && s.status !== 'locked' ? `<button class="btn sm" data-act="open-activity" data-pid="${p.id}" data-i="${i}">Open</button>` : ''}</div>
        ${s.type === 'parallel' ? `<div class="branches">${s.branches.map((b, bi) => `<div class="branch"><div><b>${esc(b.name)}</b><div class="small muted">${esc((assignee(p, b.role) || {}).name || ROLES[b.role])}</div></div><div class="row">${statusPill(b.status, b.status === 'active' ? 'In progress' : b.status === 'done' ? 'Done' : 'Not started')}${b.status === 'active' ? duePill(b.due) : ''}${b.status !== 'locked' ? `<button class="btn sm" data-act="open-activity" data-pid="${p.id}" data-i="${i}" data-bi="${bi}">Open</button>` : ''}</div></div>`).join('')}</div>` : ''}
        ${s.photos && s.photos.length ? `<div class="thumbs">${s.photos.slice(0, 6).map(ph => `<img src="${ph.src}" alt="Site photo">`).join('')}${s.photos.length > 6 ? `<span class="small muted">+${s.photos.length - 6}</span>` : ''}</div>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="stack">
      <section class="panel"><div class="panel-h"><h3>Site</h3></div><div class="panel-b"><dl class="kv">
        <dt>Address</dt><dd>${esc(p.address)}</dd><dt>Pin</dt><dd class="mono">${p.lat ? `${(+p.lat).toFixed(5)}, ${(+p.lng).toFixed(5)}` : '—'}</dd>
        <dt>Started</dt><dd>${fmtDate(p.start)}</dd><dt>Workflow</dt><dd>${esc(p.templateName)} v${p.templateVersion}</dd></dl></div></section>
      <section class="panel"><div class="panel-h"><h3>Team</h3></div><div class="panel-b team">${roles.map(r => { const u = assignee(p, r); return u ? `<div class="person"><span class="av">${initials(u.name)}</span><div><b>${esc(u.name)}</b><div class="small muted">${ROLES[r]}</div></div></div>` : ''; }).join('')}</div></section>
      ${p.milestones.length ? `<section class="panel"><div class="panel-h"><h3>Milestones</h3></div><div class="feed">${p.milestones.map(m => `<div class="fi ms"><span class="fic">${ico('flag')}</span><div><b>${esc(m.name)}</b><div class="when"><span>${fmtTime(m.at)}</span>${m.pay ? `<span class="ch">Invoice ${m.pay}% of fee</span>` : ''}<span class="ch">Meeting ${fmtShort(m.meeting)}</span></div></div></div>`).join('')}</div></section>` : ''}
      <section class="panel"><div class="panel-h"><h3>Audit trail</h3></div><div class="panel-b audit">${p.audit.map(a => `<div><span class="mono muted small">${fmtTime(a.t)}</span><span>${esc(a.text)} <span class="muted">· ${esc(a.by)}</span></span></div>`).join('')}</div></section>
    </div>
  </div>`;
};

function fieldHTML(f, val, ro, miss){
  const id = 'fld-' + f.k;
  const lab = `<label for="${id}">${esc(f.label)}${f.req ? ' <span class="req">Required</span>' : ''}</label>`;
  const full = f.type === 'textarea' ? ' full' : '';
  if (ro) return `<div class="field${full}"><label>${esc(f.label)}</label><div class="ro">${val !== undefined && val !== '' ? esc(f.type === 'date' ? fmtDate(val) : val) : '<span class="muted">—</span>'}</div></div>`;
  let input;
  if (f.type === 'textarea') input = `<textarea id="${id}" data-f="${f.k}" rows="3" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
  else if (f.type === 'select') input = `<select id="${id}" data-f="${f.k}"><option value="">Select</option>${(f.options || []).map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else input = `<input id="${id}" data-f="${f.k}" type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" ${f.type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(val)}" placeholder="${esc(f.ph || '')}">`;
  return `<div class="field${full}${miss ? ' miss' : ''}" data-fk="${f.k}">${lab}${input}</div>`;
}
function ctx(){ const p = proj(ui.p.pid); const s = p && p.steps[ui.p.i]; const t = s && s.type === 'parallel' ? s.branches[ui.p.bi || 0] : s; return {p, s, t}; }

function captureSections(p, s, t, ro){
  const pc = t.photos.length, short = pc < (s.minPhotos || 0);
  const missSet = ui.errors ? new Set(ui.errors.map(e => e.k)) : new Set();
  const dataFields = s.fields.filter(f => !['obs', 'next'].includes(f.k));
  const noteFields = s.fields.filter(f => ['obs', 'next'].includes(f.k));
  return `
  <section class="sec"><div class="sec-h"><h3>${ico('form')}Visit details</h3></div><div class="sec-b"><div class="fgrid">
    <div class="field"><label>Site</label><div class="ro">${esc(p.name)}<br><span class="muted small">${esc(p.address)}</span></div></div>
    ${dataFields.map(f => fieldHTML(f, t.data[f.k], ro, missSet.has(f.k))).join('')}</div></div></section>
  <section class="sec" id="sec-photos"><div class="sec-h"><h3>${ico('camera')}Photos</h3><span class="pcount ${short && !ro ? 'short' : ''}">${pc}${s.minPhotos ? ` / ${s.minPhotos} min` : ''}</span></div><div class="sec-b">
    <div class="photos">${t.photos.map((ph, k) => `<div class="ph"><img src="${ph.src}" alt="Site photo ${k + 1}">${ro ? '' : `<button data-act="del-photo" data-k="${k}" aria-label="Remove photo">${ico('x')}</button>`}</div>`).join('')}
    ${ro ? '' : `<button class="addph" data-act="take-photo">${ico('camera')}Take photo</button><button class="addph" data-act="pick-photo">${ico('image')}Upload</button>`}</div>
    ${!ro ? `<p class="small muted" style="margin-top:8px">Photos are stamped with date, time and location, then saved on this device.</p>` : ''}</div></section>
  <section class="sec" id="sec-gps"><div class="sec-h"><h3>${ico('pin')}Location${s.gps ? ' <span class="req">Required</span>' : ''}</h3></div><div class="sec-b">
    ${t.gps ? `<div class="gps"><span class="coord">${t.gps.lat.toFixed(5)}, ${t.gps.lng.toFixed(5)}</span><span class="small muted">${esc(t.gps.src)}${t.gps.acc ? ` · ±${Math.round(t.gps.acc)} m` : ''}</span>${ro ? '' : '<button class="btn sm ghost" data-act="clear-gps">Clear</button>'}</div>`
      : ro ? '<span class="muted">Not captured</span>' : `<div class="row"><button class="btn primary" data-act="gps">${ico('pin')}Capture GPS</button><button class="btn" data-act="gps-pin">Use project pin</button></div>
        <div class="fgrid" style="margin-top:12px" id="gps-manual" ${ui.gpsManual ? '' : 'hidden'}><div class="field"><label for="g-lat">Latitude</label><input id="g-lat" inputmode="decimal" placeholder="18.55903"></div><div class="field"><label for="g-lng">Longitude</label><input id="g-lng" inputmode="decimal" placeholder="73.78681"></div><div class="field full"><button class="btn" data-act="gps-manual">Save coordinates</button></div></div>`}
  </div></section>
  <section class="sec"><div class="sec-h"><h3>${ico('video')}Video, voice and documents</h3></div><div class="sec-b">
    ${ro ? '' : `<div class="media">
      <button class="mbtn" data-act="media" data-kind="video">${ico('video')}<b>Walkthrough video</b><span>${s.video ? 'Required' : 'Optional'}</span></button>
      <button class="mbtn" data-act="media" data-kind="voice">${ico('mic')}<b>Voice note</b><span>${s.voice ? 'Required' : 'Optional'}</span></button>
      <button class="mbtn" data-act="media" data-kind="doc">${ico('doc')}<b>Documents</b><span>7/12 extract, property card, drawings</span></button></div>`}
    <div class="mlist">${t.media.map((m, k) => `<div class="mitem">${ico(m.kind === 'voice' ? 'mic' : m.kind)}<span>${esc(m.name)}</span><span class="muted mono small">${(m.size / 1024).toFixed(0)} KB</span>${ro ? '' : `<button class="x" data-act="del-media" data-k="${k}" aria-label="Remove">${ico('x')}</button>`}</div>`).join('') || (ro ? '<span class="muted">None attached</span>' : '')}</div>
  </div></section>
  ${(s.checklist || []).length ? `<section class="sec"><div class="sec-h"><h3>${ico('check')}Site checklist <span class="req">Required</span></h3></div><div class="sec-b checks">
    ${s.checklist.map((c, ci) => `<label class="chk"><input type="checkbox" data-chk="${ci}" ${t.checks[ci] ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>${esc(c)}</span></label>`).join('')}</div></section>` : ''}
  <section class="sec"><div class="sec-h"><h3>${ico('doc')}Observations and next steps</h3></div><div class="sec-b"><div class="fgrid">${noteFields.map(f => fieldHTML(f, t.data[f.k], ro, missSet.has(f.k))).join('')}</div></div></section>`;
}
function formSections(s, t, ro){
  const missSet = ui.errors ? new Set(ui.errors.map(e => e.k)) : new Set();
  return `<section class="sec"><div class="sec-h"><h3>${ico('form')}${esc(t.name)}</h3></div><div class="sec-b"><div class="fgrid">${t.fields.map(f => fieldHTML(f, t.data[f.k], ro, missSet.has(f.k))).join('')}</div></div></section>`;
}
function reqPanelHTML(s, t, ro){
  const items = reqItems(s, t); const done = items.filter(x => x.ok).length; const pct = items.length ? Math.round(done / items.length * 100) : 100;
  if (ro) return `<div class="panel reqpanel"><div class="panel-h"><h3>Status</h3>${statusPill(t.status, {done: 'Done', submitted: 'In review', locked: 'Not started'}[t.status] || 'Submitted')}</div><div class="panel-b small muted">${t.submittedAt || t.doneAt ? `Submitted ${fmtTime(t.submittedAt || t.doneAt)}. ` : ''}${t.status === 'locked' ? 'This step opens when the previous step is complete.' : 'Read-only.'} ${t.status === 'submitted' ? 'Waiting for reviewer.' : ''}</div></div>`;
  return `<div class="panel reqpanel" id="reqpanel"><div class="panel-h"><h3>Required to submit</h3><span class="mono small">${done}/${items.length}</span></div><div class="panel-b">
    <div class="meter"><i style="width:${pct}%"></i></div>
    <ul class="reqlist">${items.map(x => `<li class="${x.ok ? 'ok' : 'no'}"><span class="ck">${x.ok ? ico('check') : ''}</span>${esc(x.label)}</li>`).join('')}</ul>
    ${ui.errors && ui.errors.length ? `<div class="errbox" style="margin-top:14px"><b>${ui.errors.length} required ${ui.errors.length === 1 ? 'item is' : 'items are'} missing:</b><ul>${ui.errors.map(e => `<li>${esc(e.label)}</li>`).join('')}</ul></div>` : ''}
    <button class="btn primary" style="width:100%;margin-top:14px" data-act="submit">${ico('check')}Submit${p_next_label(s)}</button>
    <div class="saved" style="margin-top:10px;justify-content:center">${ico('cloud')}<span id="savedlbl">Draft saved on this device</span></div>
  </div></div>`;
}
function p_next_label(s){ const {p} = ctx(); const nx = p.steps[ui.p.i + 1]; return s.type !== 'parallel' && nx && nx.type === 'review' ? ' for review' : ''; }

V.activity = () => {
  const {p, s, t} = ctx(); if (!p || !s) return V.dashboard();
  if (s.type === 'review') return reviewView(p, s);
  const ro = !(t.status === 'active' || t.status === 'rework');
  const u = assignee(p, t.role);
  const lastRework = (s.comments || []).filter(c => c.kind === 'rework').slice(-1)[0];
  const body = s.type === 'capture' ? captureSections(p, s, t, ro) : formSections(s, t, ro);
  const items = reqItems(s, t); const miss = items.filter(x => !x.ok).length;
  return `<div class="crumbs"><button data-act="back">${ico('back')}${esc(p.name)}</button>/<span>Step ${ui.p.i + 1}</span></div>
  <div class="head"><div><div class="eyebrow">${s.type === 'capture' ? 'Field capture' : s.type === 'parallel' ? 'Parallel activity' : 'Form'}</div><h1>${esc(t.name)}</h1><div class="sub">${esc(u ? u.name : '')} · ${ROLES[t.role]}${t.due && !ro ? ' · due ' + fmtShort(t.due) : ''}</div></div>
    <div class="row">${statusPill(t.status, s.type === 'parallel' ? (t.status === 'active' ? 'In progress' : t.status === 'done' ? 'Done' : 'Not started') : statusText(t))}${!ro ? duePill(t.due) : ''}</div></div>
  ${me().role !== t.role && !ro ? `<div class="banner info" style="margin-bottom:14px">${ico('eye')}<span>Assigned to ${esc(u ? u.name : ROLES[t.role])}. You can fill it in for this demo.</span></div>` : ''}
  ${t.status === 'rework' && lastRework ? `<div class="banner rework" style="margin-bottom:14px">${ico('alert')}<span><b>Rework requested by ${esc(lastRework.by)}:</b> ${esc(lastRework.text)}</span></div>` : ''}
  <div class="act"><div class="form">${body}</div>${reqPanelHTML(s, t, ro)}</div>
  ${!ro ? `<div class="submitbar"><span class="small" id="sb-lbl">${miss ? `<b style="color:var(--bad)">${miss} missing</b>` : '<b style="color:var(--ok)">Ready to submit</b>'}</span><button class="btn primary" data-act="submit">${ico('check')}Submit</button></div>` : ''}`;
};

function captureSummary(p, s){
  return `${captureSections(p, s, s, true)}`;
}
function reviewView(p, r){
  const i = ui.p.i, target = p.steps[i - 1]; const u = assignee(p, r.role);
  const canAct = r.status === 'active';
  const hist = (target.comments || []).slice().reverse();
  return `<div class="crumbs"><button data-act="back">${ico('back')}${esc(p.name)}</button>/<span>Step ${i + 1}</span></div>
  <div class="head"><div><div class="eyebrow">Review gate</div><h1>${esc(r.name)}</h1><div class="sub">Reviewer: ${esc(u ? u.name : ROLES[r.role])} · reviewing “${esc(target.name)}”</div></div><div class="row">${statusPill(r.status === 'active' ? 'submitted' : r.status, statusText(r))}${canAct ? duePill(r.due) : ''}</div></div>
  <div class="act"><div class="form">${target.type === 'capture' ? captureSummary(p, target) : formSections(target, target, true)}</div>
    <div class="panel reqpanel"><div class="panel-h"><h3>Decision</h3></div><div class="panel-b form">
      ${canAct ? `<div class="banner info">${ico('check')}<span>All ${reqItems(target, target).length} mandatory items were provided at submission.</span></div>
      <div class="field"><label for="rv-c">Comment</label><textarea id="rv-c" rows="4" placeholder="Required when sending back for rework"></textarea></div>
      ${ui.errors ? `<div class="errbox">${esc(ui.errors[0].label)}</div>` : ''}
      <button class="btn primary" data-act="approve">${ico('check')}Approve and start next step</button>
      <button class="btn danger" data-act="rework">Send back for rework</button>` : `<p class="muted">${r.status === 'done' ? 'Approved.' : 'Not yet submitted for review.'}</p>`}
      ${hist.length ? `<div class="subh" style="margin-top:6px">History</div>${hist.map(c => `<div class="small"><b>${esc(c.by)}</b> <span class="muted">${fmtTime(c.t)} · ${c.kind === 'rework' ? 'Rework' : 'Approved'}</span><div>${esc(c.text)}</div></div>`).join('')}` : ''}
    </div></div></div>`;
}

V.alerts = () => {
  const list = myNotes();
  return `<div class="head"><div><h1>Notifications</h1><div class="sub">Assignments, reviews, escalations and milestone triggers for ${ROLES[me().role]}</div></div><button class="btn" data-act="read-all">Mark all read</button></div>
  <div class="grid2"><section class="panel"><div class="feed">${list.map(noteItem).join('') || '<div class="empty">No notifications.</div>'}</div></section>
  <section class="panel"><div class="panel-h"><h3>Channels</h3></div><div class="panel-b"><dl class="kv">
    <dt>In-app</dt><dd>On</dd><dt>Push (Android)</dt><dd>On</dd><dt>Email</dt><dd>On</dd><dt>Calendar</dt><dd>Meetings on milestones</dd><dt>WhatsApp</dt><dd class="muted">Phase 2</dd></dl>
    <p class="small muted" style="margin-top:12px">Overdue activities escalate to the project manager the day after the SLA due date.</p></div></section></div>`;
};

V.templates = () => `<div class="head"><div><h1>Workflow templates</h1><div class="sub">Configure steps, roles, SLAs and mandatory fields. New projects use the latest version. Running projects keep theirs.</div></div></div>
  <div class="tcards">${S.templates.map(t => { const used = S.projects.filter(p => p.templateId === t.id); return `<div class="panel"><div class="panel-h"><div><h2>${esc(t.name)}</h2><div class="small muted">${esc(t.desc || '')}</div></div><span class="pill">v${t.version}</span></div>
    <div class="panel-b" style="display:flex;flex-direction:column;gap:12px">${flowHTML(t.steps)}
    <div class="small muted">${t.steps.length} steps · used by ${used.length} project${used.length === 1 ? '' : 's'} · updated ${fmtShort(t.updated)}</div>
    <div class="row"><button class="btn primary sm" data-act="edit-tpl" data-id="${t.id}">Configure</button><button class="btn sm" data-act="dup-tpl" data-id="${t.id}">${ico('copy')}Duplicate</button><button class="btn sm ghost" data-act="new-from" data-id="${t.id}">New project from this</button></div></div></div>`; }).join('')}</div>`;

function flowHTML(steps){
  const node = (name, type, sub, ms) => `<div class="fnode ${type}">${esc(name)}<small>${esc(sub)}</small>${ms ? `<span class="fms">◆ ${esc(ms.name)}</span>` : ''}</div>`;
  return `<div class="flow">${steps.map((s, i) => (i ? `<span class="farrow">→</span>` : '') + (s.type === 'parallel'
    ? `<div class="fpar">${s.branches.map(b => node(b.name, '', ROLES[b.role] + ' · ' + s.sla + 'd')).join('')}${s.milestone ? `<span class="fms" style="padding:0 4px">◆ ${esc(s.milestone.name)}</span>` : ''}</div>`
    : node(s.name, s.type, ROLES[s.role] + ' · ' + s.sla + 'd', s.milestone))).join('')}</div>`;
}

function fieldsEditor(fields, path){
  return `<div class="tbl-wrap"><table class="ftable"><thead><tr><th>Field</th><th>Type</th><th>Required</th><th></th></tr></thead><tbody>
    ${fields.map((f, k) => `<tr><td><input class="inp" data-tp="${path}.${k}.label" value="${esc(f.label)}" aria-label="Field label"></td>
      <td><select class="inp" data-tp="${path}.${k}.type" aria-label="Field type">${Object.entries(FIELD_TYPES).map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${f.type === 'select' ? `<input class="inp" style="margin-top:4px" data-tp="${path}.${k}.options" data-list="1" value="${esc((f.options || []).join(', '))}" placeholder="Options, comma separated">` : ''}</td>
      <td><input type="checkbox" data-tp="${path}.${k}.req" ${f.req ? 'checked' : ''} aria-label="Required"></td>
      <td><button class="btn icon ghost" data-act="del-field" data-path="${path}" data-k="${k}" aria-label="Remove field">${ico('trash')}</button></td></tr>`).join('')}
  </tbody></table></div><button class="btn sm" data-act="add-field" data-path="${path}">${ico('plus')}Add field</button>`;
}
const roleSel = (path, val) => `<select class="inp" data-tp="${path}">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

V['template-edit'] = () => {
  const d = ui.draft; const orig = tpl(d.id);
  const running = S.projects.filter(p => p.templateId === d.id);
  return `<div class="crumbs"><button data-go="templates">Workflow templates</button>/<span>${esc(orig.name)}</span></div>
  <div class="head"><div><div class="eyebrow">Editing v${orig.version} · saves as v${orig.version + 1}</div><h1><input class="inp" data-tp="name" value="${esc(d.name)}" style="font:inherit;font-family:var(--f-display);border-color:transparent;padding:2px 6px;margin-left:-6px;background:none" aria-label="Template name"></h1>
    <div class="sub">${running.length} running project${running.length === 1 ? '' : 's'} stay on their current version.</div></div>
    <div class="row"><button class="btn" data-go="templates">Discard</button><button class="btn primary" data-act="save-tpl">${ico('check')}Save as v${orig.version + 1}</button></div></div>
  ${ui.errors ? `<div class="errbox" style="margin-bottom:14px">${ui.errors.map(e => esc(e.label)).join('<br>')}</div>` : ''}
  <section class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Flow preview</h3><span class="small muted">Sequential left to right. Dashed box runs in parallel.</span></div><div class="panel-b" id="flowprev">${flowHTML(d.steps)}</div></section>
  <div class="stack" style="gap:12px">${d.steps.map((s, i) => {
    const P = `steps.${i}`;
    const type = {capture: 'Field capture', review: 'Review gate', parallel: 'Parallel', form: 'Form'}[s.type];
    return `<div class="tstep"><div class="tstep-h"><span class="num">${i + 1}</span><input data-tp="${P}.name" value="${esc(s.name)}" aria-label="Step name"><span class="pill ${s.type === 'capture' ? 'active' : s.type === 'review' ? 'submitted' : ''}">${type}</span>
      <button class="btn icon ghost" data-act="mv" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${ico('up')}</button><button class="btn icon ghost" data-act="mv" data-i="${i}" data-d="1" ${i === d.steps.length - 1 ? 'disabled' : ''} aria-label="Move down">${ico('down')}</button><button class="btn icon ghost" data-act="del-step" data-i="${i}" aria-label="Delete step">${ico('trash')}</button></div>
      <div class="tstep-b">
        <div class="tset">
          ${s.type !== 'parallel' ? `<label>Assigned role${roleSel(P + '.role', s.role)}</label>` : ''}
          <label>SLA (days)<input class="inp" type="number" min="0" data-tp="${P}.sla" value="${s.sla}"></label>
          ${s.type === 'capture' ? `<label>Minimum photos<input class="inp" type="number" min="0" data-tp="${P}.minPhotos" value="${s.minPhotos}"></label>
            <label class="tog"><input type="checkbox" data-tp="${P}.gps" ${s.gps ? 'checked' : ''}>GPS required</label>
            <label class="tog"><input type="checkbox" data-tp="${P}.video" ${s.video ? 'checked' : ''}>Video required</label>
            <label class="tog"><input type="checkbox" data-tp="${P}.voice" ${s.voice ? 'checked' : ''}>Voice note required</label>` : ''}
          ${s.type !== 'review' ? `<label class="tog"><input type="checkbox" data-act="toggle-ms" data-i="${i}" ${s.milestone ? 'checked' : ''}>Milestone on completion</label>` : ''}
        </div>
        ${s.milestone ? `<div class="tset"><label>Milestone name<input class="inp" data-tp="${P}.milestone.name" value="${esc(s.milestone.name)}"></label><label>Invoice trigger (% of fee)<input class="inp" type="number" min="0" max="100" data-tp="${P}.milestone.pay" value="${s.milestone.pay}"></label></div>` : ''}
        ${s.type === 'review' ? `<p class="small muted">Approves or sends back step ${i} (“${esc((d.steps[i - 1] || {}).name || 'none')}”). Rework returns it to the assignee.</p>` : ''}
        ${s.fields ? `<div class="subh">Fields</div>${fieldsEditor(s.fields, P + '.fields')}` : ''}
        ${s.type === 'capture' ? `<div class="subh">Site checklist (all required)</div>${(s.checklist || []).map((c, ci) => `<div class="row"><input class="inp" style="flex:1" data-tp="${P}.checklist.${ci}" value="${esc(c)}" aria-label="Checklist item"><button class="btn icon ghost" data-act="del-chk" data-i="${i}" data-k="${ci}" aria-label="Remove item">${ico('trash')}</button></div>`).join('')}<button class="btn sm" data-act="add-chk" data-i="${i}">${ico('plus')}Add checklist item</button>` : ''}
        ${s.type === 'parallel' ? s.branches.map((b, bi) => `<div class="bbox"><div class="tset"><label>Branch name<input class="inp" data-tp="${P}.branches.${bi}.name" value="${esc(b.name)}"></label><label>Assigned role${roleSel(`${P}.branches.${bi}.role`, b.role)}</label></div>${fieldsEditor(b.fields, `${P}.branches.${bi}.fields`)}</div>`).join('') : ''}
      </div></div>`;
  }).join('')}</div>
  <div class="row" style="margin-top:14px"><button class="btn" data-act="add-step" data-type="form">${ico('plus')}Form step</button><button class="btn" data-act="add-step" data-type="capture">${ico('camera')}Site capture step</button><button class="btn" data-act="add-step" data-type="review">${ico('eye')}Review gate</button><button class="btn" data-act="add-step" data-type="parallel">${ico('split')}Parallel pair</button></div>
  <section class="panel" style="margin-top:20px"><div class="panel-h"><h3>Version history</h3></div><div class="panel-b audit">${orig.history.slice().reverse().map(h => `<div><span class="mono small">v${h.v}</span><span>${fmtDate(h.date)} · ${esc(h.note)}</span></div>`).join('')}</div></section>`;
};

V['new-project'] = () => {
  const tid = ui.p.tid || S.templates[0].id; const t = tpl(tid);
  const roles = [...new Set(['pm', ...t.steps.flatMap(s => s.branches ? s.branches.map(b => b.role) : [s.role])])];
  return `<div class="crumbs"><button data-go="projects">Projects</button>/<span>New project</span></div>
  <div class="head"><div><h1>New project</h1><div class="sub">Pick a workflow template, assign the team and launch. The first activity is assigned straight away.</div></div></div>
  ${ui.errors ? `<div class="errbox" style="margin-bottom:14px">${ui.errors.map(e => esc(e.label)).join('<br>')}</div>` : ''}
  <div class="grid2"><div class="stack">
    <section class="sec"><div class="sec-h"><h3>Project</h3></div><div class="sec-b"><div class="fgrid">
      <div class="field"><label for="np-name">Project name <span class="req">Required</span></label><input id="np-name" placeholder="e.g. Pashan Residence"></div>
      <div class="field"><label for="np-client">Client <span class="req">Required</span></label><input id="np-client" placeholder="Client name"></div>
      <div class="field full"><label for="np-addr">Site address</label><input id="np-addr" placeholder="Plot, road, area, city"></div>
      <div class="field"><label for="np-lat">Site pin latitude</label><input id="np-lat" inputmode="decimal" placeholder="18.5204"></div>
      <div class="field"><label for="np-lng">Site pin longitude</label><input id="np-lng" inputmode="decimal" placeholder="73.8567"></div>
      <div class="field"><label for="np-start">Start date</label><input id="np-start" type="date" value="${today()}"></div>
      <div class="field"><label for="np-tpl">Workflow template</label><select id="np-tpl" data-act="np-tpl">${S.templates.map(x => `<option value="${x.id}" ${x.id === tid ? 'selected' : ''}>${esc(x.name)} (v${x.version})</option>`).join('')}</select></div>
    </div></div></section>
    <section class="sec"><div class="sec-h"><h3>Team</h3></div><div class="sec-b"><div class="fgrid">${roles.map(r => `<div class="field"><label for="np-r-${r}">${ROLES[r]}</label><select id="np-r-${r}" data-role="${r}">${S.users.map(u => `<option value="${u.id}" ${u.role === r ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>`).join('')}</div></div></section>
  </div>
  <div class="stack"><section class="panel"><div class="panel-h"><h3>${esc(t.name)} v${t.version}</h3></div><div class="panel-b">${flowHTML(t.steps)}
    <ol class="small" style="padding-left:18px;margin:12px 0 0;display:flex;flex-direction:column;gap:4px">${t.steps.map(s => `<li><b>${esc(s.name)}</b> <span class="muted">· ${s.type === 'parallel' ? s.branches.map(b => ROLES[b.role]).join(' + ') : ROLES[s.role]} · ${s.sla}d SLA</span></li>`).join('')}</ol>
    <button class="btn primary" style="width:100%;margin-top:16px" data-act="launch">Launch project</button></div></section></div></div>`;
};

V.capture = () => {
  const items = S.projects.flatMap(openItems).filter(it => it.type === 'capture');
  return `<div class="head"><div><h1>Site visits</h1><div class="sub">Pick a site visit to capture. Works offline on the Android app.</div></div></div>
  <section class="panel"><div class="tasks">${items.length ? items.map(taskRow).join('') : '<div class="empty">No site visits open. Start a new project to create one.</div>'}</div></section>`;
};

/* ---------- render ---------- */
function render(){
  checkEscalations();
  const shell = renderShell();
  const view = V[ui.route] || V.dashboard;
  $('#main').innerHTML = shell + view();
  document.body.classList.toggle('focus', ui.route === 'activity');
}
function refreshReq(){
  const {s, t} = ctx(); if (!t) return;
  if (ui.errors) ui.errors = reqItems(s, t).filter(x => !x.ok);
  const rp = $('#reqpanel'); if (rp){ const tmp = document.createElement('div'); tmp.innerHTML = reqPanelHTML(s, t, false); rp.replaceWith(tmp.firstElementChild); }
  const miss = reqItems(s, t).filter(x => !x.ok).length;
  const sb = $('#sb-lbl'); if (sb) sb.innerHTML = miss ? `<b style="color:var(--bad)">${miss} missing</b>` : '<b style="color:var(--ok)">Ready to submit</b>';
  document.querySelectorAll('.field.miss').forEach(el => { const k = el.dataset.fk; if (k && String(t.data[k] ?? '').trim()) el.classList.remove('miss'); });
}

/* ---------- template draft path setter ---------- */
function setPath(obj, path, val){
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}

/* ---------- events ---------- */
let fileCtx = null;
document.addEventListener('click', async e => {
  const g = e.target.closest('[data-go]'); if (g){ go(g.dataset.go); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (a.tagName === 'SELECT' || (a.tagName === 'INPUT' && a.type !== 'checkbox')) return;
  const {p, s, t} = ctx();
  switch (act){
    case 'open-project': go('project', {pid: a.dataset.pid}); break;
    case 'open-activity': go('activity', {pid: a.dataset.pid, i: +a.dataset.i, bi: a.dataset.bi !== undefined ? +a.dataset.bi : undefined}); break;
    case 'back': go('project', {pid: ui.p.pid}); break;
    case 'capture-now': {
      const items = S.projects.flatMap(openItems).filter(it => it.type === 'capture');
      const mine = items.filter(it => it.role === me().role);
      const pick = mine[0] || items[0];
      if (items.length === 1 || (pick && mine.length === 1)) go('activity', {pid: pick.p.id, i: pick.i}); else go('capture');
      break; }
    case 'reset': if (a.dataset.confirm){ try { localStorage.removeItem(KEY); } catch (_) {} seed(); go('dashboard'); toast('Demo data reset.'); } else { a.dataset.confirm = '1'; a.textContent = 'Tap again to reset'; setTimeout(() => { if (a.isConnected){ delete a.dataset.confirm; a.textContent = 'Reset demo data'; } }, 3000); } break;
    case 'take-photo': fileCtx = 'photo'; $('#f-cam').click(); break;
    case 'pick-photo': fileCtx = 'photo'; $('#f-gal').click(); break;
    case 'media': fileCtx = a.dataset.kind; $({video: '#f-video', voice: '#f-voice', doc: '#f-doc'}[a.dataset.kind]).click(); break;
    case 'del-photo': t.photos.splice(+a.dataset.k, 1); save(); render(); break;
    case 'del-media': t.media.splice(+a.dataset.k, 1); save(); render(); break;
    case 'gps':
      if (!navigator.geolocation){ ui.gpsManual = true; render(); toast('Location is not available here. Enter coordinates or use the project pin.'); break; }
      a.disabled = true; a.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(pos => {
        t.gps = {lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, src: 'Device GPS'}; save(); render(); toast('Location captured.');
      }, () => { ui.gpsManual = true; render(); toast('Could not get a GPS fix. Enter coordinates or use the project pin.'); }, {enableHighAccuracy: true, timeout: 12000, maximumAge: 60000});
      break;
    case 'gps-pin': if (p.lat){ t.gps = {lat: +p.lat, lng: +p.lng, acc: 0, src: 'Project pin'}; save(); render(); } else { ui.gpsManual = true; render(); toast('This project has no pin. Enter coordinates.'); } break;
    case 'gps-manual': { const la = parseFloat($('#g-lat').value), ln = parseFloat($('#g-lng').value);
      if (isNaN(la) || isNaN(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180){ toast('Enter a valid latitude and longitude.'); break; }
      t.gps = {lat: la, lng: ln, acc: 0, src: 'Entered manually'}; ui.gpsManual = false; save(); render(); break; }
    case 'clear-gps': t.gps = null; save(); render(); break;
    case 'submit': {
      const miss = reqItems(s, t).filter(x => !x.ok);
      if (miss.length){ ui.errors = miss; render(); const rp = $('#reqpanel'); if (rp) rp.scrollIntoView({behavior: 'smooth', block: 'start'}); toast(`${miss.length} required ${miss.length === 1 ? 'item is' : 'items are'} missing.`); break; }
      const msg = submitStep(p, ui.p.i, ui.p.bi || 0);
      if (navigator.onLine === false){ S.pending = (S.pending || 0) + 1; }
      save(true); go('project', {pid: p.id}); toast(msg); break; }
    case 'approve': { const c = $('#rv-c').value.trim(); const tn = p.steps[ui.p.i - 1].name; reviewStep(p, ui.p.i, true, c); save(true); go('project', {pid: p.id}); toast(`${tn} approved. Next activity started.`); break; }
    case 'rework': { const c = $('#rv-c').value.trim(); if (!c){ ui.errors = [{label: 'Add a comment so the assignee knows what to fix.'}]; render(); break; }
      reviewStep(p, ui.p.i, false, c); save(true); go('project', {pid: p.id}); toast('Sent back for rework. Assignee notified.'); break; }
    case 'read-all': myNotes().forEach(n => n.read = true); save(); render(); break;
    case 'edit-tpl': go('template-edit', {id: a.dataset.id}); break;
    case 'dup-tpl': { const src = tpl(a.dataset.id); const c = clone(src); c.id = uid('tpl-'); c.name = src.name + ' copy'; c.version = 1; c.updated = today(); c.history = [{v: 1, date: today(), note: `Duplicated from ${src.name} v${src.version}`}]; S.templates.push(c); save(); go('template-edit', {id: c.id}); toast('Template duplicated.'); break; }
    case 'new-from': go('new-project', {tid: a.dataset.id}); break;
    case 'add-field': { const arr = a.dataset.path.split('.').reduce((o, k) => o[k], ui.draft); arr.push({k: uid('f'), label: 'New field', type: 'text', req: false}); render(); break; }
    case 'del-field': { const arr = a.dataset.path.split('.').reduce((o, k) => o[k], ui.draft); arr.splice(+a.dataset.k, 1); render(); break; }
    case 'add-chk': ui.draft.steps[+a.dataset.i].checklist.push('New checklist item'); render(); break;
    case 'del-chk': ui.draft.steps[+a.dataset.i].checklist.splice(+a.dataset.k, 1); render(); break;
    case 'mv': { const i = +a.dataset.i, j = i + +a.dataset.d; const st = ui.draft.steps; [st[i], st[j]] = [st[j], st[i]]; render(); break; }
    case 'del-step': ui.draft.steps.splice(+a.dataset.i, 1); render(); break;
    case 'toggle-ms': { const st = ui.draft.steps[+a.dataset.i]; st.milestone = a.checked ? {name: st.name + ' Complete', pay: 0} : undefined; if (!a.checked) delete st.milestone; render(); break; }
    case 'add-step': {
      const ty = a.dataset.type; let st;
      if (ty === 'form') st = {id: uid('s-'), name: 'New activity', type: 'form', role: 'architect', sla: 2, fields: [{k: uid('f'), label: 'Notes', type: 'textarea', req: true}]};
      if (ty === 'capture') st = {id: uid('s-'), name: 'Site Visit', type: 'capture', role: 'site', sla: 2, minPhotos: 3, gps: true, video: false, voice: false, fields: [{k: 'visitDate', label: 'Visit date', type: 'date', req: true}, {k: 'obs', label: 'Site observations', type: 'textarea', req: true}, {k: 'next', label: 'Next steps', type: 'textarea', req: true}], checklist: ['Boundary markers verified']};
      if (ty === 'review') st = {id: uid('s-'), name: 'Review', type: 'review', role: 'admin', sla: 1};
      if (ty === 'parallel') st = {id: uid('s-'), name: 'Parallel activities', type: 'parallel', sla: 3, branches: [{id: uid('b-'), name: 'Branch A', role: 'architect', fields: [{k: uid('f'), label: 'Notes', type: 'textarea', req: true}]}, {id: uid('b-'), name: 'Branch B', role: 'civil', fields: [{k: uid('f'), label: 'Notes', type: 'textarea', req: true}]}]};
      ui.draft.steps.push(st); render(); break; }
    case 'save-tpl': {
      const d = ui.draft, errs = [];
      if (!d.steps.length) errs.push({label: 'Add at least one step.'});
      d.steps.forEach((s, i) => { if (s.type === 'review' && (i === 0 || d.steps[i - 1].type === 'review' || d.steps[i - 1].type === 'parallel')) errs.push({label: `Step ${i + 1} “${s.name}” is a review gate and needs a form or site capture step directly before it.`}); if (!String(s.name).trim()) errs.push({label: `Step ${i + 1} needs a name.`}); });
      if (errs.length){ ui.errors = errs; render(); window.scrollTo(0, 0); break; }
      const t0 = tpl(d.id); t0.version += 1; t0.name = d.name; t0.steps = d.steps; t0.updated = today(); t0.history.push({v: t0.version, date: today(), note: `Edited by ${me().name}`});
      notify(`Template ${t0.name} saved as v${t0.version}. Running projects keep their version.`, {role: 'admin', kind: 'info'});
      save(true); go('templates'); toast(`Saved ${t0.name} v${t0.version}.`); break; }
    case 'launch': {
      const name = $('#np-name').value.trim(), client = $('#np-client').value.trim();
      const errs = []; if (!name) errs.push({label: 'Project name is required.'}); if (!client) errs.push({label: 'Client is required.'});
      if (errs.length){ ui.errors = errs; const keep = {n: name, c: client}; render(); $('#np-name').value = keep.n; $('#np-client').value = keep.c; window.scrollTo(0, 0); break; }
      const t0 = tpl($('#np-tpl').value); const team = {};
      document.querySelectorAll('[data-role]').forEach(el => team[el.dataset.role] = el.value);
      Object.keys(ROLES).forEach(r => { if (!team[r]) team[r] = (S.users.find(u => u.role === r) || {}).id; });
      const lat = parseFloat($('#np-lat').value), lng = parseFloat($('#np-lng').value);
      const np = {id: uid('p-'), name, client, address: $('#np-addr').value.trim() || 'Address to be confirmed', lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, start: $('#np-start').value || today(), team, audit: [], milestones: [], status: 'active', created: today()};
      instantiate(t0, np); S.projects.unshift(np); audit(np, `Project created from ${t0.name} v${t0.version}`); activate(np, 0);
      save(true); go('project', {pid: np.id}); toast(`${name} launched. ${np.steps[0].name} assigned.`); break; }
  }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.act === 'switch-user'){ S.me = el.value; save(); render(); toast(`Viewing as ${me().name}, ${ROLES[me().role]}`); return; }
  if (el.dataset.act === 'np-tpl'){ const keep = {}; ['np-name', 'np-client', 'np-addr', 'np-lat', 'np-lng', 'np-start'].forEach(id => keep[id] = $('#' + id).value); ui.p.tid = el.value; render(); Object.entries(keep).forEach(([id, v]) => $('#' + id).value = v); return; }
  if (el.dataset.act === 'toggle-ms'){ return; }
  if (el.dataset.tp && ui.route === 'template-edit'){ applyTp(el); if (el.tagName === 'SELECT' || el.type === 'checkbox') render(); else { const fp = $('#flowprev'); if (fp) fp.innerHTML = flowHTML(ui.draft.steps); } return; }
  if (el.dataset.chk !== undefined){ const {t} = ctx(); t.checks[el.dataset.chk] = el.checked; save(); refreshReq(); return; }
  if (el.type === 'file'){
    const files = [...el.files]; el.value = ''; fileCtx = {'f-cam': 'photo', 'f-gal': 'photo', 'f-video': 'video', 'f-voice': 'voice', 'f-doc': 'doc'}[el.id] || fileCtx; if (!files.length) return;
    const {p, t} = ctx(); if (!t) return;
    if (fileCtx === 'photo'){
      const loc = t.gps ? `  ${t.gps.lat.toFixed(5)}, ${t.gps.lng.toFixed(5)}` : '';
      for (const f of files){
        try { const d = new Date(); const src = await readImage(f, `${d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short'})} ${d.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}${loc}  ${p.name}`); t.photos.push({id: uid('ph'), src, t: Date.now()}); }
        catch (_) { toast('That file could not be read as an image.'); }
      }
      save(true); render(); toast(`${files.length} photo${files.length > 1 ? 's' : ''} added.`);
    } else {
      files.forEach(f => t.media.push({kind: fileCtx, name: f.name || (fileCtx + ' ' + new Date().toLocaleTimeString()), size: f.size, t: Date.now()}));
      save(true); render(); toast('Attached.');
    }
  }
});
function applyTp(el){
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'number') v = el.value === '' ? 0 : Number(el.value);
  if (el.dataset.list) v = el.value.split(',').map(x => x.trim()).filter(Boolean);
  setPath(ui.draft, el.dataset.tp, v);
  if (el.dataset.tp.endsWith('.type') && v === 'select'){ const fp = el.dataset.tp.replace(/\.type$/, ''); const f = fp.split('.').reduce((o, k) => o[k], ui.draft); if (!f.options) f.options = ['Option 1', 'Option 2']; }
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.tp && ui.route === 'template-edit' && el.type !== 'checkbox' && el.tagName !== 'SELECT'){ applyTp(el); return; }
  if (el.dataset.f && ui.route === 'activity'){ const {t} = ctx(); if (!t) return; t.data[el.dataset.f] = el.value; save(); refreshReq(); }
});
window.addEventListener('online', () => { if (S.pending){ toast(`Back online. ${S.pending} capture${S.pending > 1 ? 's' : ''} synced.`); S.pending = 0; save(); } render(); });
window.addEventListener('offline', () => render());
if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App){ window.Capacitor.Plugins.App.addListener('backButton', () => { if (ui.route === 'activity') go('project', {pid: ui.p.pid}); else if (ui.route !== 'dashboard') go('dashboard'); else window.Capacitor.Plugins.App.exitApp(); }); }

/* ---------- boot ---------- */
S = load();
if (!S || S.v !== 1) seed();
render();
})();
