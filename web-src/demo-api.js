/* ---------- SiteFlow demo API ----------
   Same interface as api.js, but the v1 workflow runs in the browser with sample data, so the
   demo works as a single file with no server. The rules mirror the FastAPI backend: roles and
   project visibility, Legal Approval transitions, mandatory site visit validation, derived
   progress and the Team Lead review. DEMO_TEMPLATE is injected by build.py from
   backend/app/template_config.py, so the stages, checklists and problem list stay in step. */
const SiteFlowAPI = (() => {
  'use strict';
  const T = DEMO_TEMPLATE;
  const K_DB = 'siteflow.demo.db.v1', K_TOKEN = 'siteflow.demo.token';
  const PASSWORD = 'demo';
  const mem = {};
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch (_) { return mem[k] ?? null; } },
    set(k, v){ try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { if (v == null) delete mem[k]; else mem[k] = v; } }
  };

  class ApiError extends Error {
    constructor(status, message, detail){ super(message); this.status = status; this.detail = detail; }
    get missing(){ return (this.detail && this.detail.missing) || []; }
    get invalid(){ return (this.detail && this.detail.invalid) || []; }
  }
  const fail = (status, message, extra) => { throw new ApiError(status, message, extra ? {message, ...extra} : message); };

  /* ---------- storage ---------- */
  let db = null, clockOffset = 0, onSignedOut = null;
  const now = () => new Date(Date.now() - clockOffset).toISOString();
  const ymd = daysAgo => { const d = new Date(Date.now() - daysAgo * 864e5); return d.toISOString().slice(0, 10); };
  function load(){ try { db = JSON.parse(store.get(K_DB) || 'null'); } catch (_) { db = null; } if (!db || db.v !== 1) seed(); }
  const save = () => store.set(K_DB, JSON.stringify(db));
  const nextId = kind => (db.seq[kind] = (db.seq[kind] || 0) + 1);
  const user = id => db.users.find(u => u.id === id);
  const brief = u => u ? {id: u.id, name: u.name, role: u.role} : null;

  /* ---------- auth and access ---------- */
  function current(){
    const t = store.get(K_TOKEN), u = t && user(+t);
    if (!u){ store.set(K_TOKEN, null); if (t && onSignedOut) onSignedOut(); fail(401, 'Not authenticated'); }
    return u;
  }
  function role(u, ...roles){ if (!roles.includes(u.role)) fail(403, 'Your role cannot perform this action'); }
  const seesAll = u => u.role === 'architect' || u.role === 'team_lead';
  const visible = u => db.projects.filter(p => seesAll(u) || p.members.includes(u.id));
  function project(u, id){ const p = visible(u).find(x => x.id === +id); if (!p) fail(404, 'Project not found'); return p; }

  /* ---------- workflow ---------- */
  const audit = (p, u, action, detail = {}) => db.audit.push({project_id: p.id, actor_id: u.id, action, detail, at: now()});
  const step = (p, order) => p.steps.find(s => s.order === order);
  function setStep(p, order, status, u){
    const s = step(p, order); if (s.status === status) return;
    s.status = status;
    audit(p, u, {active: 'step.activated', completed: 'step.completed', locked: 'step.locked'}[status], {step: s.name});
  }
  const visitsOf = p => db.visits.filter(v => v.project_id === p.id);
  const latest = p => { const vs = visitsOf(p); return vs[vs.length - 1] || null; };
  const engineerOf = p => p.members.map(user).find(u => u && u.role === 'civil_engineer') || null;

  /* ---------- progress (mirrors services/progress.py) ---------- */
  function deriveProgress(stageName, states){
    const idx = T.stages.findIndex(s => s.name === stageName);
    const stage = T.stages[idx];
    const done = stage.checklist.filter(i => states[i.id] === 'Done').length;
    const total = T.stages.slice(0, idx).reduce((a, s) => a + s.weight, 0) + stage.weight * done / stage.checklist.length;
    return Math.round((total + 1e-9) * 10) / 10;
  }

  /* ---------- validation (mirrors services/validation.py) ---------- */
  function validate(b){
    const miss = [], inv = [], blank = v => v == null || (typeof v === 'string' && !v.trim());
    ['visit_at', 'weather', 'attendees', 'current_stage', 'summary', 'recommended_action'].forEach(f => { if (blank(b[f])) miss.push(f); });
    const loc = b.location;
    if (!loc || (!loc.gps && blank(loc.manual))) miss.push('location');
    else if (loc.gps && !(Math.abs(loc.gps.lat) <= 90 && Math.abs(loc.gps.lng) <= 180)) inv.push('location.gps');
    const checklist = b.checklist || {}, problems = b.problems || [];
    if (!blank(b.current_stage)){
      const stage = T.stages.find(s => s.name === b.current_stage);
      if (!stage) inv.push('current_stage');
      else {
        const ids = stage.checklist.map(i => i.id);
        ids.forEach(i => { if (!(i in checklist)) miss.push('checklist.' + i); });
        Object.entries(checklist).forEach(([k, st]) => { if (!ids.includes(k) || !T.checklist_states.includes(st)) inv.push('checklist.' + k); });
      }
    }
    if (b.no_issues && problems.length) inv.push('no_issues');
    else if (!b.no_issues && !problems.length) miss.push('problems');
    problems.forEach((p, n) => {
      const at = `problems[${n}]`;
      if (blank(p.category)) miss.push(at + '.category');
      else if (!(p.category in T.problems)) inv.push(at + '.category');
      else if (p.category === 'Other'){ if (blank(p.other_text)) miss.push(at + '.other_text'); }
      else if (blank(p.problem)) miss.push(at + '.problem');
      else if (!T.problems[p.category].includes(p.problem)) inv.push(at + '.problem');
      if (blank(p.severity)) miss.push(at + '.severity');
      else if (!T.severities.includes(p.severity)) inv.push(at + '.severity');
      ['location', 'responsible_party', 'target_date'].forEach(f => { if (blank(p[f])) miss.push(`${at}.${f}`); });
    });
    return [miss, inv];
  }

  /* ---------- serializers (mirror schemas.py) ---------- */
  function visitBrief(v){
    if (!v) return null;
    const rw = db.reviews.filter(r => r.visit_id === v.id && r.decision === 'rework').pop();
    return {id: v.id, status: v.status, submission_count: v.submission_count, computed_progress: v.computed_progress,
      submitted_at: v.submitted_at, rework_comment: rw && v.status === 'rework' ? rw.comment : null};
  }
  function visitOut(v){
    const p = db.projects.find(x => x.id === v.project_id);
    return {...visitBrief(v), project: {id: p.id, name: p.name, location: p.location}, engineer: brief(user(v.engineer_id)),
      current_stage: v.current_stage, form: v.form, checklist: v.checklist, no_issues: v.no_issues, problems: v.problems,
      reviews: db.reviews.filter(r => r.visit_id === v.id).map(r => ({decision: r.decision, comment: r.comment, reviewer: brief(user(r.reviewer_id)), at: r.at}))};
  }
  function summary(p){
    const v = latest(p), active = p.steps.find(s => s.status === 'active');
    return {id: p.id, name: p.name, location: p.location, current_step: active ? active.name : null,
      official_progress: p.official_progress, latest_visit_status: v ? v.status : null, civil_engineer: brief(engineerOf(p))};
  }
  function detail(p){
    return {...summary(p), template: {id: T.id, version: T.version}, steps: p.steps.map(s => ({...s})), legal_approval: {...p.legal},
      latest_visit: visitBrief(latest(p)),
      audit: db.audit.filter(e => e.project_id === p.id).map(e => ({action: e.action, actor: (user(e.actor_id) || {}).name, at: e.at, detail: e.detail}))};
  }

  /* ---------- operations (mirror the routers) ---------- */
  function createProject(u, b){
    role(u, 'architect');
    const name = (b.name || '').trim(), location = (b.location || '').trim();
    if (!name || !location) fail(422, 'Project name and location are required');
    const eng = user(+b.civil_engineer_id);
    if (!eng || eng.role !== 'civil_engineer') fail(422, 'civil_engineer_id must be an active Civil Engineer');
    const admins = db.users.filter(x => x.role === 'admin').map(x => x.id);
    const p = {id: nextId('project'), name, location, official_progress: 0, members: [...new Set([u.id, eng.id, ...admins])],
      steps: T.steps.map((s, i) => ({order: i + 1, name: s, status: i === 0 ? 'active' : 'locked'})),
      legal: {status: 'Not started', authority_name: null, application_reference: null, application_date: null,
        approval_date: null, expected_date: b.legal_expected_date || null, document_reference: null}};
    db.projects.push(p);
    audit(p, u, 'project.created', {civil_engineer_id: eng.id});
    return p;
  }

  const LEGAL_NEXT = {'Not started': ['Applied'], 'Applied': ['Approved', 'Rejected']};
  const LEGAL_REQ = {Applied: ['authority_name', 'application_reference', 'application_date'],
    Approved: ['authority_name', 'application_reference', 'application_date', 'approval_date', 'document_reference']};
  function updateLegal(u, pid, b){
    role(u, 'admin');
    const p = project(u, pid), la = p.legal, cur = la.status, target = b.status || cur;
    if (!LEGAL_NEXT[cur]) fail(409, `Legal Approval is ${cur} and can no longer change`);
    if (target !== cur && !LEGAL_NEXT[cur].includes(target)) fail(409, `Cannot move Legal Approval from ${cur} to ${target}`);
    const changes = {};
    LEGAL_REQ.Approved.forEach(f => { if (f in b) changes[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f]; });
    const merged = {...la, ...changes};
    const missing = (LEGAL_REQ[target] || []).filter(f => !merged[f]);
    if (missing.length) fail(422, `${target} needs every required field`, {missing});
    if (merged.approval_date && merged.application_date && merged.approval_date < merged.application_date) fail(422, 'approval_date cannot be before application_date', {missing: []});
    Object.assign(la, changes, {status: target});
    audit(p, u, 'legal.updated', {from: cur, to: target, fields: Object.keys(changes).sort()});
    if (target === 'Approved'){ setStep(p, 1, 'completed', u); setStep(p, 2, 'active', u); }
    return p;
  }

  function submitVisit(u, pid, b){
    role(u, 'civil_engineer');
    const p = project(u, pid);
    if (step(p, 2).status !== 'active') fail(409, 'Site Visit step is not open for this project');
    const [missing, invalid] = validate(b);
    if (missing.length || invalid.length) fail(422, 'Site visit is incomplete', {missing, invalid});
    let v = visitsOf(p).find(x => x.status === 'rework');
    if (!v){ v = {id: nextId('visit'), project_id: p.id, submission_count: 0, created_at: now()}; db.visits.push(v); }
    Object.assign(v, {engineer_id: u.id, current_stage: b.current_stage,
      form: {visit_at: b.visit_at, location: b.location, weather: b.weather.trim(), attendees: b.attendees.trim(),
        summary: b.summary.trim(), recommended_action: b.recommended_action.trim()},
      checklist: {...b.checklist}, no_issues: !!b.no_issues, problems: (b.problems || []).map(x => ({...x})),
      computed_progress: deriveProgress(b.current_stage, b.checklist), status: 'submitted',
      submission_count: v.submission_count + 1, submitted_at: now()});
    audit(p, u, 'site_visit.submitted', {submission: v.submission_count, computed_progress: v.computed_progress});
    setStep(p, 2, 'completed', u); setStep(p, 3, 'active', u);
    return v;
  }

  function review(u, vid, b){
    role(u, 'team_lead');
    const v = db.visits.find(x => x.id === +vid); if (!v) fail(404, 'Site visit not found');
    if (v.status !== 'submitted') fail(409, `Site visit is ${v.status}, not waiting for review`);
    const comment = (b.comment || '').trim() || null;
    if (b.decision === 'rework' && !comment) fail(422, 'Rework needs a comment for the engineer', {missing: ['comment']});
    if (!['approve', 'rework'].includes(b.decision)) fail(422, 'Decision must be approve or rework');
    const p = db.projects.find(x => x.id === v.project_id);
    db.reviews.push({id: nextId('review'), visit_id: v.id, reviewer_id: u.id, decision: b.decision, comment, at: now()});
    const d = {submission: v.submission_count, comment};
    if (b.decision === 'approve'){
      v.status = 'approved'; p.official_progress = v.computed_progress;
      audit(p, u, 'site_visit.approved', {...d, official_progress: v.computed_progress});
      setStep(p, 3, 'completed', u);
    } else {
      v.status = 'rework';
      audit(p, u, 'site_visit.rework_requested', d);
      setStep(p, 3, 'locked', u); setStep(p, 2, 'active', u);
    }
    return v;
  }

  /* ---------- sample data ---------- */
  function seed(){
    db = {v: 1, seq: {}, users: [
      {id: 1, name: 'Meera Joshi', email: 'architect@siteflow.demo', role: 'architect'},
      {id: 2, name: 'Parvez', email: 'parvez@siteflow.demo', role: 'team_lead'},
      {id: 3, name: 'Farhan Shaikh', email: 'engineer@siteflow.demo', role: 'civil_engineer'},
      {id: 4, name: 'Office Coordinator', email: 'admin@siteflow.demo', role: 'admin'}
    ], projects: [], visits: [], reviews: [], audit: []};
    db.seq.user = 4;
    const [arch, lead, eng, admin] = db.users;
    const at = days => { clockOffset = days * 864e5; };
    const applied = (p, d, ref) => { at(d); updateLegal(admin, p.id, {status: 'Applied', authority_name: 'Pune Municipal Corporation', application_reference: ref, application_date: ymd(d)}); };
    const approved = (p, d, ref) => { at(d); updateLegal(admin, p.id, {status: 'Approved', approval_date: ymd(d), document_reference: `PMC building permission ${ref}.pdf`}); };
    const states = (stage, done) => Object.fromEntries(T.stages.find(s => s.name === stage).checklist.map((i, k) => [i.id, k < done ? 'Done' : k === done ? 'In progress' : 'Not started']));
    const visit = (stage, done, extra) => ({visit_at: now(), location: {gps: null, manual: extra.where}, weather: extra.weather,
      attendees: 'Farhan Shaikh (Civil Engineer), site contractor', current_stage: stage, checklist: states(stage, done),
      no_issues: !extra.problems, problems: extra.problems || [], summary: extra.summary, recommended_action: extra.action});

    // 1. Waiting on the authority: Legal Approval applied.
    at(6); let p = createProject(arch, {name: 'Gokhale Residence', location: 'Plot 14, Baner Road, Pune', civil_engineer_id: eng.id, legal_expected_date: ymd(-20)});
    applied(p, 4, 'PMC/BP/2026/0142');

    // 2. Approved and ready for the first site visit.
    at(14); p = createProject(arch, {name: 'Patil Villa', location: 'Survey No. 52, Aundh, Pune', civil_engineer_id: eng.id, legal_expected_date: ymd(0)});
    applied(p, 12, 'PMC/BP/2026/0098'); approved(p, 2, 'PMC/BP/2026/0098');

    // 3. Site visit submitted, waiting for Parvez.
    at(40); p = createProject(arch, {name: 'Deshmukh Residence', location: 'Karve Road, Kothrud, Pune', civil_engineer_id: eng.id, legal_expected_date: ymd(20)});
    applied(p, 38, 'PMC/BP/2026/0051'); approved(p, 25, 'PMC/BP/2026/0051');
    at(0.3); submitVisit(eng, p.id, visit('Superstructure', 2, {where: 'Karve Road site, rear block', weather: 'Humid, overcast',
      problems: [{category: 'Structural', problem: 'Honeycombing in concrete', other_text: null, severity: 'High', location: 'Column C4, ground floor',
        responsible_party: 'Structural contractor', target_date: ymd(-7)},
      {category: 'Safety', problem: 'Missing barricading', other_text: null, severity: 'Medium', location: 'Road-side edge of slab',
        responsible_party: 'Site supervisor', target_date: ymd(-2)}],
      summary: 'Columns and beams cast for the ground floor. Honeycombing found at column C4.',
      action: 'Structural engineer to inspect C4 before the first-floor slab is poured.'}));

    // 4. Reviewed once, reworked, then approved: progress is official.
    at(70); p = createProject(arch, {name: 'Kapoor House', location: 'ITI Road, Aundh, Pune', civil_engineer_id: eng.id, legal_expected_date: ymd(50)});
    applied(p, 68, 'PMC/BP/2026/0017'); approved(p, 55, 'PMC/BP/2026/0017');
    at(9); let v = submitVisit(eng, p.id, visit('Masonry', 1, {where: 'ITI Road plot, Aundh', weather: 'Clear',
      summary: 'External walls built. Partitions under way.', action: 'Continue partitions; cast lintels next week.'}));
    at(8); review(lead, v.id, {decision: 'rework', comment: 'Please confirm the lintel status; it was cast last week per the contractor.'});
    at(7); v = submitVisit(eng, p.id, visit('Masonry', 2, {where: 'ITI Road plot, Aundh', weather: 'Clear',
      summary: 'External walls and partitions complete. Lintels in progress.', action: 'Cast remaining lintels; start internal plaster.'}));
    at(6); review(lead, v.id, {decision: 'approve'});

    clockOffset = 0;
    save();
  }

  /* ---------- public interface (same as api.js) ---------- */
  const run = fn => new Promise((resolve, reject) => {
    setTimeout(() => {
      try { load(); const out = fn(); save(); resolve(JSON.parse(JSON.stringify(out))); }
      catch (e) { if (e instanceof ApiError) reject(e); else reject(new ApiError(500, 'Something went wrong in the demo. Reset the demo data and try again.')); }
    }, 60);
  });

  return {
    ApiError, isNative: false, demo: true,
    base: () => 'Demo mode: sample data stays in this browser',
    setBase(){},
    signedIn: () => !!store.get(K_TOKEN),
    onSignedOut(fn){ onSignedOut = fn; },
    demoPassword: PASSWORD,
    demoAccounts: [
      {email: 'architect@siteflow.demo', label: 'Meera Joshi', role: 'Architect'},
      {email: 'admin@siteflow.demo', label: 'Office Coordinator', role: 'Admin'},
      {email: 'engineer@siteflow.demo', label: 'Farhan Shaikh', role: 'Civil Engineer'},
      {email: 'parvez@siteflow.demo', label: 'Parvez', role: 'Team Lead'}
    ],
    resetDemo(){ store.set(K_DB, null); load(); },
    login: (email, password) => run(() => {
      const u = db.users.find(x => x.email === String(email).trim().toLowerCase());
      if (!u || password !== PASSWORD) fail(401, 'Incorrect email or password');
      store.set(K_TOKEN, String(u.id));
      return {id: u.id, name: u.name, email: u.email, role: u.role};
    }),
    logout(){ store.set(K_TOKEN, null); },
    me: () => run(() => { const u = current(); return {id: u.id, name: u.name, email: u.email, role: u.role}; }),
    template: () => run(() => T),
    projects: () => run(() => visible(current()).map(summary)),
    project: id => run(() => detail(project(current(), id))),
    createProject: body => run(() => detail(createProject(current(), body))),
    engineers: () => run(() => { role(current(), 'architect'); return db.users.filter(u => u.role === 'civil_engineer').map(brief); }),
    updateLegal: (id, body) => run(() => detail(updateLegal(current(), id, body))),
    submitVisit: (id, body) => run(() => visitOut(submitVisit(current(), id, body))),
    visit: id => run(() => {
      const u = current(), v = db.visits.find(x => x.id === +id);
      if (!v || !visible(u).some(p => p.id === v.project_id)) fail(404, 'Site visit not found');
      return visitOut(v);
    }),
    reviewQueue: () => run(() => {
      const u = current(); role(u, 'team_lead');
      return db.visits.filter(v => v.status === 'submitted').sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)).map(v => {
        const p = db.projects.find(x => x.id === v.project_id);
        return {id: v.id, project: {id: p.id, name: p.name, location: p.location}, engineer: brief(user(v.engineer_id)),
          current_stage: v.current_stage, submission_count: v.submission_count, computed_progress: v.computed_progress,
          submitted_at: v.submitted_at, waiting_minutes: Math.max(0, Math.floor((Date.now() - Date.parse(v.submitted_at)) / 6e4))};
      });
    }),
    review: (id, body) => run(() => visitOut(review(current(), id, body)))
  };
})();
