/* Shape RCM Reply: RCM envelope -> our envelope; booking and cancel continue to the GHL write. */
const ctx = $('Prepare RCM Call').first().json;
const r = ($input.first() || {}).json || {};

if (r.status !== 'OK') {
  const res0 = Array.isArray(r.results) ? r.results[0] : r.results;
  const msg = r.error || r.message || (res0 && res0.successmsg) || 'The booking service did not accept the request.';
  console.log('RCM ' + ctx.method + ' failed: ' + String(msg).slice(0, 300));
  return respond(null, String(msg), 'RCM');
}

const results = r.results;

if (ctx.post === 'plain') return respond(results);

if (ctx.post === 'bookinginfo') {
  /* Hide anything about other agencies; RCM already scopes by reservation. Add our registry facts. */
  const out = Array.isArray(results) ? results : [results];
  const first = out[0] || {};
  const bi = Array.isArray(first.bookinginfo) ? first.bookinginfo[0] : null;
  if (bi && ctx.booking) {
    bi.agentrefno = bi.agentrefno || ctx.booking.agentRefNo || '';
    if (ctx.booking.rcmMode === 'direct') {
      /* RCM holds this as a Waka Campa booking, so commission comes from our agency record, on RCM's current total. */
      const pct = Number(ctx.booking.commissionPct || 0);
      const total = Number(bi.totalcost || ctx.booking.total || 0);
      const rental = (Array.isArray(first.rateinfo) ? first.rateinfo : []).reduce((s, r) => s + Number(r.ratesubtotal || 0), 0) || Number(ctx.booking.rental || 0);
      const base = ctx.booking.commissionOnFees ? total : rental;
      bi.agentcommission = Math.round(base * pct) / 100;
      bi.agentnetamountdue = Math.round((total - bi.agentcommission) * 100) / 100;
    }
    if (bi.agentcommission === undefined || bi.agentcommission === null) bi.agentcommission = 0;
  }
  return respond(out);
}

const first = Array.isArray(results) ? (results[0] || {}) : (results || {});

if (ctx.post === 'booking') {
  const reqBody = ctx.rcmBody;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const toIso = (v) => {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return s;
  };
  const booking = {
    source: 'agent_portal',
    agencyId: ctx.agency.id,
    agencyName: ctx.agency.name,
    agentCode: ctx.agency.agentCode,
    agentUserId: ctx.user.id,
    agentName: ctx.agent.name,
    agentEmail: ctx.agent.email,
    agentRefNo: ctx.agent.refNo,
    reservationRef: first.reservationref,
    reservationNo: first.reservationno,
    rcmCustomerId: first.customerid || '',
    status: Number(reqBody.bookingtype) === 1 ? 'quote' : 'confirmed',
    isQuotation: Number(reqBody.bookingtype) === 1,
    createdDate: today,
    pickupLocationId: reqBody.pickuplocationid,
    dropoffLocationId: reqBody.dropofflocationid,
    pickupName: ctx.display.pickup,
    dropoffName: ctx.display.dropoff,
    pickupDate: toIso(reqBody.pickupdate), pickupTime: reqBody.pickuptime,
    dropoffDate: toIso(reqBody.dropoffdate), dropoffTime: reqBody.dropofftime,
    categoryId: reqBody.vehiclecategoryid,
    categoryName: ctx.display.category,
    total: ctx.display.total,
    customer: { firstname: reqBody.customer.firstname || '', lastname: reqBody.customer.lastname, email: reqBody.customer.email },
    engine: 'rcm-mirror',
    rcmMode: 'direct',
    commissionPct: Number(ctx.agency.commissionPct || 0),
    commissionOnFees: !!ctx.agency.commissionOnFees
  };
  const properties = {
    booking_number: String(first.reservationno),
    reservationno: Number(first.reservationno),
    reservationstatus: booking.isQuotation ? 'quotation' : 'reservation',
    reservationcreateddate: today,
    pickupdate: booking.pickupDate,
    dropoffdate: booking.dropoffDate,
    pickuplocationname: booking.pickupName,
    dropofflocationname: booking.dropoffName,
    vehiclecategory: booking.categoryName,
    rentalsource: 'Agent portal - ' + ctx.agency.name,
    booking_type: booking.isQuotation ? 'quotation' : 'booking',
    totalcost: { currency: 'default', value: booking.total || 0 },
    booking_json: JSON.stringify(booking)
  };
  /* Next: read the reservation back from RCM for the exact rental, then record the agent's collected payment. */
  return [{ json: {
    route: 'collect',
    properties,
    booking,
    reply: [{ reservationref: first.reservationref, reservationno: first.reservationno, customerid: first.customerid || '' }],
    bookinginfoBody: JSON.stringify({ method: 'bookinginfo', reservationref: first.reservationref }),
    allowCollected: !!ctx.agency.allowCollected,
    requestedCollected: ctx.agent.collected === undefined ? null : ctx.agent.collected,
    rentalEstimate: ctx.display.rental || 0
  } }];
}

if (ctx.post === 'cancel') {
  if (first.success === false || String(first.success).toLowerCase() === 'false') return respond(null, first.successmsg || 'Booking could not be cancelled', 'RCM');
  const b = Object.assign({}, ctx.booking, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: ctx.user.email });
  const recordId = b.recordId; delete b.recordId;
  return [{ json: { route: 'mark_cancelled', recordId, properties: { reservationstatus: 'cancelled', booking_json: JSON.stringify(b) }, reply: [{ success: true, successmsg: 'OK', reservationref: b.reservationRef }] } }];
}

return respond(results);
