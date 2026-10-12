/* Waka Campa agent portal. Vanilla JS, hash routing, no build step. */
(function () {
  const api = window.AgentApi;
  const cfg = window.PORTAL_CONFIG || {};
  const app = document.getElementById('app');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------------- state ---------------- */
  const state = {
    ref: null,          /* step1 reference data */
    search: null,       /* last search params */
    results: null,      /* last step2 results */
    selected: null,     /* chosen category id */
    step3: null,
    extras: { insuranceid: null, extrakmsid: null, optional: {} },
    totals: null
  };

  /* ---------------- helpers ---------------- */
  const esc = (v) => String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (cfg.currencySymbol || '$') + Number(n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  /* Today in the business timezone, so date filters match how bookings are stamped. */
  const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone || 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const plusDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const toRcm = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const pretty = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };
  const locName = (id) => ((state.ref && state.ref.locations.find(l => String(l.id) === String(id))) || {}).location || id;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3500);
  }

  function loading(msg) { app.innerHTML = `<div class="center muted"><span class="spinner"></span> ${esc(msg || 'Loading')}</div>`; }

  function errorBox(err) { return `<div class="alert bad">${esc(err && err.message ? err.message : err)}</div>`; }

  async function guard(fn) {
    try { return await fn(); }
    catch (e) {
      if (e.code === 'AUTH') { go('login'); return; }
      app.innerHTML = `<div class="card">${errorBox(e)}<p></p><button class="btn secondary" onclick="history.back()">Back</button></div>`;
    }
  }

  function go(route) { location.hash = '#/' + route; }

  async function reference() {
    if (!state.ref) state.ref = (await api.call('step1'))[0];
    return state.ref;
  }

  /* ---------------- chrome ---------------- */
  function chrome(route) {
    const signedIn = api.hasSession();
    $('#nav').hidden = !signedIn;
    $('#who').hidden = !signedIn;
    $('#demo-banner').hidden = !api.isDemo;
    const p = api.profile();
    $('#who-name').textContent = p ? `${p.user && p.user.name ? p.user.name + ' · ' : ''}${p.agency ? p.agency.name : ''}` : '';
    $$('#nav a').forEach(a => a.classList.toggle('active', route.startsWith(a.dataset.route)));
  }
  $('#sign-out').addEventListener('click', () => { api.signOut(); state.ref = null; go('login'); });

  /* ---------------- login ---------------- */
  function viewLogin() {
    app.innerHTML = `
      <div class="card login stack">
        <div><h1>Agent sign in</h1><p class="muted">We'll email you a 6-digit code. No password needed.</p></div>
        <form id="f-email" class="stack">
          <div><label for="email">Work email</label><input id="email" type="email" autocomplete="email" required></div>
          <button class="btn" type="submit">Email me a code</button>
        </form>
        <form id="f-code" class="stack" hidden>
          <div><label for="code">Code</label><input id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required>
          <div class="field-hint" id="code-hint"></div></div>
          <button class="btn" type="submit">Sign in</button>
          <button class="link" type="button" id="restart">Use a different email</button>
        </form>
        <div id="login-msg"></div>
        <p class="small muted">Not set up yet? Contact ${esc(cfg.supportEmail || 'Waka Campa')}.</p>
      </div>`;
    const msg = $('#login-msg');
    $('#f-email').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true; msg.innerHTML = '';
      try {
        const r = await api.requestCode($('#email').value.trim());
        $('#f-email').hidden = true; $('#f-code').hidden = false;
        $('#code-hint').textContent = r && r.demoCode ? `Demo code: ${r.demoCode}` : 'If this email belongs to a registered agent, a code is on its way. It expires in 10 minutes.';
        $('#code').focus();
      } catch (err) { msg.innerHTML = errorBox(err); }
      btn.disabled = false;
    });
    $('#f-code').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true; msg.innerHTML = '';
      try { await api.verifyCode($('#email').value.trim(), $('#code').value.trim()); go('search'); }
      catch (err) { msg.innerHTML = errorBox(err); btn.disabled = false; }
    });
    $('#restart').addEventListener('click', () => { $('#f-email').hidden = false; $('#f-code').hidden = true; });
  }

  /* ---------------- search (step1 + step2) ---------------- */
  async function viewSearch() {
    loading('Loading locations');
    const ref = await reference();
    const s = state.search || {
      pickuplocationid: (ref.locations.find(l => l.isdefault) || ref.locations[0] || {}).id,
      dropofflocationid: (ref.locations.find(l => l.isdefault) || ref.locations[0] || {}).id,
      pickupdate: plusDays(isoToday(), 14), pickuptime: cfg.defaultPickupTime || '10:00',
      dropoffdate: plusDays(isoToday(), 21), dropofftime: cfg.defaultDropoffTime || '10:00',
      ageid: (ref.driverages.find(a => a.isdefault) || ref.driverages[0] || {}).id,
      vehiclecategorytypeid: 0
    };
    const opt = (list, val, label, id = 'id') => list.map(x => `<option value="${esc(x[id])}" ${String(x[id]) === String(val) ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
    const pick = ref.locations.filter(l => l.ispickupavailable);
    const drop = ref.locations.filter(l => l.isdropoffavailable);
    app.innerHTML = `
      <div class="page-head"><div><h1>New booking</h1><p class="muted">Search availability and live rates.</p></div></div>
      <form id="f-search" class="card stack">
        <div class="grid grid-4">
          <div><label>Pick-up location</label><select name="pickuplocationid">${opt(pick, s.pickuplocationid, l => l.location)}</select></div>
          <div><label>Pick-up date</label><input type="date" name="pickupdate" value="${esc(s.pickupdate)}" min="${isoToday()}" required></div>
          <div><label>Pick-up time</label><input type="time" name="pickuptime" value="${esc(s.pickuptime)}" step="900" required></div>
          <div><label>Youngest driver</label><select name="ageid">${opt(ref.driverages, s.ageid, a => a.driverage + (a.driverage >= 80 ? '+' : ''))}</select></div>
          <div><label>Drop-off location</label><select name="dropofflocationid">${opt(drop, s.dropofflocationid, l => l.location)}</select></div>
          <div><label>Drop-off date</label><input type="date" name="dropoffdate" value="${esc(s.dropoffdate)}" min="${isoToday()}" required></div>
          <div><label>Drop-off time</label><input type="time" name="dropofftime" value="${esc(s.dropofftime)}" step="900" required></div>
          <div><label>Vehicle type</label><select name="vehiclecategorytypeid"><option value="0">All vehicles</option>${opt(ref.categorytypes, s.vehiclecategorytypeid, t => t.vehiclecategorytype)}</select></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Search</button></div>
      </form>
      <div id="results" class="results" style="margin-top:20px"></div>`;
    const f = $('#f-search');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(f).entries());
      state.search = data;
      await runSearch();
    });
    if (state.results) renderResults();
  }

  function searchParams(extra) {
    const s = state.search;
    return Object.assign({
      pickuplocationid: s.pickuplocationid, dropofflocationid: s.dropofflocationid,
      pickupdate: toRcm(s.pickupdate), pickuptime: s.pickuptime,
      dropoffdate: toRcm(s.dropoffdate), dropofftime: s.dropofftime,
      ageid: s.ageid, vehiclecategorytypeid: s.vehiclecategorytypeid
    }, extra || {});
  }

  async function runSearch() {
    const box = $('#results');
    box.innerHTML = '<div class="center muted"><span class="spinner"></span> Checking availability</div>';
    try {
      state.results = (await api.call('step2', searchParams()))[0];
      renderResults();
    } catch (e) {
      if (e.code === 'AUTH') return go('login');
      box.innerHTML = errorBox(e);
    }
  }

  function renderResults() {
    const box = $('#results');
    if (!box) return;
    const r = state.results;
    const locIssues = (r.locationfees || []).filter(l => !l.isavailable).map(l => l.availablemessage);
    const uniqIssues = Array.from(new Set(locIssues));
    const fees = (id) => (r.mandatoryfees || []).filter(f => String(f.vehiclecategoryid) === String(id));
    const cars = r.availablecars || [];
    const s = state.search;
    box.innerHTML = `
      <div class="muted small">${esc(locName(s.pickuplocationid))} ${esc(pretty(s.pickupdate))} ${esc(s.pickuptime)} → ${esc(locName(s.dropofflocationid))} ${esc(pretty(s.dropoffdate))} ${esc(s.dropofftime)} · ${cars[0] ? cars[0].numberofdays : ''} days</div>
      ${uniqIssues.length ? `<div class="alert warn">${uniqIssues.map(esc).join('<br>')}</div>` : ''}
      ${cars.length ? '' : '<div class="card muted">No vehicles match this search.</div>'}
      ${cars.map(c => {
        const mand = fees(c.vehiclecategoryid).reduce((a, f) => a + Number(f.totalfeeamount || 0), 0);
        const badge = c.available === 2 ? '<span class="badge warn">Only a few left</span>' : c.available === 1 ? '<span class="badge">Available</span>' : `<span class="badge bad">${esc(c.availablemessage)}</span>`;
        return `
        <div class="card car ${c.available ? '' : 'unavailable'}">
          <div>
            <h3>${esc(c.vehiclecategory)} ${badge}</h3>
            <div class="car-specs"><span>${esc(c.numberofadults)} adults${c.numberofchildren ? ' + ' + esc(c.numberofchildren) + ' children' : ''}</span><span>${esc(c.numberoflargecases)} large bags</span><span>SIPP ${esc(c.sippcode)}</span><span>Min ${esc(c.minimumbookingday)} days</span></div>
            ${c.totaldiscountamount ? `<div class="small" style="color:var(--good)">Includes ${money(c.totaldiscountamount)} discount</div>` : ''}
          </div>
          <div class="price">
            ${c.totalrateafterdiscount ? `<span class="muted small">${money(c.avgrate)}/day</span><strong>${money(c.totalrateafterdiscount + mand)}</strong><span class="muted small">incl. mandatory fees</span>` : ''}
            ${c.available ? `<div style="margin-top:8px"><button class="btn" data-select="${esc(c.vehiclecategoryid)}">Select</button></div>` : ''}
          </div>
        </div>`;
      }).join('')}`;
    $$('[data-select]', box).forEach(b => b.addEventListener('click', () => {
      state.selected = b.dataset.select;
      state.step3 = null; state.extras = { insuranceid: null, extrakmsid: null, optional: {} };
      go('extras');
    }));
  }

  /* ---------------- extras (step3 + calctotal) ---------------- */
  async function viewExtras() {
    if (!state.search || !state.selected) return go('search');
    loading('Loading options');
    if (!state.step3) state.step3 = (await api.call('step3', searchParams({ vehiclecategoryid: state.selected, vehiclecategorytypeid: selectedTypeId() })))[0];
    const r = state.step3;
    const car = r.availablecars[0];
    const ex = state.extras;
    if (ex.insuranceid === null) ex.insuranceid = String((r.insuranceoptions.find(i => i.isdefault) || r.insuranceoptions[0] || {}).id || '');
    if (ex.extrakmsid === null) ex.extrakmsid = String((r.kmcharges.find(k => k.isdefault) || r.kmcharges[0] || {}).id || '');

    app.innerHTML = `
      <div class="steps"><span>1 Search</span>›<span class="on">2 Extras</span>›<span>3 Customer</span>›<span>4 Confirm</span></div>
      <div class="page-head"><div><h1>${esc(car.vehiclecategory)}</h1><p class="muted">${esc(car.numberofdays)} days · ${esc(locName(state.search.pickuplocationid))} to ${esc(locName(state.search.dropofflocationid))}</p></div></div>
      <div class="layout-2">
        <div class="stack">
          ${car.available ? '' : `<div class="alert bad">${esc(car.availablemessage)}</div>`}
          ${r.insuranceoptions.length ? `<div class="card"><h2>Insurance</h2>${r.insuranceoptions.map(i => `
            <label class="option ${String(i.id) === ex.insuranceid ? 'selected' : ''}"><input type="radio" name="ins" value="${esc(i.id)}" ${String(i.id) === ex.insuranceid ? 'checked' : ''}>
              <span class="grow"><strong>${esc(i.name)}</strong><br><span class="small muted">Excess ${money(i.excessamount)}${i.feedescription ? ' · ' + esc(i.feedescription) : ''}</span></span>
              <span>${i.totalinsuranceamount ? money(i.totalinsuranceamount) : 'Included'}</span></label>`).join('')}</div>` : ''}
          ${r.kmcharges.length > 1 ? `<div class="card"><h2>Kilometres</h2>${r.kmcharges.map(k => `
            <label class="option ${String(k.id) === ex.extrakmsid ? 'selected' : ''}"><input type="radio" name="km" value="${esc(k.id)}" ${String(k.id) === ex.extrakmsid ? 'checked' : ''}>
              <span class="grow"><strong>${esc(k.description)}</strong></span><span>${k.totalamount ? money(k.totalamount) : 'Included'}</span></label>`).join('')}</div>` : ''}
          ${r.optionalfees.length ? `<div class="card"><h2>Extras</h2>${r.optionalfees.map(o => {
            const q = ex.optional[o.id] || 0;
            return `<div class="option ${q ? 'selected' : ''}">
              <input type="checkbox" data-opt="${esc(o.id)}" ${q ? 'checked' : ''} aria-label="${esc(o.name)}">
              <span class="grow"><strong>${esc(o.name)}</strong><br><span class="small muted">${o.type === 'Daily' ? money(o.fees) + ' per day' : o.type === 'Percentage' ? esc(o.fees) + '%' : money(o.fees)}${o.maximumprice ? ' · max ' + money(o.maximumprice) : ''}</span></span>
              ${o.qtyapply ? `<input class="qty" type="number" min="1" max="${esc(o.maxqty || 10)}" value="${q || 1}" data-qty="${esc(o.id)}" aria-label="Quantity">` : ''}
            </div>`;
          }).join('')}</div>` : ''}
        </div>
        <aside class="card summary" id="summary"><div class="muted"><span class="spinner"></span> Pricing</div></aside>
      </div>`;

    $$('input[name=ins]').forEach(i => i.addEventListener('change', () => { ex.insuranceid = i.value; refreshOptions(); }));
    $$('input[name=km]').forEach(i => i.addEventListener('change', () => { ex.extrakmsid = i.value; refreshOptions(); }));
    $$('[data-opt]').forEach(c => c.addEventListener('change', () => {
      const q = $(`[data-qty="${c.dataset.opt}"]`);
      if (c.checked) ex.optional[c.dataset.opt] = q ? Number(q.value || 1) : 1; else delete ex.optional[c.dataset.opt];
      refreshOptions();
    }));
    $$('[data-qty]').forEach(q => q.addEventListener('change', () => {
      if (ex.optional[q.dataset.qty]) { ex.optional[q.dataset.qty] = Number(q.value || 1); price(); }
    }));
    function refreshOptions() {
      $$('.option').forEach(o => { const inp = $('input[type=radio], input[type=checkbox]', o); o.classList.toggle('selected', !!(inp && inp.checked)); });
      price();
    }
    await price();
  }

  /* step3, calctotal and booking need the real category type of the chosen vehicle, not "all". */
  function selectedTypeId() {
    const car = ((state.results && state.results.availablecars) || []).find(c => String(c.vehiclecategoryid) === String(state.selected));
    return car ? car.vehiclecategorytypeid : state.search.vehiclecategorytypeid;
  }

  /* RCM's calctotal works from step3's figures (days, rental total, mandatory fees), so they travel with every selection. */
  function selectionParams() {
    const ex = state.extras;
    const car = (state.step3 && state.step3.availablecars && state.step3.availablecars[0]) || {};
    return searchParams({
      vehiclecategoryid: state.selected,
      vehiclecategorytypeid: selectedTypeId(),
      numberofdays: car.numberofdays,
      totalrateafterdiscount: car.totalrateafterdiscount,
      freedaysamount: car.freedaysamount || 0,
      mandatoryfees: ((state.step3 && state.step3.mandatoryfees) || []).map(f => ({ id: f.id, qty: f.qty || 1 })),
      insuranceid: ex.insuranceid || 0,
      extrakmsid: ex.extrakmsid || 0,
      optionalfees: Object.entries(ex.optional).map(([id, qty]) => ({ id: Number(id), qty }))
    });
  }

  function summaryHtml(totals, button) {
    const rows = totals.totals;
    const body = rows.filter(r => r.type !== 'total' && r.type !== 'country tax').map(r => `<tr><td>${esc(r.name)}${r.qty > 1 ? ' × ' + esc(r.qty) : ''}</td><td>${money(r.total)}</td></tr>`).join('');
    const tax = rows.find(r => r.type === 'country tax');
    const total = rows.find(r => r.type === 'total');
    return `<h2>Price</h2><table class="lines">${body}
      <tr class="total"><td>Total</td><td>${money(total.total)}</td></tr>
      ${tax ? `<tr class="sub"><td>${esc(tax.name)}</td><td>${money(tax.total)}</td></tr>` : ''}</table>
      ${button ? `<div class="actions" style="margin-top:16px"><button class="btn secondary" onclick="location.hash='#/search'">Back</button>${button}</div>` : ''}`;
  }

  let priceSeq = 0;
  async function price() {
    const box = $('#summary');
    const mine = ++priceSeq;
    try {
      const t = (await api.call('calctotal', selectionParams()))[0];
      if (mine !== priceSeq) return;
      state.totals = t;
      const ok = state.step3.availablecars[0].available !== 0;
      box.innerHTML = summaryHtml(t, ok ? '<button class="btn" id="to-customer">Continue</button>' : '');
      const b = $('#to-customer'); if (b) b.addEventListener('click', () => go('customer'));
    } catch (e) { box.innerHTML = errorBox(e); }
  }

  /* ---------------- customer + booking ---------------- */
  async function viewCustomer() {
    if (!state.totals) return go('search');
    const ref = await reference();
    const c = state.customer || {};
    const countries = (state.step3 && state.step3.countries) || [];
    const loc = ref.locations.find(l => String(l.id) === String(state.search.pickuplocationid)) || {};
    app.innerHTML = `
      <div class="steps"><span>1 Search</span>›<span>2 Extras</span>›<span class="on">3 Customer</span>›<span>4 Confirm</span></div>
      <div class="page-head"><div><h1>Hirer details</h1><p class="muted">The main driver. Additional drivers can be added at pick-up.</p></div></div>
      <div class="layout-2">
        <form id="f-cust" class="card stack">
          <div class="grid grid-2">
            <div><label>First name</label><input name="firstname" value="${esc(c.firstname)}" maxlength="30" required></div>
            <div><label>Last name</label><input name="lastname" value="${esc(c.lastname)}" maxlength="40" required></div>
            <div><label>Email</label><input type="email" name="email" value="${esc(c.email)}" maxlength="50" required></div>
            <div><label>Mobile</label><input name="mobile" value="${esc(c.mobile)}" maxlength="25"></div>
            <div><label>Date of birth</label><input type="date" name="dateofbirth" value="${esc(c.dateofbirth)}"></div>
            <div><label>Country of residence</label><select name="countryid"><option value="">Select</option>${countries.map(x => `<option value="${esc(x.id)}" ${String(x.id) === String(c.countryid) ? 'selected' : ''}>${esc(x.country)}</option>`).join('')}</select></div>
            <div><label>Licence number</label><input name="licenseno" value="${esc(c.licenseno)}" maxlength="70"></div>
            <div><label>Licence issued in</label><input name="licenseissued" value="${esc(c.licenseissued)}" maxlength="20"></div>
          </div>
          <div class="grid grid-2">
            <div><label>Your reference</label><input name="agentrefno" value="${esc(c.agentrefno)}" maxlength="50"><div class="field-hint">Saved with the booking and shown in My bookings.</div></div>
            <div><label>Number travelling</label><input type="number" min="1" max="12" name="numbertravelling" value="${esc(c.numbertravelling || '')}"></div>
            <div><label>Arrival flight${loc.isflightinrequired ? ' (required)' : ''}</label><input name="flightin" value="${esc(c.flightin)}" maxlength="50" ${loc.isflightinrequired ? 'required' : ''}></div>
            <div><label>Departure flight</label><input name="flightout" value="${esc(c.flightout)}" maxlength="50"></div>
          </div>
          <div><label>Notes for Waka Campa</label><textarea name="remark" maxlength="250" rows="3">${esc(c.remark)}</textarea></div>
          <div class="grid grid-2">
            <label class="option"><input type="radio" name="bookingtype" value="2" ${c.bookingtype !== '1' ? 'checked' : ''}><span class="grow"><strong>Book now</strong><br><span class="small muted">Holds the vehicle</span></span></label>
            <label class="option"><input type="radio" name="bookingtype" value="1" ${c.bookingtype === '1' ? 'checked' : ''}><span class="grow"><strong>Save as quote</strong><br><span class="small muted">Valid ${esc(loc.quoteisvalid_numberofdays || 7)} days, not held</span></span></label>
          </div>
          <div id="book-msg"></div>
          <div class="actions"><button class="btn secondary" type="button" onclick="location.hash='#/extras'">Back</button><button class="btn" type="submit" id="book-btn">Confirm</button></div>
        </form>
        <aside class="card summary">${summaryHtml(state.totals)}</aside>
      </div>`;
    $('#f-cust').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      state.customer = f;
      const btn = $('#book-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Booking';
      const total = state.totals.totals.find(r => r.type === 'total').total;
      const customer = {};
      ['firstname', 'lastname', 'email', 'mobile', 'countryid', 'licenseno', 'licenseissued'].forEach(k => { if (f[k]) customer[k] = f[k].trim(); });
      if (f.dateofbirth) customer.dateofbirth = toRcm(f.dateofbirth);
      try {
        const res = (await api.call('booking', Object.assign(selectionParams(), {
          bookingtype: Number(f.bookingtype), transmission: 0, customer,
          agentrefno: f.agentrefno, numbertravelling: f.numbertravelling || undefined,
          flightin: f.flightin, flightout: f.flightout, remark: f.remark,
          expectedtotal: total,
          displaypickup: locName(state.search.pickuplocationid),
          displaydropoff: locName(state.search.dropofflocationid),
          displaycategory: (state.step3.availablecars[0] || {}).vehiclecategory || ''
        })))[0];
        state.last = res;
        state.results = null; state.totals = null; state.step3 = null; state.customer = null;
        go('booking/' + encodeURIComponent(res.reservationref) + '?new=1');
      } catch (err) {
        if (err.code === 'AUTH') return go('login');
        $('#book-msg').innerHTML = errorBox(err);
        btn.disabled = false; btn.textContent = 'Confirm';
        if (err.code === 'PRICE_CHANGED' || err.code === 'UNAVAILABLE') { state.step3 = null; }
      }
    });
  }

  /* ---------------- my bookings ---------------- */
  async function viewBookings(query) {
    const today = isoToday();
    const start = query.get('from') || plusDays(today, -30);
    const end = query.get('to') || today;
    const status = query.get('status') || 'all';
    app.innerHTML = `
      <div class="page-head"><div><h1>My bookings</h1><p class="muted">Bookings your agency made through the portal, by date made.</p></div></div>
      <form id="f-find" class="card grid grid-4" style="align-items:end">
        <div><label>Made from</label><input type="date" name="from" value="${esc(start)}"></div>
        <div><label>Made to</label><input type="date" name="to" value="${esc(end)}"></div>
        <div><label>Status</label><select name="status">${['all', 'confirmed', 'onrequest', 'cancelled'].map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${{ all: 'All', confirmed: 'Confirmed', onrequest: 'On request', cancelled: 'Cancelled' }[s]}</option>`).join('')}</select></div>
        <div class="actions" style="justify-content:flex-start"><button class="btn" type="submit">Show</button></div>
        <div style="grid-column:1/-1"><label>Or find by booking number</label><input name="no" inputmode="numeric" placeholder="e.g. 50012" value="${esc(query.get('no') || '')}"></div>
      </form>
      <div id="list" class="card" style="margin-top:16px"><div class="muted"><span class="spinner"></span> Loading</div></div>`;
    $('#f-find').addEventListener('submit', (e) => {
      e.preventDefault();
      const p = new URLSearchParams(Object.fromEntries(new FormData(e.target).entries()));
      if (!p.get('no')) p.delete('no');
      location.hash = '#/bookings?' + p.toString();
    });
    const params = query.get('no') ? { reservationno: query.get('no') } : { startdate: toRcm(start), enddate: toRcm(end), bookingstatus: status };
    const list = $('#list');
    try {
      const rows = await api.call('agentbookings', params);
      if (!rows.length) { list.innerHTML = '<p class="muted" style="margin:0">No bookings found.</p>'; return; }
      const badge = (r) => r.isquotation ? '<span class="badge muted">Quote</span>' : r.bookingstatus === 'CANCELLED' ? '<span class="badge bad">Cancelled</span>' : r.bookingstatus === 'ONREQUEST' ? '<span class="badge warn">On request</span>' : '<span class="badge">Confirmed</span>';
      list.innerHTML = `<div class="table-wrap"><table class="list"><thead><tr><th>Booking</th><th>Hirer</th><th>Vehicle</th><th>Pick-up</th><th>Drop-off</th><th>Your ref</th><th>Status</th><th style="text-align:right">Total</th></tr></thead><tbody>
        ${rows.map(r => `<tr class="clickable" data-ref="${esc(r.reservationref)}"><td><strong>${esc(r.reservationno)}</strong></td><td>${esc(r.firstname)} ${esc(r.lastname)}</td><td>${esc(r.vehiclecategory || '')}</td><td>${esc(r.pickuplocationcode)} ${esc(r.pickupdate)}</td><td>${esc(r.dropofflocationcode)} ${esc(r.dropoffdate)}</td><td>${esc(r.agentrefno || '')}</td><td>${badge(r)}</td><td style="text-align:right">${r.totalcost !== undefined ? money(r.totalcost) : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
      $$('tr[data-ref]', list).forEach(tr => tr.addEventListener('click', () => go('booking/' + encodeURIComponent(tr.dataset.ref))));
    } catch (e) {
      if (e.code === 'AUTH') return go('login');
      list.innerHTML = errorBox(e);
    }
  }

  /* ---------------- booking detail + cancel ---------------- */
  async function viewBooking(ref, query) {
    loading('Loading booking');
    /* A just-made booking can take a few seconds to show in GHL's search, so retry briefly. */
    let info;
    for (let attempt = 0; ; attempt++) {
      try { info = (await api.call('bookinginfo', { reservationref: ref }))[0]; break; }
      catch (e) {
        if (e.code !== 'NOT_FOUND' || attempt >= 5) throw e;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    const b = info.bookinginfo[0];
    const c = info.customerinfo[0] || {};
    const isNew = query.get('new') === '1';
    const cancelled = b.reservationstatus === 'Cancelled';
    const statusBadge = cancelled ? '<span class="badge bad">Cancelled</span>' : b.isquotation ? '<span class="badge muted">Quote</span>' : b.isonrequest ? '<span class="badge warn">On request</span>' : '<span class="badge">Confirmed</span>';
    const p = api.profile() || {};
    app.innerHTML = `
      ${isNew ? `<div class="alert good" style="margin-bottom:16px">${b.isquotation ? 'Quote saved' : 'Booking confirmed'}. Booking number <strong>${esc(b.reservationno)}</strong>.</div>` : ''}
      <div class="page-head">
        <div><h1>Booking ${esc(b.reservationno)} ${statusBadge}</h1><p class="muted">${esc(c.firstname)} ${esc(c.lastname)} · made ${esc(b.reservationcreateddate)}${b.agentrefno ? ' · your ref ' + esc(b.agentrefno) : ''}</p></div>
        <div class="actions">${!cancelled ? '<button class="btn secondary" id="cancel-btn">Cancel booking</button>' : ''}<button class="btn secondary" onclick="window.print()">Print</button></div>
      </div>
      <div class="layout-2">
        <div class="stack">
          <div class="card"><h2>Trip</h2><dl class="kv">
            <dt>Vehicle</dt><dd>${esc(b.vehiclecategory)}</dd>
            <dt>Pick-up</dt><dd>${esc(b.pickuplocationname)}, ${esc(b.pickupdate)} ${esc(b.pickuptime)}</dd>
            <dt>Drop-off</dt><dd>${esc(b.dropofflocationname)}, ${esc(b.dropoffdate)} ${esc(b.dropofftime)}</dd>
            <dt>Days</dt><dd>${esc(b.numberofdays)}</dd>
            ${b.flightin ? `<dt>Arrival flight</dt><dd>${esc(b.flightin)}</dd>` : ''}
            ${b.quoteconversionvalidmessage ? `<dt>Quote</dt><dd>${esc(b.quoteconversionvalidmessage)}</dd>` : ''}
            ${b.insuranceexcess !== undefined ? `<dt>Insurance excess</dt><dd>${money(b.insuranceexcess)}</dd>` : ''}
          </dl></div>
          <div class="card"><h2>Hirer</h2><dl class="kv">
            <dt>Name</dt><dd>${esc(c.firstname)} ${esc(c.lastname)}</dd>
            <dt>Email</dt><dd>${esc(c.email)}</dd>
            ${c.mobile ? `<dt>Mobile</dt><dd>${esc(c.mobile)}</dd>` : ''}
            ${c.licenseno ? `<dt>Licence</dt><dd>${esc(c.licenseno)} ${esc(c.licenseissued)}</dd>` : ''}
          </dl></div>
        </div>
        <aside class="card summary">
          <h2>Charges</h2>
          <table class="lines">
            ${(info.rateinfo || []).map(r => `<tr><td>${esc(r.season)} · ${esc(r.numberofdays)} days @ ${money(r.dailyrateafterdiscount)}</td><td>${money(r.ratesubtotal)}</td></tr>`).join('')}
            ${(info.extrafees || []).map(f => `<tr><td>${esc(f.name)}${f.qty > 1 ? ' × ' + esc(f.qty) : ''}</td><td>${money(f.totalfeeamount)}</td></tr>`).join('')}
            <tr class="total"><td>Total</td><td>${money(b.totalcost)}</td></tr>
            <tr class="sub"><td>${esc(b.taxname2 || 'GST')} included</td><td>${money(b.gst)}</td></tr>
            ${b.payment ? `<tr class="sub"><td>Collected by agent</td><td>−${money(b.payment)}</td></tr>` : ''}
            <tr class="sub"><td>Your commission</td><td>−${money(b.agentcommission)}</td></tr>
            <tr class="total"><td>Net due to Waka Campa</td><td>${money(b.agentnetamountdue)}</td></tr>
          </table>
        </aside>
      </div>
      <div id="cancel-box"></div>`;
    const cb = $('#cancel-btn');
    if (cb) cb.addEventListener('click', async () => {
      const reasons = await api.call('cancelreasons');
      const box = $('#cancel-box');
      box.innerHTML = `<div class="card stack" style="margin-top:20px;max-width:520px">
        <h2>Cancel booking ${esc(b.reservationno)}</h2>
        <div><label>Reason</label><select id="reason">${reasons.map(r => `<option value="${esc(r.id)}">${esc(r.reason)}</option>`).join('')}</select></div>
        <div id="cancel-msg"></div>
        <div class="actions"><button class="btn secondary" id="keep">Keep booking</button><button class="btn danger" id="do-cancel">Cancel booking</button></div></div>`;
      box.scrollIntoView({ behavior: 'smooth' });
      $('#keep').addEventListener('click', () => { box.innerHTML = ''; });
      $('#do-cancel').addEventListener('click', async (e) => {
        e.target.disabled = true;
        try {
          await api.call('cancelbooking', { reservationref: ref, reasonid: Number($('#reason').value) });
          toast('Booking cancelled');
          viewBooking(ref, new URLSearchParams());
        } catch (err) { $('#cancel-msg').innerHTML = errorBox(err); e.target.disabled = false; }
      });
    });
    void p;
  }

  /* ---------------- router ---------------- */
  async function route() {
    const raw = location.hash.replace(/^#\/?/, '') || 'search';
    const [path, qs] = raw.split('?');
    const query = new URLSearchParams(qs || '');
    const signedIn = api.hasSession();
    if (!signedIn && path !== 'login') return go('login');
    chrome(path);
    window.scrollTo(0, 0);
    if (path === 'login') return viewLogin();
    if (path === 'search') return guard(viewSearch);
    if (path === 'extras') return guard(viewExtras);
    if (path === 'customer') return guard(viewCustomer);
    if (path === 'bookings') return guard(() => viewBookings(query));
    if (path.startsWith('booking/')) return guard(() => viewBooking(decodeURIComponent(path.slice(8)), query));
    go('search');
  }
  window.addEventListener('hashchange', route);
  route();
})();
