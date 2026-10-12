/*
 * Runs the n8n Code node sources in a mock n8n runtime to test the Agent API
 * flow end to end without n8n: login code -> session -> routing -> booking
 * register -> agentbookings -> cancel.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const SECRET = 'test-secret';
const config = { env: 'test', locationId: 'loc', timezone: 'Pacific/Auckland', tokenSecret: SECRET, tokenTtlSeconds: 3600, loginCodeTtlSeconds: 600, loginMaxAttempts: 5, agentTag: 'agent_user', bookingsObjectKey: 'custom_objects.bookings', rcmApiKey: 'k', rcmSharedSecret: 'rcm-secret' };
const header = read('n8n/src/header.js').replace('__CONFIG__', JSON.stringify(config)).replace('__AUTH__', read('engine/auth.js'));
const AUTH = require('../../engine/auth');

const staticData = {};
function run(file, input, nodes) {
  const src = header + '\n' + read('n8n/src/' + file);
  const $input = { first: () => input[0], all: () => input };
  const $ = (name) => ({ first: () => (nodes[name] || [])[0], all: () => nodes[name] || [] });
  const fn = new Function('$input', '$', '$getWorkflowStaticData', 'console', src);
  return fn($input, $, () => staticData, { log: () => {} });
}

const agencyRecord = { record: { id: 'co_9', properties: { name: 'Kiwi Tours', agent_code: 'KIWI1', commission_pct: 15, can_cancel: 'true' } } };
const contactRes = { contacts: [{ id: 'ct_1', email: 'sam@kiwitours.example', tags: ['Agent_User'], firstName: 'Sam', lastName: 'Lee', companyId: 'co_9' }] };

let token;

test('login.request routes to GHL lookup, then issues a hashed code', () => {
  const r = run('route-request.js', [{ json: { body: { method: 'login.request', email: 'Sam@KiwiTours.example ' } } }], {});
  assert.equal(r[0].json.route, 'login_request');
  assert.equal(r[0].json.email, 'sam@kiwitours.example');
  const out = run('issue-login-code.js', [{ json: agencyRecord }], {
    'Route Request': [{ json: { email: 'sam@kiwitours.example' } }],
    'Find Agent Contact': [{ json: contactRes }],
    'Get Agency Record': [{ json: agencyRecord }]
  });
  assert.equal(out[0].json.send, true);
  const code = out[0].json.subject.slice(0, 6);
  assert.match(code, /^\d{6}$/);
  const rec = staticData.logins['sam@kiwitours.example'];
  assert.notEqual(rec.hash, code, 'only the hash is stored');
  assert.equal(rec.agency.agentCode, 'KIWI1');

  const bad = run('route-request.js', [{ json: { body: { method: 'login.verify', email: 'sam@kiwitours.example', code: '000000' === code ? '111111' : '000000' } } }], {});
  assert.equal(bad[0].json.response.status, 'ERR');
  const good = run('route-request.js', [{ json: { body: { method: 'login.verify', email: 'sam@kiwitours.example', code } } }], {});
  assert.equal(good[0].json.response.status, 'OK');
  token = good[0].json.response.results[0].token;
  assert.equal(AUTH.verifyToken(token, SECRET).co, 'co_9');
  assert.equal(staticData.logins['sam@kiwitours.example'], undefined, 'code is single use');
});

test('no code for non-agents or agencies without agent_code', () => {
  const ctx = { 'Route Request': [{ json: { email: 'sam@kiwitours.example' } }] };
  const noTag = run('issue-login-code.js', [], Object.assign({}, ctx, { 'Find Agent Contact': [{ json: { contacts: [{ ...contactRes.contacts[0], tags: [] }] } }], 'Get Agency Record': [{ json: agencyRecord }] }));
  assert.equal(noTag[0].json.send, false);
  const noCode = run('issue-login-code.js', [], Object.assign({}, ctx, { 'Find Agent Contact': [{ json: contactRes }], 'Get Agency Record': [{ json: { record: { id: 'co_9', properties: { name: 'X' } } } }] }));
  assert.equal(noCode[0].json.send, false);
});

test('requests without a valid session get 401', () => {
  const r = run('route-request.js', [{ json: { headers: {}, body: { method: 'step2' } } }], {});
  assert.equal(r[0].json.httpStatus, 401);
  assert.equal(r[0].json.response.code, 'AUTH');
  const forged = run('route-request.js', [{ json: { headers: { authorization: 'Bearer ' + AUTH.signToken({ co: 'co_9' }, 'wrong', 60) }, body: { method: 'step2' } } }], {});
  assert.equal(forged[0].json.httpStatus, 401);
});

const auth = () => ({ authorization: 'Bearer ' + token });

test('reads go to RCM as Waka Campa: no agent code, even if the caller sends one', () => {
  const r = run('route-request.js', [{ json: { headers: auth(), body: { method: 'step2', agentcode: 'HACKER', pickuplocationid: 1 } } }], {});
  assert.equal(r[0].json.route, 'rcm');
  assert.equal(r[0].json.rcmBody.agentcode, undefined);
  const s1 = run('route-request.js', [{ json: { headers: auth(), body: JSON.stringify({ method: 'step1' }) } }], {});
  assert.equal(s1[0].json.rcmBody.method, 'step1');
  assert.equal(s1[0].json.rcmBody.agentcode, undefined);
});

let saved;
test('booking: validated, booked as Waka Campa with the agency in the notes, RCM reply becomes a register record', () => {
  const body = { method: 'booking', bookingtype: 2, vehiclecategoryid: 101, pickuplocationid: 1, dropofflocationid: 1, pickupdate: '09/11/2026', pickuptime: '10:00', dropoffdate: '14/11/2026', dropofftime: '10:00', agentcollectedamount: 500, agentrefno: 'KT-77', customer: { firstname: 'Ana', lastname: 'Test', email: 'ana@wakacampa.com' }, displaypickup: 'Auckland', displaydropoff: 'Auckland', displaycategory: '2 Berth', expectedtotal: 900 };
  const r = run('route-request.js', [{ json: { headers: auth(), body } }], {});
  const ctx = r[0].json;
  assert.equal(ctx.post, 'booking');
  assert.equal(ctx.rcmBody.agentcode, undefined);
  assert.equal(ctx.rcmBody.agentname, undefined);
  assert.equal(ctx.rcmBody.agentrefno, undefined);
  assert.equal(ctx.rcmBody.agentcollectedamount, undefined);
  assert.equal(ctx.rcmBody.remark, 'Agent booking: Kiwi Tours (KIWI1). Agent ref KT-77. Booked by Sam Lee.');
  assert.equal(ctx.agent.refNo, 'KT-77');
  const withNotes = run('route-request.js', [{ json: { headers: auth(), body: { ...body, remark: 'Late arrival' } } }], {})[0].json;
  assert.match(withNotes.rcmBody.remark, /Booked by Sam Lee\. Notes: Late arrival$/);
  assert.equal(ctx.rcmBody.displaypickup, undefined);
  const realHirer = run('route-request.js', [{ json: { headers: auth(), body: { ...body, customer: { lastname: 'X', email: 'someone@gmail.com' } } } }], {});
  assert.match(realHirer[0].json.response.error, /@wakacampa.com/);
  const noCust = run('route-request.js', [{ json: { headers: auth(), body: { ...body, customer: { lastname: 'X' } } } }], {});
  assert.equal(noCust[0].json.response.status, 'ERR');

  const shaped = run('shape-rcm-reply.js', [{ json: { status: 'OK', error: '', results: { reservationref: 'REF123', reservationno: 5123, customerid: 77 } } }], { 'Prepare RCM Call': [{ json: ctx }] });
  assert.equal(shaped[0].json.route, 'save');
  const p = shaped[0].json.properties;
  assert.equal(p.booking_number, '5123');
  assert.equal(p.pickupdate, '2026-11-09');
  saved = { id: 'rec_1', properties: p };
  const j = JSON.parse(p.booking_json);
  assert.equal(j.agencyId, 'co_9');
  assert.equal(j.total, 900);
  assert.equal(j.rcmMode, 'direct');
  assert.equal(j.agentRefNo, 'KT-77');
  assert.equal(j.commissionPct, 15);
  assert.equal(j.commission, 135);

  const failed = run('shape-rcm-reply.js', [{ json: { status: 'ERR', error: 'Vehicle not available' } }], { 'Prepare RCM Call': [{ json: ctx }] });
  assert.equal(failed[0].json.response.error, 'Vehicle not available');
});

test('agentbookings only lists this agency, bookinginfo and cancel check ownership', () => {
  const other = { id: 'rec_2', properties: { booking_json: JSON.stringify({ ...JSON.parse(saved.properties.booking_json), agencyId: 'co_other', reservationRef: 'REF999', reservationNo: 9999 }) } };
  const rcmOwn = { id: 'rec_3', properties: { booking_json: '' } };
  const pages = [{ json: { records: [saved, other] } }, { json: { records: [rcmOwn] } }];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date());
  const ctxFor = (method, params) => run('route-request.js', [{ json: { headers: auth(), body: { method, ...params } } }], {})[0];

  const list = run('use-registry.js', pages, { 'Route Request': [ctxFor('agentbookings', { startdate: '2026-01-01', enddate: today })] });
  assert.equal(list[0].json.response.results.length, 1);
  assert.equal(list[0].json.response.results[0].reservationno, 5123);

  const info = run('use-registry.js', pages, { 'Route Request': [ctxFor('bookinginfo', { reservationref: 'REF123' })] });
  assert.equal(info[0].json.route, 'rcm');
  const infoShaped = run('shape-rcm-reply.js', [{ json: { status: 'OK', results: [{ bookinginfo: [{ totalcost: 1000, agentcommission: 0, agentnetamountdue: 0 }], customerinfo: [{}] }] } }], { 'Prepare RCM Call': [info[0]] });
  const bi = infoShaped[0].json.response.results[0].bookinginfo[0];
  assert.equal(bi.agentcommission, 150, 'commission from our agency record, on RCM total');
  assert.equal(bi.agentnetamountdue, 850);
  assert.equal(bi.agentrefno, 'KT-77');
  const notMine = run('use-registry.js', pages, { 'Route Request': [ctxFor('bookinginfo', { reservationref: 'REF999' })] });
  assert.equal(notMine[0].json.response.error, 'Booking not found');

  const cancel = run('use-registry.js', pages, { 'Route Request': [ctxFor('cancelbooking', { reservationref: 'REF123', reasonid: 2 })] });
  assert.equal(cancel[0].json.rcmBody.method, 'cancelbooking');
  assert.equal(cancel[0].json.api, 'web');
  assert.equal(cancel[0].json.rcmBody.agentcode, undefined, 'direct bookings cancel as Waka Campa');
  const legacy = { id: 'rec_4', properties: { booking_json: JSON.stringify({ ...JSON.parse(saved.properties.booking_json), rcmMode: undefined, reservationRef: 'REF555' }) } };
  const legacyCancel = run('use-registry.js', [{ json: { records: [legacy] } }], { 'Route Request': [ctxFor('cancelbooking', { reservationref: 'REF555', reasonid: 2 })] });
  assert.equal(legacyCancel[0].json.rcmBody.agentcode, 'KIWI1', 'older agent bookings still cancel with the agent code');
  const shaped = run('shape-rcm-reply.js', [{ json: { status: 'OK', results: { success: true, successmsg: 'OK', reservationref: 'REF123' } } }], { 'Prepare RCM Call': [cancel[0]] });
  assert.equal(shaped[0].json.route, 'mark_cancelled');
  assert.equal(shaped[0].json.recordId, 'rec_1');
  assert.equal(JSON.parse(shaped[0].json.properties.booking_json).status, 'cancelled');
});

test('Prepare RCM Call signs the exact body for the Web API only', () => {
  const crypto = require('node:crypto');
  const web = run('prepare-rcm-call.js', [{ json: { api: 'web', rcmBody: { method: 'step2', agentcode: 'KIWI1' } } }], {})[0].json;
  assert.equal(web.bodyString, '{"method":"step2","agentcode":"KIWI1"}');
  assert.equal(web.signature, crypto.createHmac('sha256', 'rcm-secret').update(web.bodyString).digest('hex'));
  const post = run('prepare-rcm-call.js', [{ json: { api: 'post', rcmBody: { method: 'bookinginfo' } } }], {})[0].json;
  assert.equal(post.signature, '');
});
