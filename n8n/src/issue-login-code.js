/* Issue Login Code: only agent users of an enabled agency get a code. Same reply either way. */
const email = $('Route Request').first().json.email;
const found = ($('Find Agent Contact').first() || {}).json || {};
const contacts = Array.isArray(found.contacts) ? found.contacts : [];
const lower = (v) => String(v || '').trim().toLowerCase();
const contact = contacts.find(c => lower(c.email) === email && (c.tags || []).map(lower).includes(CONFIG.agentTag));

const recRes = ($('Get Agency Record').first() || {}).json || {};
const record = recRes.record || recRes.business || {};
const props = Object.assign({}, record.properties || {}, record);
const pick = (...keys) => { for (const k of keys) { const v = props[k]; if (v !== undefined && v !== null && v !== '') return v; } return undefined; };
const truthy = (v, dflt) => v === undefined ? dflt : ['true', 'yes', '1', true, 1].includes(typeof v === 'string' ? v.toLowerCase() : v);

const agentCode = pick('agent_code', 'business.agent_code');
const enabled = truthy(pick('portal_enabled', 'business.portal_enabled'), true);

if (!contact || !record.id || !agentCode || !enabled) {
  console.log('Agent login: no code issued (contact ' + (contact ? 'found' : 'missing') + ', agency ' + (record.id ? 'found' : 'missing') + ', agent_code ' + (agentCode ? 'set' : 'missing') + ')');
  return [{ json: { send: false } }];
}

const code = AUTH.newLoginCode();
const prev = store.logins[email] || {};
store.logins[email] = {
  hash: AUTH.hashLoginCode(code, email, CONFIG.tokenSecret),
  exp: Math.floor(Date.now() / 1000) + CONFIG.loginCodeTtlSeconds,
  attempts: 0,
  requests: (prev.requests || 0) + 1,
  user: { id: contact.id, name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.contactName || email },
  agency: {
    id: record.id,
    name: pick('name', 'business.name') || 'Agency',
    agentCode: String(agentCode),
    commissionPct: Number(pick('commission_pct', 'business.commission_pct') || 0),
    commissionOnFees: truthy(pick('commission_on_fees', 'business.commission_on_fees'), false),
    canCancel: truthy(pick('can_cancel', 'business.can_cancel'), true),
    allowCollected: truthy(pick('allow_agent_collected', 'business.allow_agent_collected'), false)
  }
};

const first = contact.firstName || 'there';
const html = `<p>Hi ${first.replace(/[<>&]/g, '')},</p>
<p>Your Waka Campa agent portal sign-in code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
<p>It expires in ${Math.round(CONFIG.loginCodeTtlSeconds / 60)} minutes. If you didn't ask for it, you can ignore this email.</p>
<p>Waka Campa</p>`;

return [{ json: { send: true, contactId: contact.id, subject: `${code} is your Waka Campa sign-in code`, html } }];
