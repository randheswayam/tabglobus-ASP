/* ---------- SiteFlow API client ---------- */
/* exported SiteFlowAPI */
const SiteFlowAPI = (() => {
  'use strict';
  const K_BASE = 'siteflow.api', K_TOKEN = 'siteflow.token', K_REFRESH = 'siteflow.refresh';
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v){ try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
  };
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  // ?api=http://host:port overrides the server (kept for next launches), e.g. a phone on the office Wi-Fi.
  const qp = new URLSearchParams(location.search).get('api');
  if (qp && /^https?:\/\//i.test(qp)) store.set(K_BASE, qp.replace(/\/+$/, ''));

  function defaultBase(){
    if (native) return 'http://10.0.2.2:8000';  // Android emulator's route to the host machine
    if (/^https?:$/.test(location.protocol)) return `${location.protocol}//${location.hostname}:8000`;
    return 'http://localhost:8000';
  }
  const base = () => store.get(K_BASE) || defaultBase();
  const token = () => store.get(K_TOKEN);
  let onSignedOut = null;
  const mediaUrls = {};

  class ApiError extends Error {
    constructor(status, message, detail){ super(message); this.status = status; this.detail = detail; }
    get missing(){ return (this.detail && this.detail.missing) || []; }
    get invalid(){ return (this.detail && this.detail.invalid) || []; }
  }

  function messageOf(data, status){
    const d = data && data.detail;
    if (typeof d === 'string') return d;
    if (d && d.message) return d.message;
    if (Array.isArray(d) && d.length) return 'Check these fields: ' + d.map(e => (e.loc || []).slice(1).join('.')).join(', ');
    return status ? `Request failed (${status})` : 'Request failed';
  }

  function saveTokens(r){ store.set(K_TOKEN, r.access_token); store.set(K_REFRESH, r.refresh_token); }
  function signedOut(){ store.set(K_TOKEN, null); store.set(K_REFRESH, null); if (onSignedOut) onSignedOut(); }

  // One refresh at a time: requests that fail together wait for the same new token.
  let refreshing = null;
  function renew(){
    const rt = store.get(K_REFRESH);
    if (!rt) return Promise.resolve(false);
    if (!refreshing){
      refreshing = fetch(base() + '/auth/refresh', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({refresh_token: rt})})
        .then(async r => { if (!r.ok) return false; saveTokens(await r.json()); return true; })
        .catch(() => false)
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  // fetch with the access token; on 401, renew the session once and retry, else sign out.
  async function authFetch(url, opts = {}){
    const go = () => {
      const headers = {...(opts.headers || {})}, t = token();
      if (t) headers.Authorization = 'Bearer ' + t;
      return fetch(url, {...opts, headers});
    };
    let r = await go();
    if (r.status === 401 && token()){
      if (await renew()) r = await go();
      if (r.status === 401) signedOut();
    }
    return r;
  }

  async function request(method, path, body){
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let r;
    try { r = await authFetch(base() + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)}); }
    catch (_) { throw new ApiError(0, `Cannot reach the SiteFlow server at ${base()}. Check your connection.`); }
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, messageOf(data, r.status), data && data.detail);
    return data;
  }

  async function requestForm(path, form){
    let r;
    try { r = await authFetch(base() + path, {method: 'POST', body: form}); }
    catch (_) { throw new ApiError(0, `Cannot reach the SiteFlow server at ${base()}. Check your connection.`); }
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, messageOf(data, r.status), data && data.detail);
    return data;
  }

  return {
    ApiError, base, isNative: native,
    setBase(url){ store.set(K_BASE, url ? url.replace(/\/+$/, '') : null); },
    signedIn: () => !!token(),
    onSignedOut(fn){ onSignedOut = fn; },
    async login(email, password){
      const r = await request('POST', '/auth/login', {email, password});
      saveTokens(r);
      return r.user;
    },
    async activate(email, code, password){
      const r = await request('POST', '/auth/activate', {email, code, password});
      saveTokens(r);
      return r.user;
    },
    // Ending the session on the server is best effort: the device forgets its tokens either way.
    async logout(){
      if (token()) await request('POST', '/auth/logout').catch(() => null);
      store.set(K_TOKEN, null); store.set(K_REFRESH, null);
    },
    async logoutAll(){
      await request('POST', '/auth/logout-all');
      store.set(K_TOKEN, null); store.set(K_REFRESH, null);
    },
    me: () => request('GET', '/auth/me'),
    template: () => request('GET', '/template'),
    projects: () => request('GET', '/projects'),
    project: id => request('GET', `/projects/${id}`),
    createProject: body => request('POST', '/projects', body),
    engineers: () => request('GET', '/users?role=civil_engineer'),
    updateLegal: (id, body) => request('PATCH', `/projects/${id}/legal`, body),
    submitVisit: (id, body) => request('POST', `/projects/${id}/site-visits`, body),
    visit: id => request('GET', `/site-visits/${id}`),
    reviewQueue: () => request('GET', '/reviews/queue'),
    review: (id, body) => request('POST', `/site-visits/${id}/review`, body),

    /* ---------- media (v2) ---------- */
    openDraft: pid => request('POST', `/projects/${pid}/site-visits/draft`),
    stages: pid => request('GET', `/projects/${pid}/stages`),
    projectClients: pid => request('GET', `/projects/${pid}/clients`),
    signoffs: pid => request('GET', `/projects/${pid}/signoffs`),
    sharedUpdates: pid => request('GET', `/projects/${pid}/shared-updates`),
    shareUpdate: (vid, note, media_ids) => request('POST', `/site-visits/${vid}/share`, {note, media_ids}),
    async clientUpdatePhotoUrl(uid, mid){
      const key = `u${uid}-${mid}`;
      if (mediaUrls[key]) return mediaUrls[key];
      const r = await authFetch(`${base()}/client/updates/${uid}/media/${mid}`);
      if (!r.ok) throw new ApiError(r.status, 'Could not load the photo');
      return (mediaUrls[key] = URL.createObjectURL(await r.blob()));
    },
    /* ---------- customer app (/client/*) ---------- */
    clientProjects: () => request('GET', '/client/projects'),
    clientProject: id => request('GET', `/client/projects/${id}`),
    clientSignoff: id => request('GET', `/client/signoffs/${id}`),
    approveSignoff: (id, signer_name) => request('POST', `/client/signoffs/${id}/approve`, {confirm: true, signer_name}),
    requestChanges: (id, comment) => request('POST', `/client/signoffs/${id}/request-changes`, {comment}),
    // Opening a document through this URL is what records the client's review of it.
    async clientDocumentUrl(sid, aid){
      const key = `c${sid}-${aid}`;
      if (mediaUrls[key]) return mediaUrls[key];
      const r = await authFetch(`${base()}/client/signoffs/${sid}/attachments/${aid}`);
      if (!r.ok) throw new ApiError(r.status, 'Could not open the document');
      return (mediaUrls[key] = URL.createObjectURL(await r.blob()));
    },
    createSignoff: (pid, body) => request('POST', `/projects/${pid}/signoffs`, body),
    sendSignoff: id => request('POST', `/signoffs/${id}/send`),
    removeSignoffAttachment: (id, aid) => request('DELETE', `/signoffs/${id}/attachments/${aid}`),
    uploadSignoffAttachment(id, file){ const fd = new FormData(); fd.append('file', file); return requestForm(`/signoffs/${id}/attachments`, fd); },
    inviteClient: (pid, name, email) => request('POST', `/projects/${pid}/client-invite`, {name, email}),
    /* ---------- admin: bulk import of in-progress projects ---------- */
    importPreview(file){ const fd = new FormData(); fd.append('file', file); return requestForm('/admin/import/projects/preview', fd); },
    importCommit(file, mode, architectId){
      const fd = new FormData(); fd.append('file', file); fd.append('mode', mode); fd.append('architect_id', String(architectId));
      return requestForm('/admin/import/projects/commit', fd);
    },
    importBatches: () => request('GET', '/admin/import/batches'),
    async importTemplateUrl(){
      const r = await authFetch(`${base()}/admin/import/projects/template`);
      if (!r.ok) throw new ApiError(r.status, 'Could not download the template');
      return URL.createObjectURL(await r.blob());
    },
    /* ---------- admin: users and project members ---------- */
    adminUsers: () => request('GET', '/admin/users'),
    createUser: body => request('POST', '/admin/users', body),
    updateUser: (id, body) => request('PATCH', `/admin/users/${id}`, body),
    projectMembers: pid => request('GET', `/projects/${pid}/members`),
    addMember: (pid, uid) => request('POST', `/projects/${pid}/members/${uid}`),
    removeMember: (pid, uid) => request('DELETE', `/projects/${pid}/members/${uid}`),
    recordException: (pid, key, gate, reason) => request('POST', `/projects/${pid}/stages/${key}/exceptions`, {gate, reason}),
    updateFeePlan: (pid, body) => request('PATCH', `/projects/${pid}/fee-plan`, body),
    completeStage: (pid, key, note) => request('POST', `/projects/${pid}/stages/${key}/complete`, {note}),
    visits: pid => request('GET', `/projects/${pid}/visits`),
    dashboard: filters => request('GET', '/dashboard' + (Object.keys(filters || {}).length ? '?' + new URLSearchParams(filters) : '')),
    clearFlag: (id, reason) => request('POST', `/red-flags/${id}/clear`, {reason}),
    notifications: () => request('GET', '/notifications'),
    problems: pid => request('GET', `/projects/${pid}/problems`),
    resolveProblem: (id, note) => request('POST', `/problems/${id}/resolve`, {note}),
    readNotification: id => request('POST', `/notifications/${id}/read`),
    readAllNotifications: () => request('POST', '/notifications/read-all'),
    deleteMedia: id => request('DELETE', `/media/${id}`),
    retagMedia: (id, problem_ref) => request('PATCH', `/media/${id}`, {problem_ref}),
    // XMLHttpRequest rather than fetch: only XHR reports upload progress.
    uploadMedia(visitId, file, meta, onProgress, retried){
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(), t = token();
        xhr.open('POST', `${base()}/site-visits/${visitId}/media`);
        if (t) xhr.setRequestHeader('Authorization', 'Bearer ' + t);
        xhr.upload.onprogress = e => { if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total); };
        xhr.onerror = () => reject(new ApiError(0, `Cannot reach the SiteFlow server at ${base()}. Check your connection.`));
        xhr.onload = () => {
          let data = null; try { data = JSON.parse(xhr.responseText); } catch (_) {}
          if (xhr.status === 401 && t){
            if (!retried){
              renew().then(ok => ok ? this.uploadMedia(visitId, file, meta, onProgress, true).then(resolve, reject)
                : (signedOut(), reject(new ApiError(401, messageOf(data, 401)))));
              return;
            }
            signedOut();
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new ApiError(xhr.status, messageOf(data, xhr.status), data && data.detail));
        };
        const fd = new FormData();
        fd.append('file', file); fd.append('kind', meta.kind);
        if (meta.problem_ref != null) fd.append('problem_ref', String(meta.problem_ref));
        if (meta.captured_at) fd.append('captured_at', meta.captured_at);
        if (meta.lat != null && meta.lng != null){ fd.append('lat', String(meta.lat)); fd.append('lng', String(meta.lng)); }
        xhr.send(fd);
      });
    },
    // Stage files: XHR for upload progress, one retry after renewing the session.
    uploadStageFile(pid, key, file, onProgress, retried){
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(), t = token();
        xhr.open('POST', `${base()}/projects/${pid}/stages/${key}/attachments`);
        if (t) xhr.setRequestHeader('Authorization', 'Bearer ' + t);
        xhr.upload.onprogress = e => { if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total); };
        xhr.onerror = () => reject(new ApiError(0, `Cannot reach the SiteFlow server at ${base()}. Check your connection.`));
        xhr.onload = () => {
          let data = null; try { data = JSON.parse(xhr.responseText); } catch (_) {}
          if (xhr.status === 401 && t && !retried){
            renew().then(ok => ok ? this.uploadStageFile(pid, key, file, onProgress, true).then(resolve, reject)
              : (signedOut(), reject(new ApiError(401, messageOf(data, 401)))));
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new ApiError(xhr.status, messageOf(data, xhr.status), data && data.detail));
        };
        const fd = new FormData(); fd.append('file', file); xhr.send(fd);
      });
    },
    removeStageFile: (pid, key, id) => request('DELETE', `/projects/${pid}/stages/${key}/attachments/${id}`),
    async stageFileUrl(pid, key, id){
      const k = `s${id}`;
      if (mediaUrls[k]) return mediaUrls[k];
      const r = await authFetch(`${base()}/projects/${pid}/stages/${key}/attachments/${id}`);
      if (!r.ok) throw new ApiError(r.status, 'Could not load the file');
      return (mediaUrls[k] = URL.createObjectURL(await r.blob()));
    },
    setProjectImage(pid, file){ const fd = new FormData(); fd.append('file', file);
      return authFetch(`${base()}/projects/${pid}/image`, {method: 'PUT', body: fd}).then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new ApiError(r.status, messageOf(data, r.status), data && data.detail);
        Object.keys(mediaUrls).filter(k => k.startsWith(`pi${pid}-`)).forEach(k => delete mediaUrls[k]);
        return data; }); },
    removeProjectImage: pid => request('DELETE', `/projects/${pid}/image`),
    async projectImageUrl(pid, size, stamp){
      const k = `pi${pid}-${size}-${stamp || ''}`;
      if (mediaUrls[k]) return mediaUrls[k];
      const r = await authFetch(`${base()}/projects/${pid}/image?size=${size}`);
      if (!r.ok) throw new ApiError(r.status, 'Could not load the project image');
      return (mediaUrls[k] = URL.createObjectURL(await r.blob()));
    },
    // Files need the Bearer token, which an <img src> can't send, so fetch them as blobs.
    async mediaUrl(id){
      if (mediaUrls[id]) return mediaUrls[id];
      const r = await authFetch(`${base()}/media/${id}`);
      if (!r.ok) throw new ApiError(r.status, 'Could not load the file');
      return (mediaUrls[id] = URL.createObjectURL(await r.blob()));
    }
  };
})();
