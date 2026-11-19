/*
 * Prepare Collected Payment: works out what the agent collected and keeps it on the GHL record.
 *
 * In AGENT mode RCM already holds the agency and has applied its own collected amount, so this
 * node records RCM's figures and posts nothing back.
 *
 * In DIRECT mode the booking is made as Waka Campa, so we copy RCM's agent rule ourselves:
 * commission % x the rental amount (fees too only when the agency has commission_on_fees),
 * posted to RCM as an Account/Chq payment so the hirer's balance reads correctly.
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
/* In agent mode RCM has already worked the commission out from the agency's own rate, so its
   figure wins and ours is only a fallback for a reply that did not carry one. */
const rcmCommission = Number(bi.agentcommission || 0);
const agentMode = CONFIG.agentMode === 'agent';
const commission = (agentMode && rcmCommission > 0) ? round2(rcmCommission) : round2(base * pct / 100);

let collected = commission;
if (ctx.allowCollected && ctx.requestedCollected !== null && ctx.requestedCollected !== undefined && ctx.requestedCollected !== '') {
  collected = Math.max(0, Math.min(round2(ctx.requestedCollected), total));
}

Object.assign(booking, {
  total: total || booking.total,
  rental: round2(rental),
  commission,
  collected,
  netDue: (agentMode && bi.agentnetamountdue !== undefined && bi.agentnetamountdue !== null)
    ? round2(bi.agentnetamountdue) : round2(total - commission),
  rentalSource: rentalFromRcm > 0 ? 'rcm' : 'estimate',
  commissionSource: (agentMode && rcmCommission > 0) ? 'rcm' : 'waka'
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
  /* Quotations are not reservations: nothing has been collected yet.
     In agent mode RCM applies the collected amount itself from the agency's rate, so posting
     our own Account/Chq line would double it up. The payment exists only in direct mode. */
  pay: !agentMode && collected > 0 && !booking.isQuotation,
  bodyString,
  signature: AUTH.hmacHex(CONFIG.rcmSharedSecret, bodyString),
  properties,
  reply: ctx.reply,
  collected
} }];
