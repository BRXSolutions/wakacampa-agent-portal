/*
 * Agent API client. Every call is POST { method, ...params } with a Bearer
 * session token, and returns RCM's envelope { status, error, results }.
 *
 * With no apiUrl configured the client runs a local demo backend built on the
 * same engine (engine/core.js) and the sample catalogue, so the portal can be
 * previewed and tested without n8n.
 */
(function () {
  const cfg = window.PORTAL_CONFIG || {};
  const TOKEN_KEY = 'wc_agent_token';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };

  class ApiError extends Error {
    constructor(message, code) { super(message); this.code = code; }
  }

  async function remote(method, params) {
    const token = store.get(TOKEN_KEY);
    const res = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(Object.assign({ method }, params || {}))
    });
    let body;
    try { body = await res.json(); } catch (e) { throw new ApiError('The booking service did not respond. Please try again.'); }
    if (Array.isArray(body)) body = body[0];
    if (res.status === 401 || body.code === 'AUTH') { store.del(TOKEN_KEY); throw new ApiError(body.error || 'Please sign in again.', 'AUTH'); }
    if (body.status !== 'OK') throw new ApiError(body.error || 'Something went wrong.', body.code);
    return body.results;
  }

  /* ---------------- demo backend ---------------- */
  const demo = (function () {
    const E = window.AgentEngine;
    const cat = window.DEMO_CATALOGUE;
    const agency = window.DEMO_AGENCY;
    const KEY = 'wc_demo_bookings';
    const load = () => { try { return JSON.parse(store.get(KEY) || '[]'); } catch (e) { return []; } };
    const save = (b) => store.set(KEY, JSON.stringify(b));
    let seq = 50000 + load().length;
    const today = () => E.nowIn('Pacific/Auckland').date;

    return async function (method, params) {
      await new Promise(r => setTimeout(r, 250));
      const bookings = load();
      const ctx = { agency, user: { name: 'Demo Agent', email: 'demo@agency.example' } };
      if (method === 'login.request') return [{ sent: true, demoCode: '123456' }];
      if (method === 'login.verify') {
        if (params.code !== '123456') throw new ApiError('That code is not right. In demo mode the code is 123456.');
        return [{ token: 'demo-token', user: ctx.user, agency: { name: agency.name, agentcode: agency.agentCode } }];
      }
      if (method === 'booking') {
        let b;
        try { b = E.prepareBooking(cat, bookings, params, agency); }
        catch (e) { throw new ApiError(e.message, e.code); }
        Object.assign(b, { reservationRef: E.makeReservationRef(), reservationNo: ++seq, createdDate: today() });
        if (b.isQuotation) b.quoteExpiry = E.addDays(today(), b.quoteValidDays);
        bookings.push(b); save(bookings);
        return [{ reservationref: b.reservationRef, reservationno: b.reservationNo, customerid: '' }];
      }
      if (method === 'cancelbooking') {
        const b = bookings.find(x => x.reservationRef === params.reservationref);
        try { Object.assign(b || {}, E.checkCancel(b, agency, params, cat)); }
        catch (e) { throw new ApiError(e.message, e.code); }
        save(bookings);
        return [{ success: true, successmsg: 'OK', reservationref: params.reservationref }];
      }
      const res = E.handleRead(method, cat, bookings, params, ctx);
      if (res.status !== 'OK') throw new ApiError(res.error, res.code);
      return res.results;
    };
  })();

  const call = cfg.apiUrl ? remote : demo;

  window.AgentApi = {
    isDemo: !cfg.apiUrl,
    ApiError,
    call,
    hasSession: () => !!store.get(TOKEN_KEY),
    signOut: () => store.del(TOKEN_KEY),
    async requestCode(email) { return (await call('login.request', { email }))[0]; },
    async verifyCode(email, code) {
      const r = (await call('login.verify', { email, code }))[0];
      store.set(TOKEN_KEY, r.token);
      store.set('wc_agent_profile', JSON.stringify({ user: r.user, agency: r.agency }));
      return r;
    },
    profile() { try { return JSON.parse(store.get('wc_agent_profile') || 'null'); } catch (e) { return null; } }
  };
})();
