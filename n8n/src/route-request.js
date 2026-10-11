/* Route Request: parse the call, handle login codes, verify the session, decide the path. */
const req = $input.first().json || {};
let body = req.body;
if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
if (body && typeof body.request === 'string') { try { body = JSON.parse(body.request); } catch (e) { /* RCM form style */ } }
if (!body || typeof body !== 'object') body = {};

const method = String(body.method || '').trim().toLowerCase();
const params = Object.assign({}, body);
delete params.method;
if (!method) return respond(null, 'method is required');

const nowS = Math.floor(Date.now() / 1000);
for (const k of Object.keys(store.logins)) if (!store.logins[k] || store.logins[k].exp < nowS) delete store.logins[k];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ---------- login ---------- */
if (method === 'login.request') {
  const email = String(params.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return respond(null, 'Enter a valid email address');
  const prev = store.logins[email];
  if (prev && (prev.requests || 0) >= 5) return respond([{ sent: true }]);
  return [{ json: { route: 'login_request', email } }];
}

if (method === 'login.verify') {
  const email = String(params.email || '').trim().toLowerCase();
  const code = String(params.code || '').trim();
  const rec = store.logins[email];
  if (!rec || !rec.hash) return respond(null, 'That code has expired. Please request a new one.', 'AUTH_CODE');
  rec.attempts = (rec.attempts || 0) + 1;
  if (rec.attempts > CONFIG.loginMaxAttempts) { delete store.logins[email]; return respond(null, 'Too many attempts. Please request a new code.', 'AUTH_CODE'); }
  if (!AUTH.safeEqual(rec.hash, AUTH.hashLoginCode(code, email, CONFIG.tokenSecret))) return respond(null, 'That code is not right. Check the latest email and try again.', 'AUTH_CODE');
  delete store.logins[email];
  store.agencies[rec.agency.id] = Object.assign({}, rec.agency, { refreshedAt: nowS });
  const token = AUTH.signToken({ cid: rec.user.id, co: rec.agency.id, em: email, nm: rec.user.name }, CONFIG.tokenSecret, CONFIG.tokenTtlSeconds);
  return respond([{ token, user: { name: rec.user.name, email }, agency: { name: rec.agency.name, agentcode: rec.agency.agentCode } }]);
}

/* ---------- session ---------- */
const claims = AUTH.verifyToken(AUTH.bearer(req.headers || {}), CONFIG.tokenSecret);
if (!claims) return respond(null, 'Please sign in again.', 'AUTH', 401);
const agency = store.agencies[claims.co];
if (!agency || agency.disabled) return respond(null, 'Your agency is not active on the portal. Please sign in again.', 'AUTH', 401);
const user = { id: claims.cid, email: claims.em, name: claims.nm || '' };

if (method === 'me') {
  return respond([{ agency: agency.name, agentcode: agency.agentCode, commissionpct: Number(agency.commissionPct || 0), cancancel: agency.canCancel !== false, user }]);
}

/* Reads that go straight to the booking engine. agentcode is always the agency's, never the caller's. */
const PROXY = ['step1', 'vehiclecategorylocations', 'step2', 'search', 'step3', 'select', 'calctotal', 'locations', 'locationdetails',
  'categorytypes', 'categorylist', 'driverages', 'countries', 'cancelreasons', 'donotrent', 'packages', 'relocationspecials', 'customfields'];
const AGENT_PRICED = ['step2', 'search', 'step3', 'select', 'packages'];

const clean = (p) => {
  const o = {};
  for (const [k, v] of Object.entries(p)) if (!k.startsWith('display') && k !== 'expectedtotal' && k !== 'agentcode') o[k] = v;
  return o;
};

if (PROXY.includes(method)) {
  const p = clean(params);
  if (AGENT_PRICED.includes(method)) p.agentcode = agency.agentCode;
  return [{ json: { route: 'rcm', api: 'web', post: 'plain', method, rcmBody: Object.assign({ method }, p), agency, user } }];
}

if (method === 'booking' || method === 'savebooking') {
  const p = clean(params);
  let customer = p.customer;
  if (typeof customer === 'string') { try { customer = JSON.parse(customer); } catch (e) { return respond(null, 'customer must be JSON'); } }
  if (!customer || !String(customer.lastname || '').trim() || !EMAIL_RE.test(String(customer.email || '').trim())) {
    return respond(null, 'customer.lastname and a valid customer.email are required');
  }
  if (![1, 2].includes(Number(p.bookingtype || 2))) return respond(null, 'bookingtype must be 1 (quote) or 2 (booking)');
  p.customer = customer;
  p.bookingtype = Number(p.bookingtype || 2);
  p.agentcode = agency.agentCode;
  p.agentname = String(user.name || '').slice(0, 20);
  p.agentemail = String(user.email || '').slice(0, 50);
  if (!agency.allowCollected) delete p.agentcollectedamount;
  const display = {
    pickup: String(params.displaypickup || ''), dropoff: String(params.displaydropoff || ''),
    category: String(params.displaycategory || ''), total: Number(params.expectedtotal || 0)
  };
  return [{ json: { route: 'rcm', api: 'web', post: 'booking', method, rcmBody: Object.assign({ method: 'booking' }, p), agency, user, display } }];
}

if (['agentbookings', 'bookinginfo', 'cancelbooking'].includes(method)) {
  return [{ json: { route: 'registry', method, params, agency, user } }];
}

return respond(null, `Unknown method '${method}'`);
