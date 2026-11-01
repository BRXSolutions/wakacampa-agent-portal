/*
 * Prepare Collected Payment: copy RCM's agent rule now that bookings are made as Waka Campa.
 * The agent collects their commission from the hirer: commission % x the rental amount (fees too only
 * when the agency has commission_on_fees). It is recorded in RCM as an Account/Chq payment so the
 * hirer's balance is right, and kept on the GHL booking record.
 */
const ctx = $('After RCM').first().json;
const info = ($input.first() || {}).json || {};
const res = Array.isArray(info.results) ? (info.results[0] || {}) : (info.results || {});
const bi = Array.isArray(res.bookinginfo) ? (res.bookinginfo[0] || {}) : {};
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const booking = Object.assign({}, ctx.booking);
const total = Number(bi.totalcost || booking.total || 0);
const rentalFromRcm = (Array.isArray(res.rateinfo) ? res.rateinfo : []).reduce((s, r) => s + Number(r.ratesubtotal || 0), 0);
const rental = rentalFromRcm > 0 ? rentalFromRcm : Number(ctx.rentalEstimate || 0);
const pct = Number(booking.commissionPct || 0);
const base = booking.commissionOnFees ? total : rental;
const commission = round2(base * pct / 100);

let collected = commission;
if (ctx.allowCollected && ctx.requestedCollected !== null && ctx.requestedCollected !== undefined && ctx.requestedCollected !== '') {
  collected = Math.max(0, Math.min(round2(ctx.requestedCollected), total));
}

Object.assign(booking, {
  total: total || booking.total,
  rental: round2(rental),
  commission,
  collected,
  netDue: round2(total - commission),
  rentalSource: rentalFromRcm > 0 ? 'rcm' : 'estimate'
});
const properties = Object.assign({}, ctx.properties, {
  totalcost: { currency: 'default', value: booking.total || 0 },
  booking_json: JSON.stringify(booking)
});

const paydate = new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
const payBody = {
  method: 'confirmpayment',
  reservationref: booking.reservationRef,
  amount: collected,
  success: true,
  paytype: 'Account/Chq',
  paydate,
  supplierid: 0,
  paysource: ('Agent collected - ' + booking.agencyName).slice(0, 50),
  emailoption: 0
};
const bodyString = JSON.stringify(payBody);
return [{ json: {
  /* Quotations are not reservations: nothing has been collected yet. */
  pay: collected > 0 && !booking.isQuotation,
  bodyString,
  signature: AUTH.hmacHex(CONFIG.rcmSharedSecret, bodyString),
  properties,
  reply: ctx.reply,
  collected
} }];
