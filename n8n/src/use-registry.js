/* Use Registry: the agency's own bookings, from GHL Booking records written by this API. */
const ctx = $('Route Request').first().json;
const agency = ctx.agency;
const params = ctx.params || {};

const records = $input.all().flatMap(i => (i.json && Array.isArray(i.json.records)) ? i.json.records : []);
const mine = [];
for (const rec of records) {
  const p = rec.properties || {};
  let j = null;
  try { j = JSON.parse(p.booking_json || 'null'); } catch (e) { j = null; }
  if (!j || j.source !== 'agent_portal' || String(j.agencyId) !== String(agency.id)) continue;
  mine.push(Object.assign({}, j, { recordId: rec.id }));
}

const toIso = (v) => {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  m = s.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3})[A-Za-z]*[\/\-\s](\d{4})$/); if (m) return `${m[3]}-${String(MON.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};
const rcmDate = (iso) => { if (!iso) return ''; const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const [y, m, d] = iso.split('-'); return `${d}/${M[+m - 1]}/${y}`; };

const find = () => mine.find(b =>
  (params.reservationref && b.reservationRef === params.reservationref) ||
  (params.reservationno && String(b.reservationNo) === String(params.reservationno)));

if (ctx.method === 'agentbookings') {
  let rows;
  if (params.reservationno) rows = mine.filter(b => String(b.reservationNo) === String(params.reservationno));
  else {
    const from = toIso(params.startdate), to = toIso(params.enddate);
    if (!from || !to) return respond(null, 'Provide reservationno, or startdate and enddate');
    const status = String(params.bookingstatus || 'all').toLowerCase();
    const field = params.datefield === 'pickup' ? 'pickupDate' : 'createdDate';
    rows = mine.filter(b => b[field] >= from && b[field] <= to &&
      (status === 'all' || (status === 'confirmed' && ['confirmed', 'quote'].includes(b.status)) || b.status === status));
  }
  rows.sort((a, b) => String(b.createdDate).localeCompare(String(a.createdDate)) || Number(b.reservationNo) - Number(a.reservationNo));
  const map = { quote: 'CONFIRMED', onrequest: 'ONREQUEST', confirmed: 'CONFIRMED', cancelled: 'CANCELLED' };
  return respond(rows.map(b => ({
    bookingstatus: map[b.status] || String(b.status || '').toUpperCase(),
    reservationno: b.reservationNo,
    reservationref: b.reservationRef,
    originalreservationno: b.reservationNo,
    isquotation: !!b.isQuotation,
    pickupdate: rcmDate(b.pickupDate),
    dropoffdate: rcmDate(b.dropoffDate),
    reservationcreateddate: rcmDate(b.createdDate),
    pickuplocationcode: b.pickupName || '',
    dropofflocationcode: b.dropoffName || '',
    firstname: (b.customer || {}).firstname || '',
    lastname: (b.customer || {}).lastname || '',
    vehiclecategory: b.categoryName || '',
    totalcost: b.total,
    agentrefno: b.agentRefNo || ''
  })));
}

const b = find();
if (!b) return respond(null, 'Booking not found', 'NOT_FOUND');

if (ctx.method === 'bookinginfo') {
  return [{ json: { route: 'rcm', api: 'post', post: 'bookinginfo', method: 'bookinginfo', rcmBody: { method: 'bookinginfo', reservationref: b.reservationRef }, agency, user: ctx.user, booking: b } }];
}

if (ctx.method === 'cancelbooking') {
  if (agency.canCancel === false) return respond(null, 'Your agency is not set up to cancel bookings. Please contact Waka Campa.', 'FORBIDDEN');
  if (b.status === 'cancelled') return respond(null, 'Booking is already cancelled');
  if (!params.reasonid) return respond(null, 'reasonid is required');
  const body = { method: 'cancelbooking', reservationref: b.reservationRef, reasonid: Number(params.reasonid) };
  /* Older bookings were made under the agent in RCM, and RCM only finds those with the agent code. */
  if (b.rcmMode !== 'direct') body.agentcode = b.agentCode || agency.agentCode;
  if (params.cancelfeeid) body.cancelfeeid = Number(params.cancelfeeid);
  return [{ json: { route: 'rcm', api: 'web', post: 'cancel', method: 'cancelbooking', rcmBody: body, agency, user: ctx.user, booking: b } }];
}

return respond(null, 'Unsupported method');
