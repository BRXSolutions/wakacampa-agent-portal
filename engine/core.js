/*
 * Waka Campa Agent API engine.
 *
 * Pure functions, no I/O and no require(), so the same file runs in Node tests
 * and pasted into an n8n Code node. It reproduces the behaviour of RCM's
 * Booking API v3.2 (step1, step2, step3, calctotal, booking, bookinginfo,
 * agentbookings, cancelbooking) on top of a catalogue loaded from GHL.
 *
 * Output field names follow RCM's documented datasets so existing agent code
 * and the portal can switch with minimal change.
 */

const ENGINE_VERSION = '0.1.0';

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MS_DAY = 86400000;

/* Accepts 2026-11-03, 03/11/2026, 03/Nov/2026, 03-Nov-2026. Returns 'YYYY-MM-DD' or null. */
function parseDate(input) {
  if (input === undefined || input === null || input === '') return null;
  const s = String(input).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3})[A-Za-z]*[\/\-\s](\d{4})$/);
  if (m) {
    const mon = MONTHS.findIndex(x => x.toLowerCase() === m[2].toLowerCase()) + 1;
    return mon ? valid(+m[3], mon, +m[1]) : null;
  }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return valid(+m[3], +m[2], +m[1]);
  return null;

  function valid(y, mo, d) {
    const t = Date.UTC(y, mo - 1, d);
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
}

/* Accepts 9:00, 09:00, 0900, 9am. Returns 'HH:mm' or null. */
function parseTime(input) {
  if (input === undefined || input === null || input === '') return null;
  const s = String(input).trim().toLowerCase();
  let m = s.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const mi = m[2] ? +m[2] : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return `${pad(h)}:${pad(mi)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

/* Wall-clock minutes since epoch for a local date + time (no timezone maths: every
   location shares one timezone and RCM itself works in location wall-clock time). */
function wallMinutes(date, time) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) / 60000;
}

function addDays(date, n) {
  const [y, mo, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d) + n * MS_DAY);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function dayOfWeek(date) { /* 1 = Sunday ... 7 = Saturday, as RCM */
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 1;
}

function rcmDate(date) { /* dd/MMM/yyyy */
  if (!date) return '';
  const [y, mo, d] = date.split('-');
  return `${d}/${MONTHS[+mo - 1]}/${y}`;
}

function inRange(date, from, to) {
  return (!from || date >= from) && (!to || date <= to);
}

/* Current wall-clock date/time in a timezone, e.g. Pacific/Auckland. */
function nowIn(timezone, now) {
  const d = now ? new Date(now) : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hh}:${parts.minute}` };
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code || 'BAD_REQUEST'; }
}

function envelope(results, error, issues, started) {
  return {
    status: error ? 'ERR' : 'OK',
    error: error || '',
    results: error ? [] : results,
    issues: issues || [],
    ms: started ? Date.now() - started : 0
  };
}

/* ------------------------------------------------------------------ */
/* Catalogue helpers                                                   */
/* ------------------------------------------------------------------ */

function byId(list, id) { return (list || []).find(x => String(x.id) === String(id)); }

function appliesTo(fee, categoryId, categoryTypeId, locationId) {
  const cats = fee.categoryIds || [];
  const types = fee.categoryTypeIds || [];
  const locs = fee.locationIds || [];
  const catOk = (!cats.length && !types.length) || cats.map(String).includes(String(categoryId)) || types.map(String).includes(String(categoryTypeId));
  const locOk = !locs.length || locs.map(String).includes(String(locationId));
  return catOk && locOk;
}

function settings(cat) {
  return Object.assign({
    timezone: 'Pacific/Auckland',
    currencyName: 'NZD',
    currencySymbol: '$',
    taxName: 'GST',
    taxRate: 0.15,
    taxInclusive: true,
    dayCounting: 'calendar',   /* 'calendar' = pickup date to drop-off date inclusive (RCM's behaviour); '24h' = 24 hour blocks */
    graceMinutes: 59,          /* 24h mode only: return up to 59 min late without an extra day */
    turnaroundHours: 0,        /* gap needed between two hires of the same unit */
    limitedThreshold: 1        /* available = 2 when this many units or fewer remain */
  }, cat.settings || {});
}

/* ------------------------------------------------------------------ */
/* Request normalisation                                               */
/* ------------------------------------------------------------------ */

function normaliseSearch(req, cat) {
  const r = {
    pickupLocationId: req.pickuplocationid,
    dropoffLocationId: req.dropofflocationid,
    pickupDate: parseDate(req.pickupdate),
    pickupTime: parseTime(req.pickuptime),
    dropoffDate: parseDate(req.dropoffdate),
    dropoffTime: parseTime(req.dropofftime),
    ageId: req.ageid,
    categoryTypeIds: idList(req.vehiclecategorytypeid),
    categoryId: req.vehiclecategoryid,
    sipp: req.vehiclecategorysippcode,
    ratePeriod: Number(req.rateperiod_typeid || 0),
    campaignCode: req.campaigncode || ''
  };
  if (!byId(cat.locations, r.pickupLocationId)) throw new ApiError('Invalid pickuplocationid');
  if (!byId(cat.locations, r.dropoffLocationId)) throw new ApiError('Invalid dropofflocationid');
  if (!r.pickupDate) throw new ApiError('Invalid pickupdate');
  if (!r.dropoffDate) throw new ApiError('Invalid dropoffdate');
  if (!r.pickupTime) throw new ApiError('Invalid pickuptime');
  if (!r.dropoffTime) throw new ApiError('Invalid dropofftime');
  if (wallMinutes(r.dropoffDate, r.dropoffTime) <= wallMinutes(r.pickupDate, r.pickupTime)) {
    throw new ApiError('Dropoff must be after pickup');
  }
  if (r.ageId !== undefined && r.ageId !== null && r.ageId !== '' && !byId(cat.driverAges, r.ageId)) {
    throw new ApiError('Invalid ageid');
  }
  if (r.sipp && !r.categoryId) {
    const c = (cat.categories || []).find(x => String(x.sipp).toUpperCase() === String(r.sipp).toUpperCase());
    if (c) r.categoryId = c.id;
  }
  return r;
}

function idList(v) {
  if (v === undefined || v === null || v === '' || Number(v) === 0) return [];
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Days                                                                */
/* ------------------------------------------------------------------ */

function hireDays(r, cat) {
  const s = settings(cat);
  if (s.dayCounting === 'calendar') {
    const d = Math.round((wallMinutes(r.dropoffDate, '00:00') - wallMinutes(r.pickupDate, '00:00')) / 1440) + 1;
    return Math.max(1, d);
  }
  const mins = wallMinutes(r.dropoffDate, r.dropoffTime) - wallMinutes(r.pickupDate, r.pickupTime);
  const days = Math.ceil(Math.max(0, mins - s.graceMinutes) / 1440);
  return Math.max(1, days);
}

/* ------------------------------------------------------------------ */
/* Location validation (step2 locationfees)                            */
/* ------------------------------------------------------------------ */

function officeHoursFor(cat, locationId, date) {
  const dow = dayOfWeek(date);
  return (cat.officeHours || []).find(h => String(h.locationId) === String(locationId) && Number(h.dayOfWeek) === dow && inRange(date, h.startDate, h.endDate));
}

function holidayFor(cat, locationId, date, kind) {
  return (cat.holidays || []).find(h => {
    if (h.locationId && String(h.locationId) !== String(locationId)) return false;
    if (h.type && h.type !== kind && h.type !== 'B') return false;
    if (h.weekdays && Number(h.weekdays) !== dayOfWeek(date)) return false;
    return inRange(date, h.startDate, h.endDate);
  });
}

/* Returns one RCM locationfees row and any fee ids triggered (after hours, unattended). */
function checkLocation(cat, r, kind, now) {
  const isPickup = kind === 'P';
  const locId = isPickup ? r.pickupLocationId : r.dropoffLocationId;
  const date = isPickup ? r.pickupDate : r.dropoffDate;
  const time = isPickup ? r.pickupTime : r.dropoffTime;
  const loc = byId(cat.locations, locId);
  const s = settings(cat);
  const local = nowIn(loc.timezone || s.timezone, now);
  const row = {
    loctypeid: isPickup ? 1 : 2,
    loctype: isPickup ? 'pickup' : 'dropoff',
    locationid: loc.id,
    location: loc.name,
    currencyname: s.currencyName,
    currencysymbol: s.currencySymbol,
    locdate: rcmDate(date).replace(/\//g, '-'),
    loctime: time,
    dayofweekname: DAY_NAMES[dayOfWeek(date) - 1],
    locationdatetimenow: `${local.date}T${local.time}:00.000`,
    errorcode: 0,
    availablemessage: 'Available',
    isavailable: true,
    flightnumberrequired: !!loc.flightRequired
  };
  const feeIds = [];
  const fail = (code, msg) => { row.errorcode = code; row.availablemessage = msg; row.isavailable = false; };

  if (isPickup && loc.pickupAvailable === false) { fail(1, `Pickups are not available at ${loc.name}`); return { row, feeIds }; }
  if (!isPickup && loc.dropoffAvailable === false) { fail(1, `Drop-offs are not available at ${loc.name}`); return { row, feeIds }; }

  if (isPickup) {
    const notice = Number(loc.noticeDays || 0);
    const pickupMin = wallMinutes(date, time);
    const nowMin = wallMinutes(local.date, local.time);
    if (pickupMin < nowMin) { fail(2, 'Pickup date and time is in the past'); return { row, feeIds }; }
    if (notice > 0 && date < addDays(local.date, notice)) {
      fail(3, `${loc.name} needs ${notice} day${notice === 1 ? '' : 's'} notice for a booking`);
      return { row, feeIds };
    }
  }

  const hol = holidayFor(cat, locId, date, kind);
  if (hol && (!hol.closingTime || time > hol.closingTime)) {
    fail(4, `${loc.name} is closed${hol.closingTime ? ' after ' + hol.closingTime : ''} on ${hol.name || 'this holiday'}`);
    return { row, feeIds };
  }

  const hours = officeHoursFor(cat, locId, date);
  const open = hours ? (isPickup ? (hours.startPickup || hours.openingTime) : (hours.startDropoff || hours.openingTime)) : loc.officeOpeningTime;
  const close = hours ? (isPickup ? (hours.endPickup || hours.closingTime) : (hours.endDropoff || hours.closingTime)) : loc.officeClosingTime;
  const closedAllDay = hours && hours.closed;
  const outside = closedAllDay || (open && time < open) || (close && time > close);
  if (outside) {
    if (isPickup && loc.afterHoursAccepted) {
      if (loc.afterHoursFeeId) feeIds.push(loc.afterHoursFeeId);
      row.availablemessage = 'Available - after hours pickup fee applies';
    } else if (!isPickup && loc.unattendedDropoffAccepted) {
      if (loc.unattendedDropoffFeeId) feeIds.push(loc.unattendedDropoffFeeId);
      row.availablemessage = 'Available - unattended drop-off fee applies';
    } else {
      fail(5, closedAllDay ? `${loc.name} is closed on ${row.dayofweekname}` : `${loc.name} is open ${open} to ${close} for ${isPickup ? 'pickups' : 'drop-offs'}`);
    }
  }
  return { row, feeIds };
}

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

const BLOCKING = ['confirmed', 'onrequest', 'on request', 'reservation', 'hired', 'booking'];

function unitsBooked(bookings, categoryId, r, cat, excludeRef) {
  const s = settings(cat);
  const gap = Number(s.turnaroundHours || 0) * 60;
  const start = wallMinutes(r.pickupDate, r.pickupTime);
  const end = wallMinutes(r.dropoffDate, r.dropoffTime);
  return (bookings || []).filter(b => {
    if (String(b.categoryId) !== String(categoryId)) return false;
    if (excludeRef && b.reservationRef === excludeRef) return false;
    if (b.isQuotation) return false;
    if (!BLOCKING.includes(String(b.status || '').toLowerCase())) return false;
    const bs = wallMinutes(b.pickupDate, b.pickupTime);
    const be = wallMinutes(b.dropoffDate, b.dropoffTime);
    return bs < end + gap && be + gap > start;
  }).length;
}

/* ------------------------------------------------------------------ */
/* Rates                                                               */
/* ------------------------------------------------------------------ */

/* Picks the rate row for a category on one date, honouring min/max day bands. */
function rateFor(cat, categoryId, date, totalDays, period) {
  const rows = (cat.rates || []).filter(x =>
    String(x.categoryId) === String(categoryId) &&
    (x.period || 'day') === period &&
    inRange(date, x.startDate, x.endDate) &&
    (!x.minDays || totalDays >= Number(x.minDays)) &&
    (!x.maxDays || totalDays <= Number(x.maxDays)));
  /* most specific band wins: highest minDays */
  rows.sort((a, b) => Number(b.minDays || 0) - Number(a.minDays || 0));
  return rows[0];
}

function discounted(rate, row) {
  const d = Number(row.discountRate || 0);
  if (!d) return rate;
  const t = String(row.discountType || '').toLowerCase();
  if (t === 'percentage') return rate * (1 - d / 100);
  if (t === 'daily') return Math.max(0, rate - d);
  return rate;
}

/*
 * Prices the rental part of a hire. Each hire day takes the rate of the season it
 * falls in; consecutive days in the same season form one seasonalrates row (RCM
 * behaviour). Weekly / monthly rates apply when rateperiod_typeid asks for them and
 * every day of the hire sits in one season.
 */
function priceRental(cat, categoryId, r, days) {
  const perDay = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(r.pickupDate, i);
    const row = rateFor(cat, categoryId, date, days, 'day');
    if (!row) return null;
    perDay.push({ date, row });
  }

  const seasons = [];
  for (const d of perDay) {
    const last = seasons[seasons.length - 1];
    if (last && last.row === d.row) last.days += 1;
    else seasons.push({ row: d.row, days: 1 });
  }

  const usePeriod = r.ratePeriod === 2 ? 'week' : r.ratePeriod === 1 ? 'month' : null;
  const periodLen = usePeriod === 'week' ? 7 : usePeriod === 'month' ? 30 : 0;
  let periodRow = null;
  if (usePeriod && seasons.length === 1 && days >= periodLen) {
    periodRow = rateFor(cat, categoryId, r.pickupDate, days, usePeriod);
  }

  const seasonal = [];
  let before = 0, after = 0, fixedDiscount = 0;
  if (periodRow) {
    const n = Math.floor(days / periodLen);
    const rem = days - n * periodLen;
    const dailyRow = seasons[0].row;
    const pRate = discounted(Number(periodRow.rate), periodRow);
    const dRate = discounted(Number(dailyRow.rate), dailyRow);
    const subtotal = n * pRate + rem * dRate;
    before += n * Number(periodRow.rate) + rem * Number(dailyRow.rate);
    after += subtotal;
    seasonal.push({
      vehiclecategoryid: categoryId,
      season: periodRow.season || dailyRow.season || '',
      rateperiod: usePeriod === 'week' ? 'Week' : 'Month',
      rateperiod_number: n,
      rateperiod_rateafterdiscount: round2(pRate),
      rateperiod_remainingnumberofdays: rem,
      rateperiod_dailyrateafterdiscountforremainingdays: round2(dRate),
      numberofhours: 0,
      numberofdays: days,
      dailyratebeforediscount: round2(Number(dailyRow.rate)),
      dailyrateafterdiscount: round2(dRate),
      ratesubtotal: round2(subtotal),
      discounttype: periodRow.discountType || '',
      discountrate: Number(periodRow.discountRate || 0)
    });
  } else {
    for (const s of seasons) {
      const base = Number(s.row.rate);
      const rate = discounted(base, s.row);
      before += base * s.days;
      after += rate * s.days;
      if (String(s.row.discountType || '').toLowerCase() === 'fixed') fixedDiscount += Number(s.row.discountRate || 0);
      seasonal.push({
        vehiclecategoryid: categoryId,
        season: s.row.season || '',
        rateperiod: 'Day',
        rateperiod_number: s.days,
        rateperiod_rateafterdiscount: round2(rate),
        rateperiod_remainingnumberofdays: 0,
        rateperiod_dailyrateafterdiscountforremainingdays: 0,
        numberofhours: 0,
        numberofdays: s.days,
        dailyratebeforediscount: round2(base),
        dailyrateafterdiscount: round2(rate),
        ratesubtotal: round2(rate * s.days),
        discounttype: s.row.discountType || '',
        discountrate: Number(s.row.discountRate || 0)
      });
    }
  }
  after = Math.max(0, after - fixedDiscount);
  return {
    seasonal,
    totalBefore: round2(before),
    totalAfter: round2(after),
    discount: round2(before - after),
    avgRate: round2(after / days),
    discountType: seasonal.length === 1 ? seasonal[0].discounttype : (seasonal.some(x => x.discounttype) ? 'mixed' : '')
  };
}

/* ------------------------------------------------------------------ */
/* Fees                                                                */
/* ------------------------------------------------------------------ */

/* Amount of one fee for a hire, before percentage fees. qty defaults to 1. */
function feeAmount(fee, days, qty) {
  const q = Number(qty || 1);
  const amt = Number(fee.amount || 0);
  const type = String(fee.type || 'Fixed').toLowerCase();
  let total;
  if (type === 'daily') total = amt * days;
  else if (type === 'fixed') total = amt;
  else return null; /* percentage: computed later */
  if (fee.maxPrice && Number(fee.maxPrice) > 0) total = Math.min(total, Number(fee.maxPrice));
  return round2(total * q);
}

function feeRowCommon(fee, days) {
  return {
    id: fee.id,
    vehiclecategorytypeid: (fee.categoryTypeIds || [])[0] || 0,
    vehiclecategoryid: (fee.categoryIds || [])[0] || 0,
    numberofdays: days,
    fees: Number(fee.amount || 0),
    name: fee.name,
    type: fee.type || 'Fixed',
    maximumprice: Number(fee.maxPrice || 0),
    stampduty: false,
    gst: true,
    ispercentageontotalcost: !!fee.percentOnTotal,
    feedescription: fee.description || '',
    feedescription1: fee.description1 || '',
    feedescription2: fee.description2 || '',
    feedescription3: fee.description3 || ''
  };
}

function mandatoryFeesFor(cat, category, r, days, triggeredIds) {
  const list = [];
  for (const fee of cat.fees || []) {
    const kind = fee.kind;
    let include = false;
    if (kind === 'mandatory') include = appliesTo(fee, category.id, category.typeId, r.pickupLocationId);
    else if (kind === 'oneway') {
      include = String(r.pickupLocationId) !== String(r.dropoffLocationId) &&
        (!fee.fromLocationId || String(fee.fromLocationId) === String(r.pickupLocationId)) &&
        (!fee.toLocationId || String(fee.toLocationId) === String(r.dropoffLocationId)) &&
        appliesTo(Object.assign({}, fee, { locationIds: [] }), category.id, category.typeId, r.pickupLocationId);
    } else if (triggeredIds.map(String).includes(String(fee.id))) include = true;
    if (!include) continue;
    if (fee.minDays && days < Number(fee.minDays)) continue;
    if (fee.maxDays && days > Number(fee.maxDays)) continue;
    const qty = 1;
    list.push(Object.assign(feeRowCommon(fee, days), {
      qty,
      totalfeeamount: feeAmount(fee, days, qty),
      merchantfee: !!fee.merchantFee,
      _fee: fee
    }));
  }
  return list;
}

function optionalFeesFor(cat, category, r, days) {
  return (cat.fees || []).filter(f => f.kind === 'optional' && appliesTo(f, category.id, category.typeId, r.pickupLocationId)).map(fee =>
    Object.assign(feeRowCommon(fee, days), {
      locationid: (fee.locationIds || [])[0] || 0,
      displayorder: String(fee.displayOrder || 0),
      feegroupid: fee.groupId || 0,
      feegroupname: fee.groupName || '',
      payagency: !!fee.payAgency,
      totalfeeamount: feeAmount(fee, days, 1),
      merchantfee: !!fee.merchantFee,
      qtyapply: !!fee.qtyApply,
      maxqty: Number(fee.maxQty || (fee.qtyApply ? 10 : 1)),
      _fee: fee
    })).sort((a, b) => Number(a.displayorder) - Number(b.displayorder));
}

function insuranceOptionsFor(cat, category, r, days) {
  return (cat.fees || []).filter(f => f.kind === 'insurance' && appliesTo(f, category.id, category.typeId, r.pickupLocationId)).map(fee =>
    Object.assign(feeRowCommon(fee, days), {
      totalinsuranceamount: feeAmount(fee, days, 1),
      payagency: !!fee.payAgency,
      excessamount: Number(fee.excessAmount || 0),
      isdefault: !!fee.isDefault,
      _fee: fee
    }));
}

function kmChargesFor(cat, category, r, days) {
  const s = settings(cat);
  return (cat.fees || []).filter(f => f.kind === 'km' && appliesTo(f, category.id, category.typeId, r.pickupLocationId)).map(fee => ({
    id: fee.id,
    vehiclecategorytypeid: category.typeId,
    numberofdays: days,
    mileagedesc: s.mileageDesc || 'kilometres',
    description: fee.name,
    totalamount: feeAmount(fee, days, 1),
    numberofkmsfree: Number(fee.kmsFreePerDay || 0),
    feeforeachadditionalkm: Number(fee.perExtraKm || 0),
    isdefault: !!fee.isDefault,
    maximumprice: Number(fee.maxPrice || 0),
    dailyrate: String(fee.type || '').toLowerCase() === 'daily' ? Number(fee.amount || 0) : 0,
    notes: fee.description || '',
    _fee: fee
  }));
}

function strip(rows) { return rows.map(r => { const o = Object.assign({}, r); delete o._fee; return o; }); }

/* ------------------------------------------------------------------ */
/* Category evaluation                                                 */
/* ------------------------------------------------------------------ */

function evaluateCategory(cat, category, r, days, bookings, locationOk, triggeredIds) {
  const age = byId(cat.driverAges, r.ageId);
  const units = Number(category.units || 0);
  const booked = unitsBooked(bookings, category.id, r, cat);
  const remaining = units - booked;
  const s = settings(cat);
  const out = {
    vehiclecategorytypeid: category.typeId,
    vehiclecategoryid: category.id,
    available: 1,
    availablemessage: 'Available',
    errorcode: 0,
    minimumbookingday: Number(category.minDays || 1),
    minimumage: Number(category.minAge || 0),
    maximumage: Number(category.maxAge || 0),
    vehiclecategory: category.name,
    categoryfriendlydescription: category.friendlyDescription || category.name,
    numberofhours: 0,
    hourlyrate: 0,
    numberofdays: days,
    imageurl: category.imageUrl || '',
    numberofadults: Number(category.adults || 0),
    numberofchildren: Number(category.children || 0),
    numberoflargecases: Number(category.largeCases || 0),
    numberofsmallcases: Number(category.smallCases || 0),
    sippcode: category.sipp || '',
    vehicledescription1: category.description1 || '',
    vehicledescription2: category.description2 || '',
    vehicledescription3: category.description3 || '',
    vehicledescriptionurl: category.descriptionUrl || '',
    numbervehiclesavailable: Math.max(0, remaining)
  };
  const fail = (code, msg) => { out.available = 0; out.errorcode = code; out.availablemessage = msg; };

  const pickupLoc = byId(cat.locations, r.pickupLocationId);
  const minDays = Math.max(Number(category.minDays || 1), Number(pickupLoc.minBookingDays || 1));
  const price = priceRental(cat, category.id, r, days);

  if (!locationOk) fail(10, 'Location not available for the selected dates and times');
  else if (days < minDays) fail(12, `Minimum hire is ${minDays} days`);
  else if (!price) fail(11, 'No rate set for these dates');
  else if (age && category.minAge && Number(age.driverAge) < Number(category.minAge)) fail(13, `Minimum driver age is ${category.minAge}`);
  else if (age && category.maxAge && Number(age.driverAge) > Number(category.maxAge)) fail(14, `Maximum driver age is ${category.maxAge}`);
  else if (age && pickupLoc.minimumAge && Number(age.driverAge) < Number(pickupLoc.minimumAge)) fail(15, `Minimum driver age at ${pickupLoc.name} is ${pickupLoc.minimumAge}`);
  else if (remaining <= 0) fail(16, 'Sold out for these dates');
  else if (remaining <= s.limitedThreshold) { out.available = 2; out.availablemessage = 'Limited availability'; }

  if (price) {
    Object.assign(out, {
      avgrate: price.avgRate,
      totalratebeforediscount: price.totalBefore,
      discounteddailyrate: price.avgRate,
      totalrateafterdiscount: price.totalAfter,
      totaldiscountamount: price.discount,
      discountrate: price.seasonal.length === 1 ? price.seasonal[0].discountrate : 0,
      discounttype: price.discountType,
      discountname: '',
      freedays: 0,
      freedaysamount: 0
    });
  } else {
    Object.assign(out, { avgrate: 0, totalratebeforediscount: 0, discounteddailyrate: 0, totalrateafterdiscount: 0, totaldiscountamount: 0, discountrate: 0, discounttype: '', discountname: '', freedays: 0, freedaysamount: 0 });
  }
  return { out, price, mandatory: mandatoryFeesFor(cat, category, r, days, triggeredIds) };
}

/* ------------------------------------------------------------------ */
/* Public methods                                                      */
/* ------------------------------------------------------------------ */

function locationRow(l) {
  return {
    id: l.id,
    location: l.name,
    isdefault: !!l.isDefault,
    ispickupavailable: l.pickupAvailable !== false,
    isdropoffavailable: l.dropoffAvailable !== false,
    isflightinrequired: !!l.flightRequired,
    minimumbookingday: Number(l.minBookingDays || 1),
    noticerequired_numberofdays: Number(l.noticeDays || 0),
    quoteisvalid_numberofdays: Number(l.quoteValidDays || 7),
    officeopeningtime: l.officeOpeningTime || '',
    officeclosingtime: l.officeClosingTime || '',
    afterhourbookingaccepted: !!l.afterHoursAccepted,
    afterhourfeeid: l.afterHoursFeeId || 0,
    unattendeddropoffaccepted: !!l.unattendedDropoffAccepted,
    unattendeddropofffeeid: l.unattendedDropoffFeeId || 0,
    minimumage: Number(l.minimumAge || 0),
    phone: l.phone || '',
    email: l.email || ''
  };
}

function locationDetailRow(l) {
  return Object.assign(locationRow(l), {
    address: l.address || '', city: l.city || '', suburb: l.suburb || '', postcode: l.postcode || '',
    state: l.state || '', country: l.country || '', freecalllocal: l.freecall || '', fax: '',
    airportcodeid: l.airportCode || '', mapurl: l.mapUrl || '', webdescription: l.webDescription || ''
  });
}

function step1(cat) {
  return {
    locations: (cat.locations || []).map(locationRow),
    officetimes: (cat.officeHours || []).map(h => ({
      locationid: h.locationId, dayofweek: Number(h.dayOfWeek),
      openingtime: h.openingTime || '', closingtime: h.closingTime || '',
      startpickup: h.startPickup || h.openingTime || '', endpickup: h.endPickup || h.closingTime || '',
      startdropoff: h.startDropoff || h.openingTime || '', enddropoff: h.endDropoff || h.closingTime || '',
      startdate: rcmDate(h.startDate || '1900-01-01'), enddate: rcmDate(h.endDate || '2100-01-01')
    })),
    categorytypes: categoryTypes(cat),
    driverages: driverAges(cat),
    holidays: (cat.holidays || []).map(h => ({
      id: h.id, locationid: h.locationId || 0, startdate: rcmDate(h.startDate), enddate: rcmDate(h.endDate),
      type: h.type || 'B', weekdays: h.weekdays || 0, holidayname: h.name || '', closingtime: h.closingTime || ''
    }))
  };
}

function categoryTypes(cat, id) {
  return (cat.categoryTypes || []).filter(t => !id || String(t.id) === String(id))
    .map(t => ({ id: t.id, vehiclecategorytype: t.name, displayorder: String(t.displayOrder || 0) }));
}

function driverAges(cat, id) {
  return (cat.driverAges || []).filter(a => !id || String(a.id) === String(id))
    .map(a => ({ id: a.id, driverage: Number(a.driverAge), isdefault: !!a.isDefault }));
}

function categoryList(cat) {
  return (cat.categories || []).map(c => {
    const t = byId(cat.categoryTypes, c.typeId) || {};
    return {
      id: c.id, vehiclecategorytypeid: c.typeId, categorytype: t.name || '', vehiclecategoryname: c.name,
      description: c.friendlyDescription || '', numberofadults: Number(c.adults || 0), numberofchildren: Number(c.children || 0),
      numberoflargecases: Number(c.largeCases || 0), numberofsmallcases: Number(c.smallCases || 0),
      vehicledescription1: c.description1 || '', vehicledescription2: c.description2 || '', vehicledescription3: c.description3 || '',
      vehicledescriptionurl: c.descriptionUrl || '', imageurl: c.imageUrl || '', sippcode: c.sipp || ''
    };
  });
}

function step2(cat, bookings, req, now) {
  const r = normaliseSearch(req, cat);
  const days = hireDays(r, cat);
  const p = checkLocation(cat, r, 'P', now);
  const d = checkLocation(cat, r, 'D', now);
  const locationOk = p.row.isavailable && d.row.isavailable;
  const triggered = p.feeIds.concat(d.feeIds);
  const cats = (cat.categories || []).filter(c => c.active !== false && (!r.categoryTypeIds.length || r.categoryTypeIds.map(String).includes(String(c.typeId))));
  const s1 = step1(cat);
  const availablecars = [], seasonalrates = [], mandatoryfees = [], locationfees = [];
  for (const c of cats) {
    const ev = evaluateCategory(cat, c, r, days, bookings, locationOk, triggered);
    availablecars.push(ev.out);
    if (ev.price) ev.price.seasonal.forEach(x => seasonalrates.push(Object.assign({ vehiclecategorytypeid: c.typeId }, x)));
    strip(ev.mandatory).forEach(m => mandatoryfees.push(Object.assign({}, m, { vehiclecategoryid: c.id, vehiclecategorytypeid: c.typeId })));
    locationfees.push(Object.assign({ vehiclecategorytypeid: c.typeId }, p.row));
    locationfees.push(Object.assign({ vehiclecategorytypeid: c.typeId }, d.row));
  }
  availablecars.sort((a, b) => (b.available > 0) - (a.available > 0) || a.totalrateafterdiscount - b.totalrateafterdiscount);
  return {
    locations: s1.locations, officetimes: s1.officetimes, categorytypes: s1.categorytypes, driverages: s1.driverages, holidays: s1.holidays,
    locationfees: dedupeLocationFees(locationfees),
    seasonalrates, availablecars, mandatoryfees,
    optionalfees: [], insuranceoptions: [], kmcharges: [],
    taxinclusive: settings(cat).taxInclusive, taxrate: settings(cat).taxRate, statetax: 0,
    availablecars_p: [], mandatoryfees_p: [], insuranceoptions_p: [], kmcharges_p: [], availablecars_altrates: []
  };
}

function dedupeLocationFees(rows) {
  const seen = new Set();
  return rows.filter(x => { const k = x.vehiclecategorytypeid + ':' + x.loctypeid; if (seen.has(k)) return false; seen.add(k); return true; });
}

function step3(cat, bookings, req, now) {
  const r = normaliseSearch(req, cat);
  const category = byId(cat.categories, r.categoryId);
  if (!category) throw new ApiError('Invalid vehiclecategoryid');
  const days = hireDays(r, cat);
  const p = checkLocation(cat, r, 'P', now);
  const d = checkLocation(cat, r, 'D', now);
  const locationOk = p.row.isavailable && d.row.isavailable;
  const ev = evaluateCategory(cat, category, r, days, bookings, locationOk, p.feeIds.concat(d.feeIds));
  const s = settings(cat);
  return {
    driverages: driverAges(cat),
    countries: countries(cat),
    areaofuse: cat.areaOfUse || [],
    rentalsource: cat.rentalSources || [],
    tender_types: [],
    locationfees: [Object.assign({ vehiclecategorytypeid: category.typeId }, p.row), Object.assign({ vehiclecategorytypeid: category.typeId }, d.row)],
    seasonalrates: ev.price ? ev.price.seasonal.map(x => Object.assign({ vehiclecategorytypeid: category.typeId }, x)) : [],
    availablecars: [ev.out],
    mandatoryfees: strip(ev.mandatory),
    optionalfees: strip(optionalFeesFor(cat, category, r, days)),
    insuranceoptions: strip(insuranceOptionsFor(cat, category, r, days)),
    kmcharges: strip(kmChargesFor(cat, category, r, days)),
    taxinclusive: s.taxInclusive,
    taxrate: s.taxRate,
    statetax: 0
  };
}

function countries(cat) {
  return (cat.countries || []).map(c => ({ id: c.id, country: c.name, isdefault: !!c.isDefault }));
}

/*
 * Full price of a selection. Used by calctotal (agent-facing) and by booking
 * (to recompute the price server-side, never trusting the client).
 * selection: { insuranceid, extrakmsid, optionalfees: [{id, qty}] }
 */
function priceSelection(cat, bookings, req, now, opts) {
  const options = opts || {};
  const r = normaliseSearch(req, cat);
  const category = byId(cat.categories, r.categoryId);
  if (!category) throw new ApiError('Invalid vehiclecategoryid');
  const days = hireDays(r, cat);
  const p = checkLocation(cat, r, 'P', now);
  const d = checkLocation(cat, r, 'D', now);
  const locationOk = p.row.isavailable && d.row.isavailable;
  const ev = evaluateCategory(cat, category, r, days, options.ignoreAvailability ? [] : bookings, locationOk, p.feeIds.concat(d.feeIds));
  if (!ev.price) throw new ApiError(ev.out.availablemessage);

  const s = settings(cat);
  const lines = [];
  const rental = ev.price.totalAfter;
  lines.push({ type: 'total rate', id: 0, name: `${days} days ${category.name}`, qty: 1, total: rental, payAgency: true });

  ev.mandatory.forEach(m => lines.push({ type: 'mandatory', id: m.id, name: m.name, qty: m.qty, total: m.totalfeeamount, fee: m._fee, payAgency: !!m._fee.payAgency }));

  const optional = optionalFeesFor(cat, category, r, days);
  const chosen = parseFeeList(req.optionalfees);
  for (const c of chosen) {
    const row = optional.find(o => String(o.id) === String(c.id));
    if (!row) throw new ApiError(`Optional fee ${c.id} is not available for this vehicle`);
    const qty = row.qtyapply ? Math.max(1, Math.min(Number(c.qty || 1), row.maxqty)) : 1;
    lines.push({ type: 'optional', id: row.id, name: row.name, qty, total: feeAmount(row._fee, days, qty), fee: row._fee, payAgency: !!row._fee.payAgency });
  }

  const ins = insuranceOptionsFor(cat, category, r, days);
  const insChoice = req.insuranceid !== undefined && req.insuranceid !== '' && Number(req.insuranceid) !== 0
    ? ins.find(i => String(i.id) === String(req.insuranceid)) : ins.find(i => i.isdefault);
  if (req.insuranceid && Number(req.insuranceid) !== 0 && !insChoice) throw new ApiError('Invalid insuranceid');
  if (insChoice) lines.push({ type: 'insurance', id: insChoice.id, name: insChoice.name, qty: 1, total: feeAmount(insChoice._fee, days, 1), fee: insChoice._fee, payAgency: !!insChoice._fee.payAgency, excess: insChoice.excessamount });

  const kms = kmChargesFor(cat, category, r, days);
  const kmChoice = req.extrakmsid !== undefined && req.extrakmsid !== '' && Number(req.extrakmsid) !== 0
    ? kms.find(k => String(k.id) === String(req.extrakmsid)) : kms.find(k => k.isdefault);
  if (req.extrakmsid && Number(req.extrakmsid) !== 0 && !kmChoice) throw new ApiError('Invalid extrakmsid');
  if (kmChoice && kmChoice.totalamount) lines.push({ type: 'kmsrate', id: kmChoice.id, name: kmChoice.description, qty: 1, total: kmChoice.totalamount, fee: kmChoice._fee, payAgency: false });

  /* percentage fees last: on rental only, or on everything so far */
  const fixedTotal = lines.reduce((a, l) => a + (l.total || 0), 0);
  for (const l of lines) {
    if (l.fee && String(l.fee.type).toLowerCase() === 'percentage') {
      const basis = l.fee.percentOnTotal ? fixedTotal : rental;
      let amt = basis * Number(l.fee.amount || 0) / 100;
      if (l.fee.maxPrice && Number(l.fee.maxPrice) > 0) amt = Math.min(amt, Number(l.fee.maxPrice));
      l.total = round2(amt * (l.qty || 1));
    }
  }

  const total = round2(lines.reduce((a, l) => a + (l.total || 0), 0));
  const tax = s.taxInclusive ? round2(total * s.taxRate / (1 + s.taxRate)) : round2(total * s.taxRate);
  const grand = s.taxInclusive ? total : round2(total + tax);

  return {
    r, category, days, price: ev.price, availability: ev.out, lines, total: grand, tax, taxName: s.taxName,
    locationOk, pickupRow: p.row, dropoffRow: d.row
  };
}

function parseFeeList(v) {
  if (!v) return [];
  let list = v;
  if (typeof v === 'string') {
    try { list = JSON.parse(v.replace(/'/g, '"')); } catch (e) { throw new ApiError('optionalfees must be a JSON array like [{"id":1,"qty":1}]'); }
  }
  if (!Array.isArray(list)) throw new ApiError('optionalfees must be an array');
  return list.filter(x => x && x.id !== undefined);
}

function calctotal(cat, bookings, req, now) {
  const q = priceSelection(cat, bookings, req, now, { ignoreAvailability: true });
  const rows = q.lines.map(l => ({ type: l.type, id: l.id, name: l.name, qty: l.qty, total: l.total }));
  rows.push({ type: 'total', id: 0, name: 'TOTAL', qty: 0, total: q.total });
  rows.push({ type: 'country tax', id: 0, name: (settings(cat).taxInclusive ? 'include ' : '') + q.taxName, qty: 0, total: q.tax });
  return { totals: rows };
}

/* ------------------------------------------------------------------ */
/* Agency, commission                                                  */
/* ------------------------------------------------------------------ */

function commissionFor(agency, lines) {
  const pct = Number(agency.commissionPct || 0) / 100;
  if (!pct) return 0;
  const base = lines.reduce((a, l) => {
    if (l.type === 'total rate') return a + l.total;
    if (agency.commissionOnFees && l.payAgency) return a + l.total;
    return a;
  }, 0);
  return round2(base * pct);
}

/* ------------------------------------------------------------------ */
/* Booking                                                             */
/* ------------------------------------------------------------------ */

const REQUIRED_CUSTOMER = ['lastname', 'email'];

function parseCustomer(v, label) {
  let c = v;
  if (typeof v === 'string') { try { c = JSON.parse(v); } catch (e) { throw new ApiError(`${label} must be JSON`); } }
  if (!c || typeof c !== 'object') throw new ApiError(`${label} is required`);
  for (const f of REQUIRED_CUSTOMER) if (!c[f] || !String(c[f]).trim()) throw new ApiError(`${label}.${f} is required`);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c.email).trim())) throw new ApiError(`${label}.email is not valid`);
  const out = {};
  ['firstname', 'lastname', 'email', 'dateofbirth', 'address', 'city', 'state', 'postcode', 'countryid', 'phone', 'mobile',
    'licenseno', 'licenseissued', 'licenseexpires', 'passport', 'companycode'].forEach(k => { if (c[k] !== undefined && c[k] !== null) out[k] = String(c[k]).trim(); });
  return out;
}

function isDoNotRent(cat, customer) {
  const list = cat.doNotRent || [];
  const email = String(customer.email || '').toLowerCase();
  const lic = String(customer.licenseno || '').toUpperCase().replace(/\s/g, '');
  return list.some(x =>
    (x.email && email && String(x.email).toLowerCase() === email) ||
    (x.licenseNo && lic && String(x.licenseNo).toUpperCase().replace(/\s/g, '') === lic) ||
    (x.lastName && x.dateOfBirth && customer.dateofbirth &&
      String(x.lastName).toLowerCase() === String(customer.lastname).toLowerCase() &&
      parseDate(x.dateOfBirth) === parseDate(customer.dateofbirth)));
}

/*
 * Validates and prices a booking request. Returns the record to persist in GHL.
 * The caller (n8n) assigns booking number and reservation ref, writes it, and only
 * then answers the agent. Run under single-flight so the availability check and
 * the write cannot interleave with another booking.
 */
function prepareBooking(cat, bookings, req, agency, now) {
  if (!agency || !agency.id) throw new ApiError('Agency not resolved', 'AUTH');
  const bookingType = Number(req.bookingtype || 2);
  if (![1, 2].includes(bookingType)) throw new ApiError('bookingtype must be 1 (quote) or 2 (booking)');
  const customer = parseCustomer(req.customer, 'customer');
  const extraDrivers = req.extradriver ? [].concat(typeof req.extradriver === 'string' ? JSON.parse(req.extradriver) : req.extradriver).map((c, i) => parseCustomer(c, `extradriver[${i}]`)) : [];
  if (isDoNotRent(cat, customer)) throw new ApiError('Unable to complete this booking. Please contact Waka Campa.', 'DO_NOT_RENT');

  const q = priceSelection(cat, bookings, req, now, { ignoreAvailability: bookingType === 1 });
  if (!q.locationOk) throw new ApiError([q.pickupRow, q.dropoffRow].filter(x => !x.isavailable).map(x => x.availablemessage).join('; '));
  if (q.availability.available === 0) throw new ApiError(q.availability.availablemessage, 'UNAVAILABLE');
  const pickupLoc = byId(cat.locations, q.r.pickupLocationId);
  if (pickupLoc.flightRequired && !req.flightin) throw new ApiError('flightin is required for this pickup location');

  if (req.expectedtotal !== undefined && req.expectedtotal !== null && req.expectedtotal !== '' && Math.abs(Number(req.expectedtotal) - q.total) > 0.009) {
    throw new ApiError(`The price changed from ${req.expectedtotal} to ${q.total}. Please review and try again.`, 'PRICE_CHANGED');
  }

  const commission = commissionFor(agency, q.lines);
  const collected = req.agentcollectedamount !== undefined && req.agentcollectedamount !== '' && agency.allowCollected
    ? round2(Number(req.agentcollectedamount)) : 0;
  const onRequest = agency.bookingsOnRequest === true;
  const s = settings(cat);

  return {
    status: bookingType === 1 ? 'quote' : (onRequest ? 'onrequest' : 'confirmed'),
    isQuotation: bookingType === 1,
    bookingType,
    agencyId: agency.id,
    agencyName: agency.name || '',
    agentCode: agency.agentCode || '',
    agentName: String(req.agentname || '').slice(0, 20),
    agentEmail: String(req.agentemail || '').slice(0, 50),
    agentRefNo: String(req.agentrefno || '').slice(0, 50),
    categoryId: q.category.id,
    categoryName: q.category.name,
    categoryTypeId: q.category.typeId,
    pickupLocationId: q.r.pickupLocationId,
    pickupDate: q.r.pickupDate,
    pickupTime: q.r.pickupTime,
    dropoffLocationId: q.r.dropoffLocationId,
    dropoffDate: q.r.dropoffDate,
    dropoffTime: q.r.dropoffTime,
    ageId: q.r.ageId,
    days: q.days,
    transmission: Number(req.transmission || 0),
    numberTravelling: req.numbertravelling ? Number(req.numbertravelling) : null,
    flightIn: req.flightin || '',
    flightOut: req.flightout || '',
    arrivalPoint: req.arrivalpoint || '',
    departurePoint: req.departurepoint || '',
    remark: String(req.remark || '').slice(0, 250),
    emailOption: Number(req.emailoption === undefined ? 1 : req.emailoption),
    customer,
    extraDrivers,
    lines: q.lines.map(l => ({ type: l.type, id: l.id, name: l.name, qty: l.qty, total: l.total, payAgency: !!l.payAgency, excess: l.excess || 0 })),
    seasonal: q.price.seasonal,
    dailyRate: q.price.avgRate,
    rentalTotal: q.price.totalAfter,
    total: q.total,
    tax: q.tax,
    taxName: q.taxName,
    currency: s.currencyName,
    commission,
    agentCollected: collected,
    netDue: round2(q.total - commission - collected),
    balanceDue: round2(q.total - collected),
    quoteValidDays: Number(pickupLoc.quoteValidDays || 7),
    source: 'agent_portal',
    engineVersion: ENGINE_VERSION
  };
}

/* Booking number + reference generation. seq comes from n8n static data. */
function makeReservationRef(seq, now) {
  const t = (now ? new Date(now) : new Date()).getTime().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1679616).toString(36).toUpperCase().padStart(4, '0');
  return `WC${t}${rand}`;
}

/* ------------------------------------------------------------------ */
/* bookinginfo / agentbookings output                                  */
/* ------------------------------------------------------------------ */

function bookingInfo(cat, b, agency) {
  const pl = byId(cat.locations, b.pickupLocationId) || {};
  const dl = byId(cat.locations, b.dropoffLocationId) || {};
  const c = byId(cat.categories, b.categoryId) || {};
  const s = settings(cat);
  const cust = b.customer || {};
  const statusMap = { quote: 'Reservation', onrequest: 'Reservation Request', confirmed: 'Reservation', cancelled: 'Cancelled', hired: 'Hired', returned: 'Returned' };
  const ins = (b.lines || []).find(l => l.type === 'insurance');
  return {
    bookinginfo: [{
      reservationref: b.reservationRef,
      reservationno: b.reservationNo,
      reservationdocumentno: `WC-${b.reservationNo}`,
      reservationstatus: statusMap[b.status] || b.status,
      isonrequest: b.status === 'onrequest',
      reservationtypedescription: b.isQuotation ? 'Agent Quotation' : 'Agent Reservation',
      reservationcreateddate: rcmDate(b.createdDate),
      isvehicleallocated: !!b.vehicleRego,
      isquotation: !!b.isQuotation,
      isvalidquotation: b.isQuotation ? (!b.quoteExpiry || b.quoteExpiry >= nowIn(s.timezone).date) : false,
      quoteconversionvalidmessage: b.isQuotation && b.quoteExpiry ? `Quote valid until ${rcmDate(b.quoteExpiry)}` : '',
      driverageid: b.ageId,
      pickuplocationid: b.pickupLocationId,
      pickupdate: rcmDate(b.pickupDate),
      pickuptime: b.pickupTime,
      pickuplocationname: pl.name || '',
      pickuplocationaddress: pl.address || '',
      arrivalpoint: b.arrivalPoint || '',
      flightin: b.flightIn || '',
      dropofflocationid: b.dropoffLocationId,
      dropoffdate: rcmDate(b.dropoffDate),
      dropofftime: b.dropoffTime,
      dropofflocationname: dl.name || '',
      dropofflocationaddress: dl.address || '',
      departurepoint: b.departurePoint || '',
      flightout: b.flightOut || '',
      rentalsource: 'Agent portal',
      customerid: b.contactId || '',
      customerremark: b.remark || '',
      numbertravelling: b.numberTravelling ? String(b.numberTravelling) : '',
      transmission: ['No preference', 'Auto', 'Manual'][b.transmission || 0],
      vehiclecategoryid: b.categoryId,
      vehiclecategory: b.categoryName || c.name || '',
      vehicleimage: c.imageUrl || '',
      vehicledescription1: c.description1 || '',
      vehicle_numberofadults: Number(c.adults || 0),
      vehicle_numberofchildren: Number(c.children || 0),
      vehicle_registrationnumber: b.vehicleRego || '',
      currencyname: s.currencyName,
      currencysymbol: s.currencySymbol,
      numberofdays: b.days,
      dailyrate: b.dailyRate,
      totalcost: b.total,
      payment: b.agentCollected || 0,
      balancedue: b.balanceDue,
      taxname1: '',
      taxname2: b.taxName,
      gst: b.tax,
      isgstinclusive: settings(cat).taxInclusive,
      agentrefno: b.agentRefNo || '',
      agent: b.agencyName || (agency && agency.name) || '',
      agentname: b.agentName || '',
      agentemail: b.agentEmail || '',
      agentcommission: b.commission,
      agentnetamountdue: b.netDue,
      kmcharges_description: ((b.lines || []).find(l => l.type === 'kmsrate') || {}).name || '',
      rcmreservationno: b.rcmReservationNo || '',
      insuranceexcess: ins ? ins.excess : 0
    }],
    customerinfo: [{
      customerid: b.contactId || '', firstname: cust.firstname || '', lastname: cust.lastname || '', dateofbirth: cust.dateofbirth || '',
      licenseno: cust.licenseno || '', licenseissued: cust.licenseissued || '', licenseexpires: cust.licenseexpires || '',
      email: cust.email || '', phone: cust.phone || '', mobile: cust.mobile || '', address: cust.address || '', city: cust.city || '',
      state: cust.state || '', postcode: cust.postcode || '', countryid: cust.countryid || ''
    }],
    rateinfo: (b.seasonal || []).map(x => ({
      season: x.season, numberofdays: x.numberofdays, numberofhours: 0, dailyratebeforediscount: x.dailyratebeforediscount,
      dailyrateafterdiscount: x.dailyrateafterdiscount, discountname: '', discountdescription: '', discountpercentagerate: x.discounttype === 'percentage' ? x.discountrate : 0,
      ratesubtotal: x.ratesubtotal
    })),
    extrafees: (b.lines || []).filter(l => l.type !== 'total rate').map(l => ({
      extrafeesid: l.id, name: l.name, type: '', qty: l.qty, numberofdays: b.days, fees: l.total / (l.qty || 1), totalfeeamount: l.total,
      feedescription: '', payagency: !!l.payAgency, isoptionalfee: l.type === 'optional', isbondfee: false,
      isinsurancefee: l.type === 'insurance', insuranceexcessamount: l.excess || 0
    })),
    paymentinfo: b.agentCollected ? [{ paidamount: b.agentCollected, paymenttype: 'Agent collected', paymentdate: rcmDate(b.createdDate), paysource: 'Agent portal' }] : [],
    extradrivers: (b.extraDrivers || []).map(x => ({ customerid: '', firstname: x.firstname || '', lastname: x.lastname || '', email: x.email || '', licenseno: x.licenseno || '' }))
  };
}

function agentBookingsRow(cat, b) {
  const pl = byId(cat.locations, b.pickupLocationId) || {};
  const dl = byId(cat.locations, b.dropoffLocationId) || {};
  const map = { quote: 'CONFIRMED', onrequest: 'ONREQUEST', confirmed: 'CONFIRMED', cancelled: 'CANCELLED', hired: 'CONFIRMED', returned: 'CONFIRMED' };
  return {
    bookingstatus: map[b.status] || String(b.status || '').toUpperCase(),
    reservationno: b.reservationNo,
    reservationref: b.reservationRef,
    originalreservationno: b.reservationNo,
    isquotation: !!b.isQuotation,
    pickupdate: rcmDate(b.pickupDate),
    dropoffdate: rcmDate(b.dropoffDate),
    reservationcreateddate: rcmDate(b.createdDate),
    pickuplocationcode: pl.code || pl.name || '',
    dropofflocationcode: dl.code || dl.name || '',
    firstname: (b.customer || {}).firstname || '',
    lastname: (b.customer || {}).lastname || '',
    vehiclecategory: b.categoryName || '',
    totalcost: b.total,
    agentrefno: b.agentRefNo || ''
  };
}

/* agentbookings filter: reservationno, or startdate+enddate (on created date, as RCM) + bookingstatus */
function filterAgentBookings(bookings, agency, req) {
  const mine = (bookings || []).filter(b => String(b.agencyId) === String(agency.id));
  if (req.reservationno) return mine.filter(b => String(b.reservationNo) === String(req.reservationno));
  const start = parseDate(req.startdate);
  const end = parseDate(req.enddate);
  if (!start || !end) throw new ApiError('Provide reservationno, or startdate and enddate');
  const field = req.datefield === 'pickup' ? 'pickupDate' : 'createdDate';
  const status = String(req.bookingstatus || 'all').toLowerCase();
  return mine.filter(b => inRange(b[field], start, end) && (status === 'all' || (status === 'confirmed' && ['confirmed', 'quote', 'hired', 'returned'].includes(b.status)) || b.status === status))
    .sort((a, b) => (b.createdDate || '').localeCompare(a.createdDate || '') || Number(b.reservationNo) - Number(a.reservationNo));
}

function checkCancel(b, agency, req, cat) {
  if (!b || String(b.agencyId) !== String(agency.id)) throw new ApiError('Booking not found', 'NOT_FOUND');
  if (agency.canCancel === false) throw new ApiError('Your agency is not set up to cancel bookings. Please contact Waka Campa.', 'FORBIDDEN');
  if (b.status === 'cancelled') throw new ApiError('Booking is already cancelled');
  if (['hired', 'returned'].includes(b.status)) throw new ApiError('Booking can no longer be cancelled');
  if (!byId(cat.cancelReasons, req.reasonid)) throw new ApiError('Invalid reasonid');
  return { status: 'cancelled', cancelReasonId: req.reasonid, cancelReason: byId(cat.cancelReasons, req.reasonid).reason };
}

/* ------------------------------------------------------------------ */
/* Dispatcher for read-only methods (booking writes live in n8n)        */
/* ------------------------------------------------------------------ */

const READ_METHODS = {
  step1: (cat) => [step1(cat)],
  vehiclecategorylocations: (cat) => [step1(cat)],
  step2: (cat, bk, req, ctx) => [step2(cat, bk, req, ctx.now)],
  search: (cat, bk, req, ctx) => [step2(cat, bk, req, ctx.now)],
  step3: (cat, bk, req, ctx) => [step3(cat, bk, req, ctx.now)],
  select: (cat, bk, req, ctx) => [step3(cat, bk, req, ctx.now)],
  calctotal: (cat, bk, req, ctx) => [calctotal(cat, bk, req, ctx.now)],
  locations: (cat, bk, req) => (cat.locations || []).filter(l => !req.id || String(l.id) === String(req.id)).map(locationRow),
  locationdetails: (cat, bk, req) => (cat.locations || []).filter(l => !req.id || String(l.id) === String(req.id)).map(locationDetailRow),
  categorytypes: (cat, bk, req) => categoryTypes(cat, req.id),
  categorylist: (cat) => categoryList(cat),
  driverages: (cat, bk, req) => driverAges(cat, req.id),
  countries: (cat) => countries(cat),
  cancelreasons: (cat) => (cat.cancelReasons || []).map(c => ({ id: c.id, reason: c.reason })),
  donotrent: (cat, bk, req) => [{ donotrent: isDoNotRent(cat, parseCustomer(req.customer, 'customer')) }],
  agentbookings: (cat, bk, req, ctx) => filterAgentBookings(bk, ctx.agency, req).map(b => agentBookingsRow(cat, b)),
  bookinginfo: (cat, bk, req, ctx) => {
    const b = (bk || []).find(x => String(x.agencyId) === String(ctx.agency.id) &&
      ((req.reservationref && x.reservationRef === req.reservationref) ||
       (req.reservationno && String(x.reservationNo) === String(req.reservationno))));
    if (!b) throw new ApiError('Booking not found', 'NOT_FOUND');
    return [bookingInfo(cat, b, ctx.agency)];
  },
  me: (cat, bk, req, ctx) => [{
    agency: ctx.agency.name, agentcode: ctx.agency.agentCode, commissionpct: Number(ctx.agency.commissionPct || 0),
    cancancel: ctx.agency.canCancel !== false, user: ctx.user || null
  }]
};

function handleRead(method, cat, bookings, req, ctx) {
  const started = Date.now();
  const fn = READ_METHODS[String(method || '').toLowerCase()];
  if (!fn) return envelope(null, `Unknown method '${method}'`, [], started);
  try {
    return envelope(fn(cat, bookings, req || {}, ctx || {}), '', [], started);
  } catch (e) {
    if (e instanceof ApiError) return Object.assign(envelope(null, e.message, [], started), { code: e.code });
    throw e;
  }
}

const api = {
  ENGINE_VERSION, ApiError, envelope, handleRead, READ_METHODS,
  parseDate, parseTime, rcmDate, addDays, dayOfWeek, hireDays, nowIn, round2,
  normaliseSearch, checkLocation, unitsBooked, priceRental, priceSelection,
  step1, step2, step3, calctotal, categoryList, prepareBooking, makeReservationRef,
  commissionFor, bookingInfo, agentBookingsRow, filterAgentBookings, checkCancel, isDoNotRent, parseCustomer
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.AgentEngine = api;
