const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../core');
const A = require('../auth');
const { catalogue, agency } = require('./fixture');

const NOW = '2026-10-12T00:00:00Z'; /* 13:00 in Auckland */
const ctx = { now: NOW, agency };

const base = {
  pickuplocationid: 1, dropofflocationid: 1,
  pickupdate: '09/11/2026', pickuptime: '10:00',
  dropoffdate: '14/11/2026', dropofftime: '10:00',
  ageid: 2, vehiclecategorytypeid: 0
};

test('parses RCM style dates and times', () => {
  assert.equal(E.parseDate('03/11/2026'), '2026-11-03');
  assert.equal(E.parseDate('03/Nov/2026'), '2026-11-03');
  assert.equal(E.parseDate('2026-11-03'), '2026-11-03');
  assert.equal(E.parseDate('31/02/2026'), null);
  assert.equal(E.parseTime('9am'), '09:00');
  assert.equal(E.parseTime('1630'), '16:30');
  assert.equal(E.rcmDate('2026-11-03'), '03/Nov/2026');
});

test('hire days use 24h blocks with a grace period', () => {
  const r = E.normaliseSearch(base, catalogue);
  assert.equal(E.hireDays(r, catalogue), 5);
  const late = E.normaliseSearch({ ...base, dropofftime: '10:45' }, catalogue);
  assert.equal(E.hireDays(late, catalogue), 5);
  const later = E.normaliseSearch({ ...base, dropofftime: '11:30' }, catalogue);
  assert.equal(E.hireDays(later, catalogue), 6);
});

test('calendar day counting matches RCM (9 to 16 Nov, 10:00 to 10:00 = 8 days)', () => {
  const cal = Object.assign({}, catalogue, { settings: Object.assign({}, catalogue.settings, { dayCounting: 'calendar' }) });
  const r = E.normaliseSearch({ ...base, dropoffdate: '16/11/2026' }, cal);
  assert.equal(E.hireDays(r, cal), 8);
  const sameDay = E.normaliseSearch({ ...base, dropoffdate: '09/11/2026', dropofftime: '17:00' }, cal);
  assert.equal(E.hireDays(sameDay, cal), 1);
});

test('step1 returns the RCM datasets', () => {
  const res = E.handleRead('step1', catalogue, [], {}, ctx);
  assert.equal(res.status, 'OK');
  const r = res.results[0];
  assert.deepEqual(Object.keys(r).sort(), ['categorytypes', 'driverages', 'holidays', 'locations', 'officetimes']);
  assert.equal(r.locations.length, 3);
  assert.equal(r.holidays[0].startdate, '25/Dec/2026');
});

test('step2 prices every category and flags min days', () => {
  const res = E.handleRead('step2', catalogue, [], base, ctx);
  assert.equal(res.status, 'OK', res.error);
  const cars = res.results[0].availablecars;
  const hiTop = cars.find(c => c.vehiclecategoryid === 101);
  const family = cars.find(c => c.vehiclecategoryid === 102);
  assert.equal(hiTop.available, 1);
  assert.equal(hiTop.totalrateafterdiscount, 600); /* 5 x 120 */
  assert.equal(family.available, 1);
  assert.equal(family.totalrateafterdiscount, 850);
  const short = E.handleRead('step2', catalogue, [], { ...base, dropoffdate: '13/11/2026' }, ctx).results[0].availablecars;
  assert.equal(short.find(c => c.vehiclecategoryid === 102).available, 0);
  assert.match(short.find(c => c.vehiclecategoryid === 102).availablemessage, /Minimum hire is 5/);
});

test('rate bands: 10+ days use the cheaper band', () => {
  const res = E.handleRead('step2', catalogue, [], { ...base, dropoffdate: '19/11/2026' }, ctx);
  const hiTop = res.results[0].availablecars.find(c => c.vehiclecategoryid === 101);
  assert.equal(hiTop.numberofdays, 10);
  assert.equal(hiTop.totalrateafterdiscount, 1050);
});

test('season split across Shoulder and Peak with a percentage discount', () => {
  const res = E.handleRead('step2', catalogue, [], { ...base, pickupdate: '28/11/2026', dropoffdate: '03/12/2026' }, ctx);
  const s = res.results[0].seasonalrates.filter(x => x.vehiclecategoryid === 101);
  assert.equal(s.length, 2);
  assert.equal(s[0].season, 'Shoulder');
  assert.equal(s[0].numberofdays, 3);
  assert.equal(s[1].season, 'Peak');
  assert.equal(s[1].dailyrateafterdiscount, 162);
  const car = res.results[0].availablecars.find(c => c.vehiclecategoryid === 101);
  assert.equal(car.totalrateafterdiscount, 3 * 120 + 2 * 162);
});

test('weekly rate when rateperiod_typeid = 2', () => {
  const q = { ...base, dropoffdate: '18/11/2026', rateperiod_typeid: 2 };
  const res = E.handleRead('step2', catalogue, [], q, ctx);
  const car = res.results[0].availablecars.find(c => c.vehiclecategoryid === 101);
  assert.equal(car.numberofdays, 9);
  assert.equal(car.totalrateafterdiscount, 700 + 2 * 120);
});

test('availability counts overlapping bookings and ignores quotes and cancellations', () => {
  const bk = (status, extra = {}) => ({ categoryId: 102, status, pickupDate: '2026-11-12', pickupTime: '10:00', dropoffDate: '2026-11-18', dropoffTime: '10:00', ...extra });
  const one = E.handleRead('step2', catalogue, [bk('confirmed')], base, ctx).results[0].availablecars.find(c => c.vehiclecategoryid === 102);
  assert.equal(one.available, 2); /* 1 of 2 left = limited */
  const two = E.handleRead('step2', catalogue, [bk('confirmed'), bk('onrequest')], base, ctx).results[0].availablecars.find(c => c.vehiclecategoryid === 102);
  assert.equal(two.available, 0);
  const ignored = E.handleRead('step2', catalogue, [bk('confirmed'), bk('cancelled'), bk('quote', { isQuotation: true })], base, ctx).results[0].availablecars.find(c => c.vehiclecategoryid === 102);
  assert.equal(ignored.available, 2);
  const touching = E.handleRead('step2', catalogue, [bk('confirmed', { pickupDate: '2026-11-14' }), bk('confirmed', { pickupDate: '2026-11-14' })], base, ctx).results[0].availablecars.find(c => c.vehiclecategoryid === 102);
  assert.equal(touching.available, 1, 'a hire starting exactly at our drop-off does not overlap');
});

test('location rules: closed Sunday, notice, past dates, holiday, unattended fee', () => {
  const sunday = E.handleRead('step2', catalogue, [], { ...base, pickupdate: '08/11/2026' }, ctx).results[0];
  assert.equal(sunday.locationfees.find(l => l.loctypeid === 1).isavailable, false);
  assert.ok(sunday.availablecars.every(c => c.available === 0));

  const tooSoon = E.handleRead('step2', catalogue, [], { ...base, pickupdate: '12/10/2026', pickuptime: '15:00' }, ctx).results[0];
  assert.match(tooSoon.locationfees[0].availablemessage, /notice/);

  const past = E.handleRead('step2', catalogue, [], { ...base, pickupdate: '01/10/2026' }, ctx).results[0];
  assert.match(past.locationfees[0].availablemessage, /past/);

  const xmas = E.handleRead('step2', catalogue, [], { ...base, pickupdate: '20/12/2026', dropoffdate: '25/12/2026' }, ctx).results[0];
  assert.match(xmas.locationfees.find(l => l.loctypeid === 2).availablemessage, /Christmas/);

  const late = E.handleRead('step2', catalogue, [], { ...base, dropofftime: '18:00' }, ctx).results[0];
  assert.equal(late.locationfees.find(l => l.loctypeid === 2).isavailable, true);
  assert.ok(late.mandatoryfees.some(f => f.id === 908));
});

test('one-way and location mandatory fees', () => {
  const res = E.handleRead('step2', catalogue, [], { ...base, dropofflocationid: 3, dropoffdate: '16/11/2026' }, ctx).results[0];
  const ids = res.mandatoryfees.filter(f => f.vehiclecategoryid === 101).map(f => f.id);
  assert.ok(ids.includes(901));
  assert.ok(ids.includes(902));
  assert.ok(!ids.includes(903), 'Queenstown premium applies to pickups at Queenstown only');
});

test('driver age limits', () => {
  const old = E.handleRead('step2', catalogue, [], { ...base, ageid: 3 }, ctx).results[0].availablecars;
  assert.ok(old.every(c => c.available === 0 && /Maximum driver age/.test(c.availablemessage)));
});

test('step3 lists extras, insurance and km options', () => {
  const res = E.handleRead('step3', catalogue, [], { ...base, vehiclecategoryid: 101 }, ctx);
  assert.equal(res.status, 'OK', res.error);
  const r = res.results[0];
  assert.equal(r.optionalfees.length, 4);
  assert.equal(r.insuranceoptions.length, 2);
  assert.equal(r.insuranceoptions.find(i => i.id === 912).totalinsuranceamount, 175);
  assert.equal(r.kmcharges[0].isdefault, true);
  assert.ok(!('_fee' in r.optionalfees[0]));
});

test('calctotal: daily caps, insurance, percentage on total, GST inclusive', () => {
  const q = { ...base, vehiclecategoryid: 101, insuranceid: 912, extrakmsid: 921, optionalfees: [{ id: 904, qty: 2 }, { id: 907, qty: 1 }] };
  const res = E.handleRead('calctotal', catalogue, [], q, ctx);
  assert.equal(res.status, 'OK', res.error);
  const rows = res.results[0].totals;
  const get = t => rows.filter(r => r.type === t);
  assert.equal(get('total rate')[0].total, 600);
  assert.equal(get('mandatory')[0].total, 45);
  assert.equal(get('optional').find(r => r.id === 904).total, 80); /* 8 x 5 days x 2 */
  assert.equal(get('insurance')[0].total, 175);
  const pre = 600 + 45 + 80 + 175;
  assert.equal(get('optional').find(r => r.id === 907).total, E.round2(pre * 0.02));
  const total = get('total')[0].total;
  assert.equal(total, E.round2(pre * 1.02));
  assert.equal(get('country tax')[0].total, E.round2(total * 0.15 / 1.15));
});

test('calctotal accepts RCM single-quote JSON for optionalfees', () => {
  const res = E.handleRead('calctotal', catalogue, [], { ...base, vehiclecategoryid: 101, optionalfees: "[{'id':906,'qty':1}]" }, ctx);
  assert.equal(res.status, 'OK', res.error);
  assert.ok(res.results[0].totals.some(r => r.id === 906 && r.total === 60));
});

test('prepareBooking prices server-side, applies commission and collected amount', () => {
  const req = {
    ...base, vehiclecategoryid: 101, bookingtype: 2, insuranceid: 912, extrakmsid: 921, transmission: 0,
    optionalfees: [{ id: 904, qty: 1 }],
    agentrefno: 'ST-55', agentcollectedamount: 100,
    customer: { firstname: 'Ana', lastname: 'Test', email: 'ana@wakacampa.com', phone: '021000000' }
  };
  const b = E.prepareBooking(catalogue, [], req, agency, NOW);
  assert.equal(b.status, 'confirmed');
  assert.equal(b.agentCode, 'SAMPLE01');
  assert.equal(b.total, 600 + 45 + 40 + 175);
  /* 20% of rental 600 + payAgency fees (booster 40, Peace of Mind 175) */
  assert.equal(b.commission, E.round2(0.2 * (600 + 40 + 175)));
  assert.equal(b.agentCollected, 100);
  assert.equal(b.netDue, E.round2(b.total - b.commission - 100));
});

test('prepareBooking rejects sold out, price change, do-not-rent and bad customers', () => {
  const req = { ...base, vehiclecategoryid: 102, bookingtype: 2, customer: { lastname: 'X', email: 'x@wakacampa.com' } };
  const full = [1, 2].map(() => ({ categoryId: 102, status: 'confirmed', pickupDate: '2026-11-10', pickupTime: '09:00', dropoffDate: '2026-11-20', dropoffTime: '09:00' }));
  assert.throws(() => E.prepareBooking(catalogue, full, req, agency, NOW), /Sold out/);
  assert.doesNotThrow(() => E.prepareBooking(catalogue, full, { ...req, bookingtype: 1 }, agency, NOW), 'quotes do not need stock');
  assert.throws(() => E.prepareBooking(catalogue, [], { ...req, expectedtotal: 1 }, agency, NOW), /price changed/);
  assert.throws(() => E.prepareBooking(catalogue, [], { ...req, customer: { lastname: 'B', email: 'blocked@example.com' } }, agency, NOW), /contact Waka Campa/);
  assert.throws(() => E.prepareBooking(catalogue, [], { ...req, customer: { lastname: 'B', email: 'nope' } }, agency, NOW), /email is not valid/);
  assert.throws(() => E.prepareBooking(catalogue, [], { ...req, customer: '{bad' }, agency, NOW), /must be JSON/);
});

test('agentbookings, bookinginfo and cancel are scoped to the agency', () => {
  const req = { ...base, vehiclecategoryid: 101, bookingtype: 2, customer: { firstname: 'Ana', lastname: 'Test', email: 'ana@wakacampa.com' } };
  const mine = Object.assign(E.prepareBooking(catalogue, [], req, agency, NOW), { reservationRef: 'WCREF1', reservationNo: 50001, createdDate: '2026-10-12' });
  const theirs = Object.assign({}, mine, { agencyId: 'co_2', reservationRef: 'WCREF2', reservationNo: 50002 });
  const all = [mine, theirs];

  const list = E.handleRead('agentbookings', catalogue, all, { startdate: '01/10/2026', enddate: '31/10/2026' }, ctx);
  assert.equal(list.results.length, 1);
  assert.equal(list.results[0].reservationref, 'WCREF1');
  assert.equal(list.results[0].bookingstatus, 'CONFIRMED');

  const info = E.handleRead('bookinginfo', catalogue, all, { reservationref: 'WCREF1' }, ctx);
  assert.equal(info.status, 'OK', info.error);
  assert.equal(info.results[0].bookinginfo[0].agentcommission, mine.commission);
  assert.equal(info.results[0].customerinfo[0].lastname, 'Test');

  const other = E.handleRead('bookinginfo', catalogue, all, { reservationref: 'WCREF2' }, ctx);
  assert.equal(other.status, 'ERR');
  assert.equal(other.error, 'Booking not found');

  assert.throws(() => E.checkCancel(theirs, agency, { reasonid: 1 }, catalogue), /not found/);
  assert.throws(() => E.checkCancel(mine, { ...agency, canCancel: false }, { reasonid: 1 }, catalogue), /not set up to cancel/);
  assert.equal(E.checkCancel(mine, agency, { reasonid: 2 }, catalogue).cancelReason, 'Booked elsewhere');
});

test('unknown method and bad input return RCM style errors', () => {
  assert.equal(E.handleRead('nope', catalogue, [], {}, ctx).error, "Unknown method 'nope'");
  const bad = E.handleRead('step2', catalogue, [], { ...base, pickuplocationid: 99 }, ctx);
  assert.equal(bad.status, 'ERR');
  assert.equal(bad.error, 'Invalid pickuplocationid');
});

test('auth: HMAC matches Node crypto, tokens verify and expire', () => {
  const crypto = require('node:crypto');
  const want = crypto.createHmac('sha256', 'secret').update('{"method":"step1"}').digest('hex');
  assert.equal(A.hmacHex('secret', '{"method":"step1"}'), want);
  const long = 'k'.repeat(100);
  assert.equal(A.hmacHex(long, 'é漢字'), crypto.createHmac('sha256', long).update('é漢字').digest('hex'));
  assert.equal(A.sha256Hex(''), crypto.createHash('sha256').update('').digest('hex'));

  const t = A.signToken({ cid: 'c1', co: 'co_1' }, 's3cret', 60, 1_000_000_000_000);
  assert.equal(A.verifyToken(t, 's3cret', 1_000_000_030_000).co, 'co_1');
  assert.equal(A.verifyToken(t, 's3cret', 1_000_000_120_000), null, 'expired');
  assert.equal(A.verifyToken(t, 'other', 1_000_000_030_000), null, 'wrong secret');
  assert.equal(A.verifyToken(t.replace(/^./, 'x'), 's3cret', 1_000_000_030_000), null, 'tampered');
  assert.equal(A.hashLoginCode('123456', 'A@b.com ', 'k'), A.hashLoginCode('123456', 'a@b.com', 'k'));
  assert.equal(A.newLoginCode(0.000001), '000001');
  assert.equal(A.bearer({ authorization: 'Bearer abc' }), 'abc');
});
