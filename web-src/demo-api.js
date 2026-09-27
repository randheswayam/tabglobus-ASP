/* ---------- SiteFlow demo API ----------
   Same interface as api.js, but the workflow runs in the browser with sample data, so the demo works
   as a single file with no server. The rules mirror the FastAPI backend: roles and project visibility,
   Legal Approval transitions, mandatory site visit validation with photo evidence, derived progress,
   the Team Lead review with recurring visits, open problems, red flags, the dashboard, notifications,
   the 18-stage tracker, client invites, milestone sign-offs, the client app and shared site updates.
   DEMO_TEMPLATE is injected by build.py from the backend's template and workflow config, so stages,
   checklists, the problem list, media limits and red flag thresholds stay in step. */
const SiteFlowAPI = (() => {
  'use strict';
  const T = DEMO_TEMPLATE;
  const K_DB = 'siteflow.demo.db.v3', K_TOKEN = 'siteflow.demo.token';
  const PASSWORD = 'demo';
  const mem = {};
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch (_) { return mem[k] ?? null; } },
    set(k, v){
      try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; }
      catch (e) { if (e && e.name === 'QuotaExceededError') return false; if (v == null) delete mem[k]; else mem[k] = v; return true; }
    }
  };

  class ApiError extends Error {
    constructor(status, message, detail){ super(message); this.status = status; this.detail = detail; }
    get missing(){ return (this.detail && this.detail.missing) || []; }
    get invalid(){ return (this.detail && this.detail.invalid) || []; }
  }
  const fail = (status, message, extra) => { throw new ApiError(status, message, extra ? {message, missing: [], invalid: [], ...extra} : message); };

  /* ---------- storage ---------- */
  let db = null, clockOffset = 0, onSignedOut = null;
  const sessionFiles = {};  // videos live only for this browser session; photos are kept as small JPEGs
  const nowMs = () => Date.now() - clockOffset;
  const now = () => new Date(nowMs()).toISOString();
  const ymd = daysAgo => new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
  function load(){ try { db = JSON.parse(store.get(K_DB) || 'null'); } catch (_) { db = null; } if (!db || db.v !== 3) seed(); }
  function save(){ if (!store.set(K_DB, JSON.stringify(db))) fail(507, 'The demo has run out of browser storage. Use Reset demo data to start again.'); }
  const nextId = kind => (db.seq[kind] = (db.seq[kind] || 0) + 1);
  const user = id => db.users.find(u => u.id === id);
  const brief = u => u ? {id: u.id, name: u.name, role: u.role} : null;
  const byId = (list, id) => list.find(x => x.id === +id);

  /* ---------- auth and access ---------- */
  function current(){
    const t = store.get(K_TOKEN), u = t && user(+t);
    if (!u){ store.set(K_TOKEN, null); if (t && onSignedOut) onSignedOut(); fail(401, 'Not authenticated'); }
    return u;
  }
  function role(u, ...roles){ if (!roles.includes(u.role)) fail(403, 'Your role cannot perform this action'); }
  function staff(){ const u = current(); if (u.role === 'client') fail(403, 'This area is for the SiteFlow team. Clients use the client app.'); return u; }
  function clientUser(){ const u = current(); if (u.role !== 'client') fail(403, 'This area is the client app'); return u; }
  const seesAll = u => u.role === 'architect' || u.role === 'team_lead';
  const visible = u => db.projects.filter(p => seesAll(u) || p.members.includes(u.id));
  function project(u, id){ const p = visible(u).find(x => x.id === +id); if (!p) fail(404, 'Project not found'); return p; }
  function visibleVisit(u, id){ const v = byId(db.visits, id); if (!v || !visible(u).some(p => p.id === v.project_id)) fail(404, 'Site visit not found'); return v; }

  /* ---------- workflow ---------- */
  const audit = (p, u, action, detail = {}) => db.audit.push({project_id: p.id, actor_id: u ? u.id : null, action, detail, at: now()});
  const step = (p, order) => p.steps.find(s => s.order === order);
  function setStep(p, order, status, u){
    const s = step(p, order); if (s.status === status) return;
    s.status = status;
    if (status === 'completed') s.completed_at = now();
    audit(p, u, {active: 'step.activated', completed: 'step.completed', locked: 'step.locked'}[status], {step: s.name});
  }
  const visitsOf = p => db.visits.filter(v => v.project_id === p.id);
  const submittedVisits = p => visitsOf(p).filter(v => v.status !== 'draft');
  const latest = p => { const vs = submittedVisits(p); return vs[vs.length - 1] || null; };
  const openVisit = p => visitsOf(p).find(v => v.status === 'rework' || v.status === 'draft');
  const engineerOf = p => p.members.map(user).find(u => u && u.role === 'civil_engineer') || null;
  const reviewsOf = v => db.reviews.filter(r => r.visit_id === v.id);
  const mediaOf = v => db.media.filter(m => m.visit_id === v.id);
  const approvedAt = v => { const r = reviewsOf(v).filter(x => x.decision === 'approve').pop(); return r ? r.at : null; };

  /* ---------- notifications (mirror services/notify.py) ---------- */
  function send(users, kind, p, text, actor){
    const seen = new Set();
    users.forEach(u => { if (!u || seen.has(u.id) || (actor && u.id === actor.id)) return; seen.add(u.id);
      db.notifications.push({id: nextId('note'), user_id: u.id, project_id: p.id, kind, text, created_at: now(), read_at: null}); });
  }
  const leads = () => db.users.filter(u => u.role === 'team_lead');
  const architectOf = p => user(p.created_by);

  /* ---------- progress (mirrors services/progress.py) ---------- */
  function deriveProgress(stageName, states){
    const idx = T.stages.findIndex(s => s.name === stageName), stage = T.stages[idx];
    const done = stage.checklist.filter(i => states[i.id] === 'Done').length;
    const total = T.stages.slice(0, idx).reduce((a, s) => a + s.weight, 0) + stage.weight * done / stage.checklist.length;
    return Math.round((total + 1e-9) * 10) / 10;
  }

  /* ---------- validation (mirrors services/validation.py) ---------- */
  function validate(b, media){
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
    const photos = media.filter(m => m.kind === 'photo');
    if (photos.length < T.min_photos) miss.push('photos');
    const tagged = new Set(photos.map(m => m.problem_ref));
    problems.forEach((p, n) => { if (['High', 'Critical'].includes(p.severity) && !tagged.has(n)) miss.push(`problems[${n}].photo`); });
    return [miss, inv];
  }

  /* ---------- red flags (mirror services/red_flags.py) ---------- */
  const RULES = T.red_flag_rules;
  // The office's calendar day (Asia/Kolkata), not UTC: mirrors app/clock.py.
  const businessDate = ms => new Intl.DateTimeFormat('en-CA', {timeZone: T.business_timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms));
  function evaluateFlags(p, at){
    const out = new Set(), today = businessDate(at), W = T.workflow;
    db.problems.filter(x => x.project_id === p.id && x.status === 'open').forEach(x => {
      if (['High', 'Critical'].includes(x.severity)) out.add(`critical_issue|problem-${x.id}`);
      if (x.target_date < today) out.add(`overdue_fix|problem-${x.id}`);
    });
    if (p.legal.status !== 'Approved' && p.legal.expected_date && today > p.legal.expected_date) out.add('legal_delay|project');
    visitsOf(p).forEach(v => {
      if (v.status === 'submitted' && v.submitted_at && at - Date.parse(v.submitted_at) > W.review_sla_hours * 36e5) out.add(`review_overdue|visit-${v.id}`);
      if (v.status !== 'approved' && reviewsOf(v).filter(r => r.decision === 'rework').length >= W.rework_limit) out.add(`repeated_rework|visit-${v.id}`);
    });
    const approvals = visitsOf(p).map(approvedAt).filter(Boolean).sort();
    const since = approvals.length ? approvals[approvals.length - 1] : (step(p, 1).status === 'completed' ? step(p, 1).completed_at : null);
    if (step(p, 2).status === 'active' && since && at - Date.parse(since) > W.visit_interval_days * 864e5) out.add('no_recent_visit|project');
    db.signoffs.filter(r => r.project_id === p.id && r.status === 'sent' && at - Date.parse(r.sent_at) > T.signoff.sla_days * 864e5)
      .forEach(r => out.add(`client_decision_overdue|signoff-${r.id}`));
    return out;
  }
  function syncFlags(p){
    const at = nowMs(), holding = evaluateFlags(p, at), latestFlag = {};
    db.flags.filter(f => f.project_id === p.id).forEach(f => { latestFlag[`${f.rule}|${f.key}`] = f; });
    [...holding].sort().forEach(k => {
      const f = latestFlag[k];
      if (!f || f.condition_ended_at){
        const [rule, key] = k.split('|');
        const nf = {id: nextId('flag'), project_id: p.id, rule, key, raised_at: now(), cleared_at: null, clear_kind: null,
          cleared_by: null, clear_reason: null, condition_ended_at: null};
        db.flags.push(nf);
        audit(p, null, 'red_flag.raised', {rule, key, label: RULES[rule].label});
        send([architectOf(p), ...leads()], 'red_flag', p, `Red flag on ${p.name}: ${RULES[rule].label}.`);
      }
    });
    Object.entries(latestFlag).forEach(([k, f]) => {
      if (holding.has(k) || f.condition_ended_at) return;
      f.condition_ended_at = now();
      if (!f.cleared_at){ f.cleared_at = now(); f.clear_kind = 'auto'; audit(p, null, 'red_flag.cleared', {rule: f.rule, key: f.key, label: RULES[f.rule].label}); }
    });
  }
  const flagOut = f => ({id: f.id, project_id: f.project_id, rule: f.rule, label: RULES[f.rule].label, rank: RULES[f.rule].rank, key: f.key,
    raised_at: f.raised_at, cleared_at: f.cleared_at, clear_kind: f.clear_kind, clear_reason: f.clear_reason, cleared_by: brief(user(f.cleared_by))});

  /* ---------- serializers (mirror schemas.py) ---------- */
  const mediaOut = m => ({id: m.id, kind: m.kind, problem_ref: m.problem_ref, content_type: m.content_type, size: m.size,
    captured_at: m.captured_at, lat: m.lat, lng: m.lng, uploader: brief(user(m.uploader_id))});
  function visitBrief(v){
    if (!v) return null;
    const rw = reviewsOf(v).filter(r => r.decision === 'rework').pop();
    return {id: v.id, status: v.status, submission_count: v.submission_count, computed_progress: v.computed_progress,
      submitted_at: v.submitted_at, rework_comment: rw && v.status === 'rework' ? rw.comment : null};
  }
  function visitOut(v){
    const p = byId(db.projects, v.project_id);
    return {...visitBrief(v), project: {id: p.id, name: p.name, location: p.location}, engineer: brief(user(v.engineer_id)),
      current_stage: v.current_stage, form: v.form, checklist: v.checklist, no_issues: v.no_issues, problems: v.problems,
      media: mediaOf(v).map(mediaOut),
      reviews: reviewsOf(v).map(r => ({decision: r.decision, comment: r.comment, reviewer: brief(user(r.reviewer_id)), at: r.at}))};
  }
  function summary(p){
    const v = latest(p), active = p.steps.find(s => s.status === 'active');
    return {id: p.id, name: p.name, location: p.location, current_step: active ? active.name : null,
      official_progress: p.official_progress, latest_visit_status: v ? v.status : null, civil_engineer: brief(engineerOf(p)),
      ...stageSummary(p)};
  }
  function detail(p){
    const approved = visitsOf(p).filter(v => v.status === 'approved').length;
    return {...summary(p), template: {id: T.id, version: T.version}, steps: p.steps.map(s => ({order: s.order, name: s.name, status: s.status})),
      legal_approval: {...p.legal}, latest_visit: visitBrief(latest(p)),
      approved_visits: approved, visit_number: step(p, 1).status === 'completed' ? approved + 1 : null,
      audit: db.audit.filter(e => e.project_id === p.id).map(e => ({action: e.action, actor: e.actor_id ? (user(e.actor_id) || {}).name : null, at: e.at, detail: e.detail}))};
  }
  function problemOut(x){
    const p = byId(db.projects, x.project_id);
    const photos = db.media.filter(m => m.visit_id === x.visit_id && m.kind === 'photo');
    const photo = photos.find(m => m.problem_ref === x.index) || photos[0];
    return {...x, project: {id: p.id, name: p.name}, resolved_by: brief(user(x.resolved_by)), photo_id: photo ? photo.id : null};
  }
  function queueRows(ids){
    return db.visits.filter(v => v.status === 'submitted' && ids.includes(v.project_id)).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)).map(v => {
      const p = byId(db.projects, v.project_id);
      return {id: v.id, project: {id: p.id, name: p.name, location: p.location}, engineer: brief(user(v.engineer_id)),
        current_stage: v.current_stage, submission_count: v.submission_count, computed_progress: v.computed_progress,
        submitted_at: v.submitted_at, waiting_minutes: Math.max(0, Math.floor((Date.now() - Date.parse(v.submitted_at)) / 6e4))};
    });
  }

  /* ---------- operations (mirror the routers) ---------- */
  function createProject(u, b){
    role(u, 'architect');
    const name = (b.name || '').trim(), location = (b.location || '').trim();
    if (!name || !location) fail(422, 'Project name and location are required');
    const eng = user(+b.civil_engineer_id);
    if (!eng || eng.role !== 'civil_engineer') fail(422, 'civil_engineer_id must be an active Civil Engineer');
    const start = b.start_stage || null, confirmer = (b.historical_confirmed_by || '').trim();
    if (start && (!BYKEY[start] || start === FLOW[0].key)) fail(422, 'start_stage must be a later stage of the residential flow');
    if (start && !confirmer) fail(422, 'historical_confirmed_by is required when start_stage is set');
    const admins = db.users.filter(x => x.role === 'admin').map(x => x.id);
    const p = {id: nextId('project'), name, location, created_by: u.id, official_progress: 0, members: [...new Set([u.id, eng.id, ...admins])],
      steps: T.steps.map((s, i) => ({order: i + 1, name: s, status: i === 0 ? 'active' : 'locked', completed_at: null})),
      legal: {status: 'Not started', authority_name: null, application_reference: null, application_date: null,
        approval_date: null, expected_date: b.legal_expected_date || null, document_reference: null}};
    db.projects.push(p);
    audit(p, u, 'project.created', {civil_engineer_id: eng.id, start_stage: start, historical_confirmed_by: start ? confirmer : null});
    const cut = start ? FLOW.findIndex(x => x.key === start) : 0;
    p.stages = Object.fromEntries(FLOW.map((x, i) => [x.key, {status: i < cut ? 'historical' : 'locked', started_at: null, completed_at: null,
      completed_by: null, note: null, hist_by: i < cut ? confirmer : null, hist_note: i < cut ? 'Completed before SiteFlow.' : null}]));
    releaseStages(p, u);
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
    if (merged.approval_date && merged.application_date && merged.approval_date < merged.application_date) fail(422, 'approval_date cannot be before application_date');
    Object.assign(la, changes, {status: target});
    audit(p, u, 'legal.updated', {from: cur, to: target, fields: Object.keys(changes).sort()});
    if (target === 'Approved'){
      setStep(p, 1, 'completed', u); setStep(p, 2, 'active', u);
      send([engineerOf(p)], 'step_unlocked', p, `Legal Approval is approved on ${p.name}. Site Visit is open.`, u);
    }
    syncFlags(p);
    return p;
  }

  function openDraft(u, pid){
    role(u, 'civil_engineer');
    const p = project(u, pid);
    requireSiteVisitOpen(p);
    let v = openVisit(p);
    if (!v){ v = {id: nextId('visit'), project_id: p.id, engineer_id: u.id, status: 'draft', submission_count: 0, form: {}, checklist: {}, problems: [], no_issues: false, created_at: now()}; db.visits.push(v); }
    return v;
  }

  function submitVisit(u, pid, b){
    role(u, 'civil_engineer');
    const p = project(u, pid);
    requireSiteVisitOpen(p);
    let v = openVisit(p);
    const [missing, invalid] = validate(b, v ? mediaOf(v) : []);
    if (missing.length || invalid.length) fail(422, 'Site visit is incomplete', {missing, invalid});
    if (!v){ v = {id: nextId('visit'), project_id: p.id, submission_count: 0, created_at: now()}; db.visits.push(v); }
    Object.assign(v, {engineer_id: u.id, current_stage: b.current_stage,
      form: {visit_at: b.visit_at, location: b.location, weather: b.weather.trim(), attendees: b.attendees.trim(),
        summary: b.summary.trim(), recommended_action: b.recommended_action.trim()},
      checklist: {...b.checklist}, no_issues: !!b.no_issues, problems: (b.problems || []).map(x => ({...x})),
      computed_progress: deriveProgress(b.current_stage, b.checklist), status: 'submitted',
      submission_count: v.submission_count + 1, submitted_at: now()});
    audit(p, u, 'site_visit.submitted', {submission: v.submission_count, computed_progress: v.computed_progress});
    setStep(p, 2, 'completed', u); setStep(p, 3, 'active', u);
    send(leads(), 'submitted', p, `${u.name} submitted a site visit on ${p.name} for review.`, u);
    syncFlags(p);
    return v;
  }

  function review(u, vid, b){
    role(u, 'team_lead');
    const v = visibleVisit(u, vid);
    if (v.status !== 'submitted') fail(409, `Site visit is ${v.status}, not waiting for review`);
    const comment = (b.comment || '').trim() || null;
    if (!['approve', 'rework'].includes(b.decision)) fail(422, 'Decision must be approve or rework');
    if (b.decision === 'rework' && !comment) fail(422, 'Rework needs a comment for the engineer', {missing: ['comment']});
    const p = byId(db.projects, v.project_id);
    db.reviews.push({id: nextId('review'), visit_id: v.id, reviewer_id: u.id, decision: b.decision, comment, at: now()});
    const d = {submission: v.submission_count, comment};
    if (b.decision === 'approve'){
      v.status = 'approved'; p.official_progress = v.computed_progress;
      audit(p, u, 'site_visit.approved', {...d, official_progress: v.computed_progress});
      v.problems.forEach((x, n) => db.problems.push({id: nextId('problem'), project_id: p.id, visit_id: v.id, index: n, category: x.category,
        problem: x.category === 'Other' ? x.other_text : x.problem, severity: x.severity, location: x.location,
        responsible_party: x.responsible_party, target_date: x.target_date, status: 'open', created_at: now(),
        resolved_at: null, resolved_by: null, resolution_note: null}));
      send([engineerOf(p), architectOf(p)], 'approved', p, `The site visit on ${p.name} is approved. Progress ${v.computed_progress}% is now official.`, u);
      setStep(p, 3, 'completed', u); setStep(p, 2, 'active', u); setStep(p, 3, 'locked', u);
      if (p.stages[CONSTRUCTION_START].status === 'active')
        completeStage(p, CONSTRUCTION_START, u, 'Completed when the first construction visit was approved.');
    } else {
      v.status = 'rework';
      audit(p, u, 'site_visit.rework_requested', d);
      setStep(p, 3, 'locked', u); setStep(p, 2, 'active', u);
      send([engineerOf(p)], 'rework', p, `${u.name} sent the site visit on ${p.name} back for rework: ${comment}`, u);
    }
    syncFlags(p);
    return v;
  }

  function resolveProblem(u, id, note){
    role(u, 'civil_engineer', 'team_lead');
    const x = byId(db.problems, id);
    if (!x || !visible(u).some(p => p.id === x.project_id)) fail(404, 'Problem not found');
    if (x.status === 'resolved') fail(409, 'This problem is already resolved');
    note = (note || '').trim();
    if (!note) fail(422, 'Say how the problem was resolved', {missing: ['note']});
    Object.assign(x, {status: 'resolved', resolved_at: now(), resolved_by: u.id, resolution_note: note});
    const p = byId(db.projects, x.project_id);
    audit(p, u, 'problem.resolved', {problem_id: x.id, problem: x.problem, note});
    syncFlags(p);
    return x;
  }

  function dashboard(u, f){
    const projects = visible(u);
    projects.forEach(syncFlags);
    const open = db.problems.filter(x => x.status === 'open' && projects.some(p => p.id === x.project_id));
    const match = x => (!f.severity || x.severity === f.severity) && (!f.category || x.category === f.category);
    let rows = projects.map(p => {
      const flags = db.flags.filter(x => x.project_id === p.id && !x.cleared_at).map(flagOut).sort((a, b) => b.rank - a.rank || a.raised_at.localeCompare(b.raised_at));
      const last = visitsOf(p).map(approvedAt).filter(Boolean).sort().pop() || null;
      const waiting = db.signoffs.find(r => r.project_id === p.id && r.status === 'sent');
      const client = clientsOf(p)[0];
      return {id: p.id, name: p.name, location: p.location, current_step: summary(p).current_step, official_progress: p.official_progress,
        open_problems: open.filter(x => x.project_id === p.id).length, last_visit_at: last, red_flags: flags.length,
        flag_labels: flags.map(x => x.label), flags, civil_engineer: brief(engineerOf(p)), ...stageSummary(p),
        client: client ? client.name : null,
        waiting_for_client: waiting ? {signoff_id: waiting.id, stage: BYKEY[waiting.stage_key].label, version: waiting.version,
          sent_at: waiting.sent_at, days_waiting: Math.floor((Date.now() - Date.parse(waiting.sent_at)) / 864e5)} : null};
    });
    const has = k => f[k] !== undefined && f[k] !== '';
    rows = rows.filter(r => (!has('q') || r.name.toLowerCase().includes(f.q.toLowerCase()))
      && (!has('location') || r.location.toLowerCase().includes(f.location.toLowerCase()))
      && (!has('step') || r.current_step === f.step)
      && (!has('engineer_id') || (r.civil_engineer && r.civil_engineer.id === +f.engineer_id))
      && (!has('red_flag') || (r.flags.length > 0) === (f.red_flag === 'true'))
      && ((!has('severity') && !has('category')) || open.some(x => x.project_id === r.id && match(x)))
      && (!has('progress_min') || r.official_progress >= +f.progress_min)
      && (!has('progress_max') || r.official_progress <= +f.progress_max)
      && (!has('visit_from') || (r.last_visit_at && businessDate(Date.parse(r.last_visit_at)) >= f.visit_from))
      && (!has('visit_to') || (r.last_visit_at && businessDate(Date.parse(r.last_visit_at)) <= f.visit_to))
      && (!has('phase') || (r.phase && r.phase.number === +f.phase))
      && (!has('client_pending') || (r.waiting_for_client !== null) === (f.client_pending === 'true')));
    const kept = rows.map(r => r.id), order = {Critical: 0, High: 1};
    return {
      all_projects: rows,
      needs_attention: rows.filter(r => r.flags.length).sort((a, b) => b.flags[0].rank - a.flags[0].rank
        || a.flags.map(x => x.raised_at).sort()[0].localeCompare(b.flags.map(x => x.raised_at).sort()[0])),
      major_problems: open.filter(x => kept.includes(x.project_id) && x.severity in order && match(x))
        .sort((a, b) => order[a.severity] - order[b.severity] || a.target_date.localeCompare(b.target_date)).map(problemOut),
      review_queue: queueRows(kept),
      waiting_for_client: rows.filter(r => r.waiting_for_client).sort((a, b) => b.waiting_for_client.days_waiting - a.waiting_for_client.days_waiting)
    };
  }

  /* ---------- stage tracker (mirrors services/stages.py) ---------- */
  const FLOW = T.stage_flow, BYKEY = Object.fromEntries(FLOW.map(x => [x.key, x])), DONE = ['completed', 'historical'];
  const CONSTRUCTION_START = 'line_out', HISTORICAL_LABEL = 'Historical — completed before SiteFlow';
  const STAFF_COMPLETERS = ['architect', 'team_lead'];
  const latestSignoff = (p, key) => db.signoffs.filter(r => r.project_id === p.id && r.stage_key === key).sort((a, b) => a.version - b.version).pop();
  const fmtDay = iso => new Date(iso).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  function gateReasons(p, x){
    if (x.gate === 'legal_approval' && p.legal.status !== 'Approved') return [`Legal Approval is ${p.legal.status}, not Approved`];
    if (x.gate === 'no_open_major_problems'){
      const n = db.problems.filter(q => q.project_id === p.id && q.status === 'open' && ['High', 'Critical'].includes(q.severity)).length;
      if (n) return [`${n} open High or Critical problem${n === 1 ? '' : 's'}`];
    }
    if (x.gate === 'client_signoff'){
      const r = latestSignoff(p, x.key);
      if (!r || r.status === 'draft') return ['Sign-off package not sent to the client yet'];
      if (r.status === 'sent') return [`Waiting for client sign-off on version ${r.version}, sent ${fmtDay(r.sent_at)}`];
      if (r.status === 'changes_requested') return [`The client asked for changes on version ${r.version}; prepare version ${r.version + 1}`];
    }
    return [];
  }
  function evaluateStages(p){
    const out = {};
    FLOW.forEach(x => {
      const st = p.stages[x.key].status;
      if (DONE.includes(st)) out[x.key] = {state: st, reasons: []};
      else if (st === 'locked'){
        const waiting = x.predecessors.filter(k => !DONE.includes(p.stages[k].status)).map(k => BYKEY[k].label);
        out[x.key] = {state: 'locked', reasons: waiting.length ? [`Waiting for: ${waiting.join(', ')}`] : []};
      } else { const reasons = gateReasons(p, x); out[x.key] = {state: reasons.length ? 'blocked' : 'active', reasons}; }
    });
    return out;
  }
  function releaseStages(p, actor){
    FLOW.filter(x => p.stages[x.key].status === 'locked' && x.predecessors.every(k => DONE.includes(p.stages[k].status))).forEach(x => {
      Object.assign(p.stages[x.key], {status: 'active', started_at: now()});
      audit(p, actor, 'stage.activated', {stage: x.label, key: x.key});
      if (x.owner_role !== 'client'){
        const users = x.owner_role === 'team_lead' ? leads() : p.members.map(user).filter(m => m && m.role === x.owner_role);
        send(users, 'stage_ready', p, `${x.label} is open on ${p.name}.`, actor);
      }
    });
  }
  function completeStage(p, key, actor, note){
    Object.assign(p.stages[key], {status: 'completed', completed_at: now(), completed_by: actor ? actor.id : null, note});
    audit(p, actor, 'stage.completed', {stage: BYKEY[key].label, key, note});
    releaseStages(p, actor);
  }
  function stageSummary(p){
    if (!p.stages) return {phase: null, current_stages: [], stage_progress: null};
    const open = FLOW.filter(x => p.stages[x.key].status === 'active');
    const done = FLOW.filter(x => DONE.includes(p.stages[x.key].status)).length;
    const n = open.length ? Math.min(...open.map(x => x.phase)) : (done === FLOW.length ? T.phases[T.phases.length - 1].number : null);
    const phase = T.phases.find(ph => ph.number === n);
    return {phase: phase ? {...phase} : null, current_stages: open.map(x => x.label), stage_progress: {done, total: FLOW.length}};
  }
  function stageView(p, u){
    const view = evaluateStages(p);
    const out = x => {
      const r = p.stages[x.key], v = view[x.key], req = latestSignoff(p, x.key);
      return {key: x.key, number: x.number, label: x.label, detail: x.detail, workstream: x.workstream, owner_role: x.owner_role,
        gate: x.gate, state: v.state, reasons: v.reasons,
        can_complete: v.state === 'active' && x.gate !== 'client_signoff' && (u.role === x.owner_role || STAFF_COMPLETERS.includes(u.role)),
        started_at: r.started_at, completed_at: r.completed_at, completed_by: brief(user(r.completed_by)), completion_note: r.note,
        historical: r.status === 'historical' ? {label: HISTORICAL_LABEL, confirmed_by: r.hist_by, note: r.hist_note} : null,
        signed_by_client: !!(req && req.status === 'approved' && r.status === 'completed')};
    };
    return {phases: T.phases.map(ph => ({...ph, stages: FLOW.filter(x => x.phase === ph.number).map(out)})),
      current_stages: FLOW.filter(x => ['active', 'blocked'].includes(view[x.key].state)).map(x => x.label),
      stage_progress: {done: FLOW.filter(x => DONE.includes(view[x.key].state)).length, total: FLOW.length}};
  }
  function completeStageOp(u, pid, key, note){
    const p = project(u, pid), x = BYKEY[key];
    if (!x) fail(404, 'Stage not found');
    const v = evaluateStages(p)[key];
    if (x.gate === 'client_signoff') fail(409, 'This stage completes when the client approves the sign-off package', {reasons: v.reasons});
    if (u.role !== x.owner_role && !STAFF_COMPLETERS.includes(u.role)) fail(403, 'Your role cannot complete this stage');
    if (v.state !== 'active') fail(409, DONE.includes(v.state) ? 'This stage is already completed' : 'This stage cannot be completed yet', {reasons: v.reasons});
    note = (note || '').trim();
    if (!note) fail(422, 'Add a note on what was completed', {missing: ['note']});
    completeStage(p, key, u, note);
    return stageView(p, u);
  }
  const constructionStarted = p => ['active', 'completed', 'historical'].includes(p.stages[CONSTRUCTION_START].status);
  function requireSiteVisitOpen(p){
    if (!constructionStarted(p)) fail(409, 'Site visits open once Site line-out (stage 14) has started');
    if (step(p, 2).status !== 'active') fail(409, 'Site Visit step is not open for this project');
  }

  /* ---------- clients and invites (mirror routers/invites.py and /auth/activate) ---------- */
  const clientsOf = p => p.members.map(user).filter(m => m && m.role === 'client');
  const clientOut = c => ({id: c.id, name: c.name, email: c.email, status: c.active === false ? 'invited' : 'active'});
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function invite(u, pid, b){
    role(u, 'architect');
    const p = project(u, pid), name = (b.name || '').trim(), email = (b.email || '').trim().toLowerCase();
    if (!name) fail(422, 'name must not be blank');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(422, 'email must be an email address');
    let c = db.users.find(x => x.email === email);
    if (c && c.role !== 'client') fail(409, 'This email belongs to a SiteFlow team member');
    if (!c){ c = {id: nextId('user'), name, email, role: 'client', active: false}; db.users.push(c); }
    if (!p.members.includes(c.id)) p.members.push(c.id);
    let code = null, expires = null;
    if (c.active === false){
      db.invites.filter(i => i.user_id === c.id && !i.used_at).forEach(i => { i.revoked_at = now(); });
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      code = Array.from(bytes, n => ALPHABET[n % ALPHABET.length]).join('');
      expires = new Date(Date.now() + T.signoff.invite_ttl_days * 864e5).toISOString();
      db.invites.push({id: nextId('invite'), user_id: c.id, project_id: p.id, code, expires_at: expires, attempts: 0, used_at: null, revoked_at: null});
    }
    audit(p, u, 'client.invited', {client: c.name, new_code: code !== null});
    return {client: clientOut(c), code, expires_at: expires};
  }
  function activate(email, code, password){
    if (String(password || '').length < 10) fail(422, 'Choose a password of at least 10 characters', {missing: ['password']});
    const invalid = 'This invite code is not valid. Ask your architect for a new one.';
    const c = db.users.find(x => x.email === String(email).trim().toLowerCase() && x.role === 'client');
    const inv = c && db.invites.filter(i => i.user_id === c.id && !i.used_at && !i.revoked_at).pop();
    if (!inv || inv.attempts >= T.signoff.invite_max_attempts || Date.parse(inv.expires_at) < Date.now()) fail(400, invalid);
    if (String(code).trim().toUpperCase() !== inv.code){ inv.attempts += 1; fail(400, invalid); }
    Object.assign(c, {active: true, password});  // demo only: kept in this browser's storage
    inv.used_at = now();
    audit(byId(db.projects, inv.project_id), c, 'client.activated', {});
    store.set(K_TOKEN, String(c.id));
    return {id: c.id, name: c.name, email: c.email, role: c.role};
  }

  /* ---------- sign-off packages (mirror routers/signoffs.py and routers/client.py) ---------- */
  const SIGNOFF_LABEL = key => BYKEY[key].label;
  function signoffOut(r){
    return {id: r.id, project_id: r.project_id, stage_key: r.stage_key, stage: SIGNOFF_LABEL(r.stage_key), version: r.version,
      status: r.status, title: r.title, summary: r.summary, created_by: brief(user(r.created_by)), created_at: r.created_at,
      sent_at: r.sent_at, responded_at: r.responded_at, response_comment: r.response_comment, signer_name: r.signer_name,
      signed_by: brief(user(r.signer_id)), method: r.method, supersedes_id: r.supersedes_id,
      attachments: r.attachments.map(a => ({id: a.id, filename: a.filename, content_type: a.content_type, size: a.size, uploaded_at: a.uploaded_at}))};
  }
  function clientSignoffOut(r, u){
    const viewed = new Set(r.views.filter(v => v.user_id === u.id).map(v => v.attachment_id));
    const p = byId(db.projects, r.project_id);
    return {id: r.id, project: {id: p.id, name: p.name}, stage_key: r.stage_key, stage: SIGNOFF_LABEL(r.stage_key), version: r.version,
      status: r.status, title: r.title, summary: r.summary, sent_at: r.sent_at, responded_at: r.responded_at,
      response_comment: r.response_comment, signer_name: r.signer_name, confirmation_text: T.signoff.confirmation_text,
      can_respond: r.status === 'sent',
      attachments: r.attachments.map(a => ({id: a.id, filename: a.filename, content_type: a.content_type, size: a.size,
        uploaded_at: a.uploaded_at, viewed: viewed.has(a.id)}))};
  }
  function editableSignoff(u, id){
    role(u, 'architect');
    const r = byId(db.signoffs, id);
    if (!r || !visible(u).some(p => p.id === r.project_id)) fail(404, 'Sign-off not found');
    if (r.status !== 'draft') fail(409, `Version ${r.version} was ${r.status} and can no longer change`);
    return r;
  }
  function createSignoff(u, pid, b){
    role(u, 'architect');
    const p = project(u, pid);
    if (!BYKEY[b.stage_key] || BYKEY[b.stage_key].gate !== 'client_signoff') fail(422, 'stage_key must be a client sign-off stage');
    if (p.stages[b.stage_key].status !== 'active') fail(409, `${SIGNOFF_LABEL(b.stage_key)} is not open yet`);
    const history = db.signoffs.filter(r => r.project_id === p.id && r.stage_key === b.stage_key);
    if (history.some(r => ['draft', 'sent'].includes(r.status))) fail(409, 'This stage already has a package in progress');
    const title = (b.title || '').trim(), summary = (b.summary || '').trim();
    if (!title || !summary) fail(422, 'title and summary must not be blank');
    const prev = history.sort((a, c) => a.version - c.version).pop();
    const r = {id: nextId('signoff'), project_id: p.id, stage_key: b.stage_key, version: prev ? prev.version + 1 : 1, status: 'draft',
      title, summary, created_by: u.id, created_at: now(), sent_at: null, responded_at: null, response_comment: null,
      signer_id: null, signer_name: null, method: null, supersedes_id: prev ? prev.id : null, attachments: [], views: []};
    db.signoffs.push(r);
    audit(p, u, 'signoff.created', {stage: SIGNOFF_LABEL(r.stage_key), version: r.version});
    return r;
  }
  function sendSignoff(u, id){
    const r = editableSignoff(u, id), p = byId(db.projects, r.project_id);
    const missing = [...(r.attachments.length ? [] : ['attachments']), ...(clientsOf(p).length ? [] : ['client'])];
    if (missing.length) fail(422, 'Add at least one document and invite the client before sending', {missing});
    Object.assign(r, {status: 'sent', sent_at: now()});
    audit(p, u, 'signoff.sent', {stage: SIGNOFF_LABEL(r.stage_key), version: r.version});
    send(clientsOf(p), 'signoff_requested', p, `Please review and sign off: ${SIGNOFF_LABEL(r.stage_key)} (version ${r.version}) on ${p.name}.`, u);
    syncFlags(p);
    return r;
  }
  const myProjectIds = u => db.projects.filter(p => p.members.includes(u.id)).map(p => p.id);
  function myRequest(u, id){
    const r = byId(db.signoffs, id);
    if (!r || r.status === 'draft' || !myProjectIds(u).includes(r.project_id)) fail(404, 'Sign-off not found');
    return r;
  }
  const norm = n => String(n || '').replace(/\s+/g, ' ').trim().toLowerCase();
  function approveSignoff(u, id, name){
    const r = myRequest(u, id), p = byId(db.projects, r.project_id);
    if (r.status !== 'sent') fail(409, `Version ${r.version} has already been answered`);
    const viewed = new Set(r.views.filter(v => v.user_id === u.id).map(v => v.attachment_id));
    const unviewed = r.attachments.filter(a => !viewed.has(a.id)).map(a => a.filename);
    const invalid = norm(name) && norm(name) === norm(u.name) ? [] : ['signer_name'];
    if (unviewed.length || invalid.length) fail(422, 'Open every document, tick the confirmation and type your full name to sign off',
      {missing: unviewed.length ? ['attachments'] : [], invalid, unviewed});
    Object.assign(r, {status: 'approved', responded_at: now(), signer_id: u.id, signer_name: String(name).trim(), method: 'client_app'});
    audit(p, u, 'signoff.approved', {stage: SIGNOFF_LABEL(r.stage_key), version: r.version, signer: r.signer_name});
    completeStage(p, r.stage_key, u, `Signed off by ${r.signer_name} in the client app (version ${r.version}).`);
    send([architectOf(p), ...leads()], 'signoff_answered', p, `${r.signer_name} signed off ${SIGNOFF_LABEL(r.stage_key)} (version ${r.version}) on ${p.name}.`, u);
    syncFlags(p);
    return r;
  }
  function requestChanges(u, id, comment){
    const r = myRequest(u, id), p = byId(db.projects, r.project_id);
    if (r.status !== 'sent') fail(409, `Version ${r.version} has already been answered`);
    comment = (comment || '').trim();
    if (!comment) fail(422, 'Say what should change', {missing: ['comment']});
    Object.assign(r, {status: 'changes_requested', responded_at: now(), signer_id: u.id, response_comment: comment, method: 'client_app'});
    audit(p, u, 'signoff.changes_requested', {stage: SIGNOFF_LABEL(r.stage_key), version: r.version, comment});
    send([architectOf(p), ...leads()], 'signoff_answered', p, `${u.name} asked for changes on ${SIGNOFF_LABEL(r.stage_key)} (version ${r.version}) on ${p.name}: ${comment}`, u);
    syncFlags(p);
    return r;
  }
  const fileAsDataUrl = file => new Promise((resolve, reject) => {
    const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => reject(new ApiError(415, 'The file could not be read')); fr.readAsDataURL(file);
  });

  /* ---------- the client's view (mirrors services/client_view.py: allow-listed fields only) ---------- */
  const CLIENT_STATE = {completed: 'completed', historical: 'historical', active: 'in_progress', locked: 'upcoming'};
  function clientCard(p){
    const st = stageSummary(p);
    return {id: p.id, name: p.name, location: p.location, phase: st.phase, current_stages: st.current_stages,
      stage_progress: st.stage_progress, official_progress: p.official_progress,
      waiting_for_you: db.signoffs.filter(r => r.project_id === p.id && r.status === 'sent').length};
  }
  function clientDetail(p, u){
    const shared = db.signoffs.filter(r => r.project_id === p.id && r.status !== 'draft');
    const approved = Object.fromEntries(shared.filter(r => r.status === 'approved').map(r => [r.stage_key, r]));
    return {...clientCard(p),
      phases: T.phases.map(ph => ({number: ph.number, name: ph.name, stages: FLOW.filter(x => x.phase === ph.number).map(x => {
        const r = p.stages[x.key], signed = r.status === 'completed' ? approved[x.key] : null;
        return {key: x.key, number: x.number, label: x.label, detail: x.detail, workstream: x.workstream, state: CLIENT_STATE[r.status],
          is_signoff: x.gate === 'client_signoff', started_at: r.started_at, completed_at: r.completed_at,
          historical: r.status === 'historical' ? 'Completed before SiteFlow' : null,
          signed: signed ? {by: signed.signer_name, at: signed.responded_at, version: signed.version} : null};
      })})),
      signoffs: shared.map(r => clientSignoffOut(r, u)),
      shared_updates: db.updates.filter(x => x.project_id === p.id).slice().reverse().map(x => ({id: x.id, note: x.note, shared_at: x.created_at,
        stage: (byId(db.visits, x.visit_id) || {}).current_stage || null,
        photos: x.photo_ids.map(mid => ({id: mid, captured_at: (byId(db.media, mid) || {}).captured_at || null}))}))};
  }

  /* ---------- shared site updates (mirror routers/updates.py) ---------- */
  function shareUpdate(u, vid, note, ids){
    role(u, 'architect', 'team_lead');
    const v = visibleVisit(u, vid);
    if (v.status !== 'approved') fail(409, 'Only approved visits can be shared with the client');
    note = (note || '').trim();
    const photos = mediaOf(v).filter(m => m.kind === 'photo').map(m => m.id);
    const invalid = (ids || []).filter(i => !photos.includes(i)).map(i => `media_ids.${i}`);
    if (!note || invalid.length) fail(422, 'Write a note, and pick photos from this visit only', {missing: note ? [] : ['note'], invalid});
    const p = byId(db.projects, v.project_id);
    const x = {id: nextId('update'), project_id: p.id, visit_id: v.id, note, shared_by: u.id, created_at: now(), photo_ids: [...new Set(ids || [])]};
    db.updates.push(x);
    audit(p, u, 'update.shared', {visit_id: v.id, photos: x.photo_ids.length});
    send(clientsOf(p), 'update_shared', p, `Your architect shared a site update on ${p.name}.`, u);
    return {id: x.id, visit_id: x.visit_id, note: x.note, shared_at: x.created_at, shared_by: brief(u), photo_ids: x.photo_ids};
  }

  /* ---------- sample elevations for the design-freeze sign-off ---------- */
  function sampleElevation(title, seed){
    const c = document.createElement('canvas'); c.width = 640; c.height = 420; const g = c.getContext('2d');
    g.fillStyle = '#f7f6f1'; g.fillRect(0, 0, 640, 420);
    g.strokeStyle = '#2b3a3f'; g.lineWidth = 2;
    g.strokeRect(80, 120, 480, 220); g.strokeRect(80, 60 + seed * 6, 480, 60 - seed * 6);
    for (let i = 0; i < 4; i++) g.strokeRect(120 + i * 110, 170, 60, 80);
    g.strokeRect(290, 260, 60, 80);
    g.beginPath(); g.moveTo(40, 340); g.lineTo(600, 340); g.stroke();
    g.fillStyle = '#2b3a3f'; g.font = 'bold 18px ui-sans-serif, system-ui'; g.fillText(title, 40, 385);
    g.font = '12px ui-monospace, monospace'; g.fillText('Scale 1:100 · Sample drawing for the SiteFlow demo', 40, 405);
    return c.toDataURL('image/jpeg', 0.7);
  }

  /* ---------- media: photos shrunk to small JPEGs so the demo fits in browser storage ---------- */
  const readAsImage = file => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const scale = Math.min(1, 800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.6)); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new ApiError(415, `The file is not a valid ${file.type}`)); };
    img.src = url;
  });

  /* ---------- sample photos, drawn on a canvas ---------- */
  function samplePhoto(seed, label){
    const c = document.createElement('canvas'); c.width = 480; c.height = 360; const g = c.getContext('2d');
    let r = seed * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const sky = g.createLinearGradient(0, 0, 0, 220); sky.addColorStop(0, `hsl(${200 + rnd() * 15},55%,${62 + rnd() * 10}%)`); sky.addColorStop(1, '#e9eef0');
    g.fillStyle = sky; g.fillRect(0, 0, 480, 360);
    g.fillStyle = `hsl(${28 + rnd() * 10},30%,${44 + rnd() * 8}%)`; g.fillRect(0, 240, 480, 120);
    for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++){
      const w = 90 + rnd() * 120, h = 60 + rnd() * 140, x = rnd() * 400 - 20, y = 250 - h;
      g.fillStyle = `hsl(30,6%,${58 + rnd() * 18}%)`; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(60,60,60,.45)'; for (let yy = y; yy < y + h; yy += 24) g.fillRect(x - 4, yy, w + 8, 3);
      g.fillStyle = 'rgba(40,40,40,.6)'; for (let xx = x + 8; xx < x + w - 8; xx += 30) g.fillRect(xx, y - 18, 3, 18);
    }
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 330, 480, 30);
    g.fillStyle = '#fff'; g.font = '14px ui-monospace, monospace'; g.fillText(label, 10, 350);
    return c.toDataURL('image/jpeg', 0.6);
  }
  function addPhotos(v, u, refs, gps){
    for (let i = 0; i < Math.max(T.min_photos, refs.length); i++){
      const ref = i < refs.length ? refs[i] : null;
      const data = samplePhoto(v.id * 10 + i, `${new Date(nowMs()).toLocaleDateString('en-IN')}  ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`);
      db.media.push({id: nextId('media'), visit_id: v.id, kind: 'photo', problem_ref: ref, content_type: 'image/jpeg', size: Math.round(data.length * 0.75),
        data, captured_at: now(), lat: gps.lat, lng: gps.lng, uploader_id: u.id});
    }
  }

  /* ---------- sample data ---------- */
  function seed(){
    db = {v: 3, seq: {user: 6}, users: [
      {id: 1, name: 'Meera Joshi', email: 'architect@siteflow.demo', role: 'architect'},
      {id: 2, name: 'Parvez', email: 'parvez@siteflow.demo', role: 'team_lead'},
      {id: 3, name: 'Farhan Shaikh', email: 'engineer@siteflow.demo', role: 'civil_engineer'},
      {id: 4, name: 'Office Coordinator', email: 'admin@siteflow.demo', role: 'admin'},
      {id: 5, name: 'Mr. Gokhale', email: 'gokhale@siteflow.demo', role: 'client'},
      {id: 6, name: 'Mrs. Kapoor', email: 'kapoor@siteflow.demo', role: 'client'}
    ], projects: [], visits: [], reviews: [], audit: [], media: [], problems: [], flags: [], notifications: [],
      signoffs: [], invites: [], updates: []};
    const [arch, lead, eng, admin, gokhale, kapoor] = db.users;
    const at = days => { clockOffset = days * 864e5; };
    const onboard = {start_stage: 'line_out', historical_confirmed_by: 'Parvez'};
    const applied = (p, d, ref) => { at(d); updateLegal(admin, p.id, {status: 'Applied', authority_name: 'Pune Municipal Corporation', application_reference: ref, application_date: ymd(d)}); };
    const approved = (p, d, ref) => { at(d); updateLegal(admin, p.id, {status: 'Approved', approval_date: ymd(d), document_reference: `PMC building permission ${ref}.pdf`}); };
    const states = (stage, done) => Object.fromEntries(T.stages.find(x => x.name === stage).checklist.map((i, k) => [i.id, k < done ? 'Done' : k === done ? 'In progress' : 'Not started']));
    const visitBody = (stage, done, extra) => ({visit_at: now(), location: {gps: extra.gps, manual: extra.where}, weather: extra.weather,
      attendees: 'Farhan Shaikh (Civil Engineer), site contractor', current_stage: stage, checklist: states(stage, done),
      no_issues: !extra.problems, problems: extra.problems || [], summary: extra.summary, recommended_action: extra.action});
    const photograph = (p, problems, gps) => {
      const v = openDraft(eng, p.id);
      if (!mediaOf(v).length) addPhotos(v, eng, (problems || []).map((x, n) => ['High', 'Critical'].includes(x.severity) ? n : null).filter(n => n !== null), gps);
    };

    // 1. At the design freeze: all elevations sent to Mr. Gokhale; the authority is late (Legal delay).
    at(30); let p = createProject(arch, {name: 'Gokhale Residence', location: 'Plot 14, Baner Road, Pune', civil_engineer_id: eng.id,
      legal_expected_date: ymd(3), start_stage: 'design_freeze_signoff', historical_confirmed_by: 'Parvez'});
    p.members.push(gokhale.id);
    applied(p, 18, 'PMC/BP/2026/0142');
    at(2); let so = createSignoff(arch, p.id, {stage_key: 'design_freeze_signoff', title: 'All elevations, version 1',
      summary: 'Front, rear and both side elevations with materials: exposed brick plinth, white plaster above, teak window frames.'});
    ['Front elevation', 'Rear elevation', 'Side elevations'].forEach((t, i) => {
      const data = sampleElevation(t, i);
      so.attachments.push({id: nextId('attachment'), filename: `${t}.jpg`, content_type: 'image/jpeg', size: Math.round(data.length * 0.75), data, uploaded_at: now()});
    });
    sendSignoff(arch, so.id);

    // 2. In construction with Legal Approval: ready for the first site visit.
    at(14); p = createProject(arch, {name: 'Patil Villa', location: 'Survey No. 52, Aundh, Pune', civil_engineer_id: eng.id, legal_expected_date: ymd(0), ...onboard});
    applied(p, 12, 'PMC/BP/2026/0098'); approved(p, 2, 'PMC/BP/2026/0098');

    // 3. Site visit submitted, waiting for Parvez.
    at(40); p = createProject(arch, {name: 'Deshmukh Residence', location: 'Karve Road, Kothrud, Pune', civil_engineer_id: eng.id, legal_expected_date: ymd(20), ...onboard});
    applied(p, 38, 'PMC/BP/2026/0051'); approved(p, 25, 'PMC/BP/2026/0051');
    at(0.3);
    const kothrud = {lat: 18.50741, lng: 73.80772};
    const honeycomb = [{category: 'Structural', problem: 'Honeycombing in concrete', other_text: null, severity: 'High', location: 'Column C4, ground floor',
      responsible_party: 'Structural contractor', target_date: ymd(-7)},
    {category: 'Safety', problem: 'Missing barricading', other_text: null, severity: 'Medium', location: 'Road-side edge of slab',
      responsible_party: 'Site supervisor', target_date: ymd(-2)}];
    photograph(p, honeycomb, kothrud);
    submitVisit(eng, p.id, visitBody('Superstructure', 2, {where: 'Karve Road site, rear block', weather: 'Humid, overcast', gps: kothrud, problems: honeycomb,
      summary: 'Columns and beams cast for the ground floor. Honeycombing found at column C4.',
      action: 'Structural engineer to inspect C4 before the first-floor slab is poured.'}));

    // 4. Two approved visits; the second reports a Critical crack (Critical issue). Mrs. Kapoor gets a shared update.
    at(70); p = createProject(arch, {name: 'Kapoor House', location: 'ITI Road, Aundh, Pune', civil_engineer_id: eng.id, legal_expected_date: ymd(50), ...onboard});
    p.members.push(kapoor.id);
    applied(p, 68, 'PMC/BP/2026/0017'); approved(p, 55, 'PMC/BP/2026/0017');
    const aundh = {lat: 18.56187, lng: 73.80734};
    at(24); photograph(p, null, aundh);
    let v = submitVisit(eng, p.id, visitBody('Masonry', 1, {where: 'ITI Road plot, Aundh', weather: 'Clear', gps: aundh,
      summary: 'External walls built. Partitions under way.', action: 'Continue partitions; cast lintels next week.'}));
    at(23); review(lead, v.id, {decision: 'rework', comment: 'Please confirm the lintel status; it was cast last week per the contractor.'});
    at(22); v = submitVisit(eng, p.id, visitBody('Masonry', 2, {where: 'ITI Road plot, Aundh', weather: 'Clear', gps: aundh,
      summary: 'External walls and partitions complete. Lintels in progress.', action: 'Cast remaining lintels; start internal plaster.'}));
    at(21); review(lead, v.id, {decision: 'approve'});
    at(20); shareUpdate(arch, v.id, 'External walls and partitions are complete. Lintels are next, then internal plaster.',
      mediaOf(v).filter(m => m.kind === 'photo').slice(0, 2).map(m => m.id));
    const crack = [{category: 'Structural', problem: 'Crack in beam, column or slab', other_text: null, severity: 'Critical',
      location: 'Lintel over the east window', responsible_party: 'Masonry contractor', target_date: ymd(-10)}];
    at(8); photograph(p, crack, aundh);
    v = submitVisit(eng, p.id, visitBody('Plastering', 1, {where: 'ITI Road plot, Aundh', weather: 'Clear', gps: aundh, problems: crack,
      summary: 'Internal plaster done. A crack has opened over the east window lintel.', action: 'Stop external plaster on the east wall until the lintel is checked.'}));
    at(7); review(lead, v.id, {decision: 'approve'});

    // 5. Early design: the Site and Studio pre-design branches running in parallel.
    at(9); createProject(arch, {name: 'Sathe House', location: 'Pashan, Pune', civil_engineer_id: eng.id, legal_expected_date: ymd(-60),
      start_stage: 'predesign_site_visit', historical_confirmed_by: 'Parvez'});

    clockOffset = 0;
    db.projects.forEach(syncFlags);
    db.notifications.forEach(n => { n.read_at = n.created_at; });  // sample history reads as seen
    db.notifications.filter(n => n.kind === 'signoff_requested').forEach(n => { n.read_at = null; });  // Mr. Gokhale's is new
    save();
  }

  /* ---------- public interface (same as api.js) ---------- */
  const clone = x => JSON.parse(JSON.stringify(x));
  const run = fn => new Promise((resolve, reject) => {
    setTimeout(() => {
      try { load(); const out = fn(); save(); resolve(out === undefined ? null : clone(out)); }
      catch (e) { if (e instanceof ApiError) reject(e); else { console.error(e); reject(new ApiError(500, 'Something went wrong in the demo. Reset the demo data and try again.')); } }
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
      {email: 'parvez@siteflow.demo', label: 'Parvez', role: 'Team Lead'},
      {email: 'gokhale@siteflow.demo', label: 'Mr. Gokhale', role: 'Client'}
    ],
    resetDemo(){ store.set(K_DB, null); load(); },
    login: (email, password) => run(() => {
      const u = db.users.find(x => x.email === String(email).trim().toLowerCase());
      if (!u || u.active === false || password !== (u.password || PASSWORD)) fail(401, 'Incorrect email or password');
      store.set(K_TOKEN, String(u.id));
      return {id: u.id, name: u.name, email: u.email, role: u.role};
    }),
    logout(){ store.set(K_TOKEN, null); },
    me: () => run(() => { const u = current(); return {id: u.id, name: u.name, email: u.email, role: u.role}; }),
    template: () => run(() => T),
    projects: () => run(() => visible(staff()).map(summary)),
    project: id => run(() => detail(project(staff(), id))),
    createProject: body => run(() => detail(createProject(staff(), body))),
    engineers: () => run(() => { role(staff(), 'architect'); return db.users.filter(u => u.role === 'civil_engineer').map(brief); }),
    updateLegal: (id, body) => run(() => detail(updateLegal(staff(), id, body))),
    submitVisit: (id, body) => run(() => visitOut(submitVisit(staff(), id, body))),
    visit: id => run(() => visitOut(visibleVisit(staff(), id))),
    visits: pid => run(() => submittedVisits(project(staff(), pid)).slice().reverse().map(v => ({id: v.id, status: v.status,
      current_stage: v.current_stage, computed_progress: v.computed_progress, submission_count: v.submission_count,
      submitted_at: v.submitted_at, approved_at: approvedAt(v), engineer: brief(user(v.engineer_id))}))),
    reviewQueue: () => run(() => { const u = staff(); role(u, 'team_lead'); return queueRows(visible(u).map(p => p.id)); }),
    review: (id, body) => run(() => visitOut(review(staff(), id, body))),
    dashboard: filters => run(() => dashboard(staff(), filters || {})),
    clearFlag: (id, reason) => run(() => {
      const u = staff(); role(u, 'team_lead');
      const f = byId(db.flags, id); if (!f) fail(404, 'Red flag not found');
      if (f.cleared_at) fail(409, 'This red flag is already cleared');
      reason = (reason || '').trim(); if (!reason) fail(422, 'Give a reason for clearing this red flag', {missing: ['reason']});
      Object.assign(f, {cleared_at: now(), clear_kind: 'manual', cleared_by: u.id, clear_reason: reason});
      audit(byId(db.projects, f.project_id), u, 'red_flag.cleared_manually', {rule: f.rule, key: f.key, label: RULES[f.rule].label, reason});
      return flagOut(f);
    }),
    notifications: () => run(() => {
      const u = current(), mine = db.notifications.filter(n => n.user_id === u.id);
      return {unread: mine.filter(n => !n.read_at).length, items: mine.slice().reverse().slice(0, 50).map(n => {
        const p = byId(db.projects, n.project_id);
        return {id: n.id, kind: n.kind, text: n.text, project: p ? {id: p.id, name: p.name} : null, created_at: n.created_at, read_at: n.read_at};
      })};
    }),
    readNotification: id => run(() => { const u = current(), n = byId(db.notifications, id); if (!n || n.user_id !== u.id) fail(404, 'Notification not found'); n.read_at = n.read_at || now(); return n; }),
    readAllNotifications: () => run(() => { const u = current(); db.notifications.filter(n => n.user_id === u.id && !n.read_at).forEach(n => { n.read_at = now(); }); return {unread: 0}; }),
    problems: pid => run(() => db.problems.filter(x => x.project_id === project(staff(), pid).id).map(problemOut)),
    resolveProblem: (id, note) => run(() => problemOut(resolveProblem(staff(), id, note))),
    stages: pid => run(() => { const u = staff(); return stageView(project(u, pid), u); }),
    completeStage: (pid, key, note) => run(() => completeStageOp(staff(), pid, key, note)),
    projectClients: pid => run(() => clientsOf(project(staff(), pid)).map(clientOut)),
    inviteClient: (pid, name, email) => run(() => invite(staff(), pid, {name, email})),
    activate: (email, code, password) => run(() => activate(email, code, password)),
    signoffs: pid => run(() => { const p = project(staff(), pid);
      return db.signoffs.filter(r => r.project_id === p.id).sort((a, b) => a.stage_key.localeCompare(b.stage_key) || a.version - b.version).map(signoffOut); }),
    createSignoff: (pid, body) => run(() => signoffOut(createSignoff(staff(), pid, body))),
    sendSignoff: id => run(() => signoffOut(sendSignoff(staff(), id))),
    removeSignoffAttachment: (id, aid) => run(() => { const u = staff(), r = editableSignoff(u, id);
      r.attachments = r.attachments.filter(a => a.id !== +aid);
      audit(byId(db.projects, r.project_id), u, 'signoff.attachment_removed', {version: r.version, filename: 'document'}); }),
    async uploadSignoffAttachment(id, file){
      if (!T.signoff.attachment_types.includes(file.type)) throw new ApiError(415, 'Attach a PDF, JPEG, PNG or WEBP file');
      // The demo keeps files in browser storage, so it holds them to 2 MB each.
      const limit = Math.min(T.signoff.max_attachment_mb, 2) * 1048576;
      if (file.size > limit) throw new ApiError(413, `In the demo a document can be at most ${limit / 1048576} MB`);
      const data = file.type === 'application/pdf' ? await fileAsDataUrl(file) : await readAsImage(file);
      return run(() => {
        const u = staff(), r = editableSignoff(u, id);
        const a = {id: nextId('attachment'), filename: String(file.name || 'document').split(/[\/]/).pop().slice(0, 120),
          content_type: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg', size: file.size, data, uploaded_at: now()};
        r.attachments.push(a);
        audit(byId(db.projects, r.project_id), u, 'signoff.attachment_added', {version: r.version, filename: a.filename});
        return {id: a.id, filename: a.filename, content_type: a.content_type, size: a.size, uploaded_at: a.uploaded_at};
      });
    },
    sharedUpdates: pid => run(() => { const p = project(staff(), pid);
      return db.updates.filter(x => x.project_id === p.id).slice().reverse().map(x => ({id: x.id, visit_id: x.visit_id, note: x.note,
        shared_at: x.created_at, shared_by: brief(user(x.shared_by)), photo_ids: x.photo_ids})); }),
    shareUpdate: (vid, note, ids) => run(() => shareUpdate(staff(), vid, note, ids)),

    /* ---------- customer app ---------- */
    clientProjects: () => run(() => { const u = clientUser(); return db.projects.filter(p => p.members.includes(u.id)).map(clientCard); }),
    clientProject: id => run(() => { const u = clientUser(), p = byId(db.projects, id);
      if (!p || !p.members.includes(u.id)) fail(404, 'Project not found'); return clientDetail(p, u); }),
    clientSignoff: id => run(() => { const u = clientUser(); return clientSignoffOut(myRequest(u, id), u); }),
    approveSignoff: (id, name) => run(() => { const u = clientUser(); return clientSignoffOut(approveSignoff(u, id, name), u); }),
    requestChanges: (id, comment) => run(() => { const u = clientUser(); return clientSignoffOut(requestChanges(u, id, comment), u); }),
    // Opening a document is what records the client's review of it.
    clientDocumentUrl: (sid, aid) => run(() => {
      const u = clientUser(), r = myRequest(u, sid), a = r.attachments.find(x => x.id === +aid);
      if (!a) fail(404, 'Document not found');
      if (!r.views.some(v => v.user_id === u.id && v.attachment_id === a.id)) r.views.push({attachment_id: a.id, user_id: u.id, viewed_at: now()});
      return a.data;
    }),
    clientUpdatePhotoUrl: (uid, mid) => run(() => {
      const u = clientUser(), x = byId(db.updates, uid);
      if (!x || !myProjectIds(u).includes(x.project_id) || !x.photo_ids.includes(+mid)) fail(404, 'Photo not found');
      return (byId(db.media, mid) || {}).data;
    }),
    openDraft: pid => run(() => visitOut(openDraft(staff(), pid))),
    async uploadMedia(visitId, file, meta, onProgress){
      const kind = meta.kind, types = kind === 'photo' ? T.photo_types : T.video_types;
      if (!types.includes(file.type)) throw new ApiError(415, `A ${kind} must be one of: ${types.join(', ')}`);
      const limit = (kind === 'photo' ? T.max_photo_mb : T.max_video_mb) * 1048576;
      if (file.size > limit) throw new ApiError(413, `A ${kind} can be at most ${limit / 1048576} MB`);
      const data = kind === 'photo' ? await readAsImage(file) : null;
      if (onProgress) onProgress(1);
      return run(() => {
        const u = current(); role(u, 'civil_engineer');
        const v = visibleVisit(u, visitId);
        if (!['draft', 'rework'].includes(v.status)) fail(409, `Media can't be added to a ${v.status} visit`);
        const m = {id: nextId('media'), visit_id: v.id, kind, problem_ref: meta.problem_ref ?? null, content_type: kind === 'photo' ? 'image/jpeg' : file.type,
          size: file.size, data, captured_at: meta.captured_at || now(), lat: meta.lat ?? null, lng: meta.lng ?? null, uploader_id: u.id};
        db.media.push(m);
        if (kind === 'video') sessionFiles[m.id] = URL.createObjectURL(file);
        audit(byId(db.projects, v.project_id), u, 'media.added', {visit_id: v.id, kind, problem_ref: m.problem_ref});
        return mediaOut(m);
      });
    },
    deleteMedia: id => run(() => {
      const u = current(), m = byId(db.media, id); if (!m) fail(404, 'Media not found');
      const v = visibleVisit(u, m.visit_id);
      if (m.uploader_id !== u.id) fail(403, 'Only the person who added it can remove it');
      if (!['draft', 'rework'].includes(v.status)) fail(409, `Media can't be removed from a ${v.status} visit`);
      db.media = db.media.filter(x => x.id !== m.id);
      audit(byId(db.projects, v.project_id), u, 'media.removed', {visit_id: v.id, kind: m.kind, problem_ref: m.problem_ref});
    }),
    retagMedia: (id, problem_ref) => run(() => {
      const u = current(), m = byId(db.media, id); if (!m) fail(404, 'Media not found');
      const v = visibleVisit(u, m.visit_id);
      if (m.uploader_id !== u.id) fail(403, 'Only the person who added it can change it');
      if (!['draft', 'rework'].includes(v.status)) fail(409, `Media on a ${v.status} visit can't change`);
      m.problem_ref = problem_ref; return mediaOut(m);
    }),
    async mediaUrl(id){
      if (sessionFiles[id]) return sessionFiles[id];
      load(); staff();
      const m = byId(db.media, id);
      if (!m) throw new ApiError(404, 'Media not found');
      return m.data || samplePhoto(id, 'Video from an earlier session');
    }
  };
})();
