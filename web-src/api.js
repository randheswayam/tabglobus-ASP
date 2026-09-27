/* ---------- SiteFlow API client ---------- */
const SiteFlowAPI = (() => {
  'use strict';
  const K_BASE = 'siteflow.api', K_TOKEN = 'siteflow.token';
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

  async function request(method, path, body){
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const t = token(); if (t) headers.Authorization = 'Bearer ' + t;
    let r;
    try { r = await fetch(base() + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)}); }
    catch (_) { throw new ApiError(0, `Cannot reach the SiteFlow server at ${base()}. Check your connection.`); }
    const data = await r.json().catch(() => null);
    if (r.status === 401 && t){ store.set(K_TOKEN, null); if (onSignedOut) onSignedOut(); }
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
      store.set(K_TOKEN, r.access_token);
      return r.user;
    },
    logout(){ store.set(K_TOKEN, null); },
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
    review: (id, body) => request('POST', `/site-visits/${id}/review`, body)
  };
})();
