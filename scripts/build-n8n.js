/*
 * Builds the n8n Workflow SDK file for the Agent API from n8n/src/*.js.
 *
 *   node scripts/build-n8n.js [--env staging|live] [--out file]
 *
 * Secrets are NOT stored in this repo. They are read from environment variables
 * at build time and only end up in the n8n workflow itself:
 *   AGENT_TOKEN_SECRET   signs portal sessions and login codes
 *   RCM_USERNAME, RCM_PASSWORD   RCM v3.2 API key and shared secret. The same pair works as
 *       the Web Booking API key (apikey + HMAC signature) and as the Post-Booking token login.
 * Without them the output carries __SET_IN_N8N__ placeholders.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : dflt; };
const env = arg('env', 'staging');
const out = arg('out', path.join(root, 'n8n', `agent-api.${env}.workflow.js`));

const ENVS = {
  staging: { name: 'dev_Agent API', path: 'dev-agent-api', locationId: 'va82O7V3l50t4My9T2zQ', errorWorkflow: 'iao5ljUYqyzTAEBQ' },
  live: { name: 'Agent API', path: 'agent-api', locationId: 'wMnxsKTekNKeaukJxYh8', errorWorkflow: 'OWzMdf1UhqdBhTzi' }
};
const E = ENVS[env];
if (!E) throw new Error('unknown env ' + env);

const SECRET = process.env.AGENT_TOKEN_SECRET || '__SET_IN_N8N__';
const RCM_USER = process.env.RCM_USERNAME || '__SET_IN_N8N__';
const RCM_PASS = process.env.RCM_PASSWORD || '__SET_IN_N8N__';

const config = {
  env,
  locationId: E.locationId,
  timezone: 'Pacific/Auckland',
  tokenSecret: SECRET,
  tokenTtlSeconds: 43200,
  loginCodeTtlSeconds: 600,
  loginMaxAttempts: 5,
  agentTag: 'agent_user',
  bookingsObjectKey: 'custom_objects.bookings',
  rcmApiKey: RCM_USER,
  rcmSharedSecret: RCM_PASS
};

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const authSrc = read('engine/auth.js');
const header = read('n8n/src/header.js')
  .replace('__CONFIG__', JSON.stringify(config, null, 2))
  .replace('__AUTH__', authSrc);
/* Only the nodes that sign or verify need the auth helpers; comments are stripped to keep nodes small. */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\n\s*\n+/g, '\n');
const liteHeader = header.replace(/const AUTH = \(function[\s\S]*?return module\.exports; \}\)\(\);\n/, '');
const NEEDS_AUTH = ['route-request.js', 'issue-login-code.js', 'prepare-rcm-call.js'];
const code = (file) => strip((NEEDS_AUTH.includes(file) ? header : liteHeader) + '\n' + read('n8n/src/' + file));

const J = (v) => JSON.stringify(v);
const GHL = 'https://services.leadconnectorhq.com';

const sdk = `import { workflow, node, trigger, sticky, newCredential, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const ghlCred = { httpHeaderAuth: newCredential('GHL Private Integration (${env})') };

const agentApiRequest = trigger({
  type: 'n8n-nodes-base.webhook', version: 2.1,
  config: { name: 'Agent API Request', position: [0, 400],
    parameters: { httpMethod: 'POST', path: ${J(E.path)}, responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ headers: { authorization: 'Bearer x' }, body: { method: 'step1' } }]
});

const routeRequest = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Route Request', position: [224, 400], parameters: { mode: 'runOnceForAllItems', jsCode: ${J(code('route-request.js'))} } },
  output: [{ route: 'rcm', post: 'plain', method: 'step1', rcmBody: { method: 'step1' }, agency: { id: 'a', name: 'Agency', agentCode: 'AG' }, user: { id: 'c', email: 'a@b.c', name: 'A' } }]
});

const whichPath = switchCase({
  version: 3.4,
  config: { name: 'Which Path', position: [448, 400], parameters: { mode: 'rules', rules: { values: [
    { renameOutput: true, outputKey: 'respond', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'respond', operator: { type: 'string', operation: 'equals' } }] } },
    { renameOutput: true, outputKey: 'login', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'login_request', operator: { type: 'string', operation: 'equals' } }] } },
    { renameOutput: true, outputKey: 'rcm', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'rcm', operator: { type: 'string', operation: 'equals' } }] } },
    { renameOutput: true, outputKey: 'registry', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'registry', operator: { type: 'string', operation: 'equals' } }] } }
  ] }, options: {} } }
});

const sendResponse = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Send Response', position: [2688, 400], parameters: {
    respondWith: 'json',
    responseBody: expr('{{ JSON.stringify($json.response) }}'),
    options: { responseCode: expr('{{ $json.httpStatus || 200 }}'), responseHeaders: { entries: [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Cache-Control', value: 'no-store' }] } }
  } }
});

/* ---------- login ---------- */
const findAgentContact = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Find Agent Contact', position: [672, 160], alwaysOutputData: true, onError: 'continueRegularOutput', retryOnFail: true,
    credentials: ghlCred,
    parameters: { method: 'POST', url: ${J(GHL + '/contacts/search')}, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Version', value: '2021-07-28' }] },
      sendBody: true, specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ locationId: ${J(E.locationId)}, pageLimit: 5, filters: [{ field: "email", operator: "eq", value: $json.email }] }) }}'),
      options: { timeout: 20000 } } },
  output: [{ contacts: [{ id: 'c1', email: 'a@b.c', tags: ['agent_user'], businessId: 'b1', firstName: 'A' }] }]
});

const getAgencyRecord = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Get Agency Record', position: [896, 160], alwaysOutputData: true, onError: 'continueRegularOutput',
    credentials: ghlCred,
    parameters: { method: 'GET',
      url: expr('${GHL}/objects/business/records/{{ ((($json.contacts || []).find(c => String(c.email || "").toLowerCase() === $("Route Request").first().json.email) || ($json.contacts || [])[0] || {}).businessId) || "none" }}'),
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Version', value: '2021-07-28' }] },
      options: { timeout: 20000 } } },
  output: [{ record: { id: 'b1', properties: { name: 'Agency', agent_code: 'AG' } } }]
});

const issueLoginCode = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Issue Login Code', position: [1120, 160], parameters: { mode: 'runOnceForAllItems', jsCode: ${J(code('issue-login-code.js'))} } },
  output: [{ send: true, contactId: 'c1', subject: 's', html: 'h' }]
});

const sendCode = ifElse({
  version: 2.3,
  config: { name: 'Send Code?', position: [1344, 160], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and',
    conditions: [{ leftValue: expr('{{ $json.send }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] }, looseTypeValidation: true } }
});

const emailLoginCode = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Email Login Code', position: [1568, 80], alwaysOutputData: true, onError: 'continueRegularOutput',
    credentials: ghlCred,
    parameters: { method: 'POST', url: ${J(GHL + '/conversations/messages')}, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Version', value: '2021-04-15' }] },
      sendBody: true, specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ type: "Email", contactId: $json.contactId, subject: $json.subject, html: $json.html }) }}'),
      options: { timeout: 20000 } } },
  output: [{ messageId: 'm1' }]
});

const loginRequestReply = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Login Request Reply', position: [1792, 160], parameters: { mode: 'runOnceForAllItems',
    jsCode: ${J("const r = ($input.first() || {}).json || {};\nif (r.error || r.statusCode >= 400) console.log('Login code email failed: ' + JSON.stringify(r).slice(0, 300));\n/* Same answer whether or not the email belongs to an agent, so the endpoint cannot be used to probe for agents. */\nreturn [{ json: { httpStatus: 200, response: { status: 'OK', error: '', results: [{ sent: true }], issues: [], ms: 0 } } }];")} } },
  output: [{ httpStatus: 200, response: { status: 'OK' } }]
});

/* ---------- registry (bookings this API created, stored on the GHL Booking object) ---------- */
const loadAgentBookings = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Load Agent Bookings', position: [672, 640], alwaysOutputData: true, retryOnFail: true,
    credentials: ghlCred,
    parameters: { method: 'POST', url: ${J(GHL + '/objects/custom_objects.bookings/records/search')}, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Version', value: '2021-07-28' }] },
      sendBody: true, specifyBody: 'json',
      jsonBody: ${J(JSON.stringify({ locationId: E.locationId, page: 1, pageLimit: 100 }))},
      options: { timeout: 30000, pagination: { pagination: { paginationMode: 'updateAParameterInEachRequest',
        parameters: { parameters: [{ type: 'body', name: 'page', value: expr('{{ $pageCount + 1 }}') }] },
        paginationCompleteWhen: 'other', completeExpression: expr('{{ !$response.body.records || $response.body.records.length < 100 }}'),
        limitPagesFetched: true, maxRequests: 30, requestInterval: 150 } } } } },
  output: [{ records: [], total: 0 }]
});

const useRegistry = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Use Registry', position: [896, 640], parameters: { mode: 'runOnceForAllItems', jsCode: ${J(code('use-registry.js'))} } },
  output: [{ route: 'respond', httpStatus: 200, response: { status: 'OK' } }]
});

const registryNeedsRcm = ifElse({
  version: 2.3,
  config: { name: 'Needs RCM?', position: [1120, 640], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and',
    conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'rcm', operator: { type: 'string', operation: 'equals' } }] }, looseTypeValidation: true } }
});

/* ---------- RCM (mirror / source of truth during transition) ---------- */
const prepareRcmCall = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Prepare RCM Call', position: [1344, 400], parameters: { mode: 'runOnceForAllItems', jsCode: ${J(code('prepare-rcm-call.js'))} } },
  output: [{ route: 'rcm', api: 'web', post: 'plain', method: 'step1', rcmBody: { method: 'step1' }, bodyString: '{"method":"step1"}', signature: 'x' }]
});

const whichRcmApi = ifElse({
  version: 2.3,
  config: { name: 'Post-Booking API?', position: [1568, 400], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and',
    conditions: [{ leftValue: expr('{{ $json.api }}'), rightValue: 'post', operator: { type: 'string', operation: 'equals' } }] }, looseTypeValidation: true } }
});

const callRcmWeb = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Call RCM Web API', position: [1792, 480], alwaysOutputData: true, onError: 'continueRegularOutput',
    parameters: { method: 'POST', url: ${J('https://apis.rentalcarmanager.com/booking/v3.2/?apikey=' + RCM_USER)},
      sendHeaders: true, headerParameters: { parameters: [{ name: 'signature', value: expr('{{ $json.signature }}') }] },
      sendBody: true, contentType: 'raw', rawContentType: 'application/json', body: expr('{{ $json.bodyString }}'),
      options: { timeout: 45000, response: { response: { neverError: true } } } } },
  output: [{ status: 'OK', error: '', results: {} }]
});

const getRcmToken = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Get RCM Token', position: [1792, 320], executeOnce: true, retryOnFail: true,
    parameters: { method: 'POST', url: 'https://api.rentalcarmanager.com/v32/token',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Accept', value: 'application/json' }] },
      sendBody: true, contentType: 'form-urlencoded',
      bodyParameters: { parameters: [{ name: 'username', value: ${J(RCM_USER)} }, { name: 'password', value: ${J(RCM_PASS)} }, { name: 'grant_type', value: 'password' }] },
      options: { timeout: 30000 } } },
  output: [{ access_token: 't' }]
});

const callRcm = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Call RCM Post-Booking', position: [2016, 320], alwaysOutputData: true, onError: 'continueRegularOutput',
    parameters: { method: 'POST', url: 'https://api.rentalcarmanager.com/v32/api',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'authorization', value: expr('Bearer {{ $json.access_token }}') }] },
      sendBody: true, contentType: 'raw', rawContentType: 'application/json', body: expr('{{ $("Prepare RCM Call").first().json.bodyString }}'),
      options: { timeout: 45000, response: { response: { neverError: true } } } } },
  output: [{ status: 'OK', error: '', results: {} }]
});

const shapeRcmReply = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Shape RCM Reply', position: [2240, 400], parameters: { mode: 'runOnceForAllItems', jsCode: ${J(code('shape-rcm-reply.js'))} } },
  output: [{ route: 'respond', httpStatus: 200, response: { status: 'OK' } }]
});

const afterRcm = switchCase({
  version: 3.4,
  config: { name: 'After RCM', position: [2464, 400], parameters: { mode: 'rules', rules: { values: [
    { renameOutput: true, outputKey: 'respond', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'respond', operator: { type: 'string', operation: 'equals' } }] } },
    { renameOutput: true, outputKey: 'save', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'save', operator: { type: 'string', operation: 'equals' } }] } },
    { renameOutput: true, outputKey: 'cancelled', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and', conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'mark_cancelled', operator: { type: 'string', operation: 'equals' } }] } }
  ] }, options: {} } }
});

const saveAgentBooking = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Save Agent Booking', position: [2688, 560], alwaysOutputData: true, onError: 'continueRegularOutput', retryOnFail: true,
    credentials: ghlCred,
    parameters: { method: 'POST', url: ${J(GHL + '/objects/custom_objects.bookings/records')}, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Version', value: '2021-07-28' }] },
      sendBody: true, specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ locationId: ${J(E.locationId)}, properties: $json.properties }) }}'),
      options: { timeout: 30000 } } },
  output: [{ record: { id: 'r1' } }]
});

const markBookingCancelled = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: { name: 'Mark Booking Cancelled', position: [2688, 720], alwaysOutputData: true, onError: 'continueRegularOutput', retryOnFail: true,
    credentials: ghlCred,
    parameters: { method: 'PUT', url: expr('${GHL}/objects/custom_objects.bookings/records/{{ $json.recordId }}?locationId=${E.locationId}'), authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Version', value: '2021-07-28' }] },
      sendBody: true, specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ properties: $json.properties }) }}'),
      options: { timeout: 30000 } } },
  output: [{ record: { id: 'r1' } }]
});

const writeReply = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Write Reply', position: [2912, 640], parameters: { mode: 'runOnceForAllItems',
    jsCode: ${J("const w = ($input.first() || {}).json || {};\nconst src = $('After RCM').first().json;\nconst ok = !!(w.record && w.record.id) || !!w.id;\nconst issues = ok ? [] : ['Saved in the booking system but not yet in the agent register; Waka Campa has been alerted.'];\nif (!ok) console.log('Agent register write failed for ' + JSON.stringify(src.reply) + ': ' + JSON.stringify(w).slice(0, 400));\nreturn [{ json: { httpStatus: 200, response: { status: 'OK', error: '', results: src.reply, issues, ms: 0 }, registerFailed: !ok } }];")} } },
  output: [{ httpStatus: 200, response: { status: 'OK' } }]
});

const sendWriteResponse = node({
  type: 'n8n-nodes-base.respondToWebhook', version: 1.5,
  config: { name: 'Send Write Response', position: [3136, 640], parameters: {
    respondWith: 'json', responseBody: expr('{{ JSON.stringify($json.response) }}'),
    options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Cache-Control', value: 'no-store' }] } }
  } }
});

const notes = sticky(${J(`## ${E.name}\nOur replacement for the RCM Agent API. One endpoint: POST {"method": ...} with a Bearer session token.\n\n**Phase 1 (this version):** pricing, availability, the booking and cancellation go through RCM's v3.2 Web Booking API (apikey + HMAC) as Waka Campa, with no RCM agent: the agency is written into the booking notes, and commission comes from the agency's GHL record. bookinginfo uses RCM's Post-Booking API (token). RCM stays the single inventory. GHL holds agent identity and the agency's booking register.\n\n**Agents:** GHL Contact tagged agent_user, linked to a Company with custom fields agent_code, commission_pct, can_cancel, commission_on_fees, allow_agent_collected, portal_enabled.\n\n**Login:** 6-digit code emailed via GHL, hashed in workflow static data (production executions only).\n\n**Secrets:** token secret lives in the Config block of each Code node; RCM token credentials in Get RCM Token. Neither is in GitHub.\n\nSource: github repo wakacampa-agent-portal, n8n/src. Rebuild with scripts/build-n8n.js rather than hand-editing Code nodes.`)}, [], { color: 4, position: [0, -40], width: 420, height: 380 });

export default workflow(${J(E.name)}, ${J(E.name)})
  .add(notes)
  .add(agentApiRequest)
  .to(routeRequest)
  .to(whichPath
    .onCase(0, sendResponse)
    .onCase(1, findAgentContact.to(getAgencyRecord.to(issueLoginCode.to(sendCode
      .onTrue(emailLoginCode.to(loginRequestReply.to(sendResponse)))
      .onFalse(loginRequestReply)))))
    .onCase(2, prepareRcmCall.to(whichRcmApi
      .onTrue(getRcmToken.to(callRcm.to(shapeRcmReply.to(afterRcm
        .onCase(0, sendResponse)
        .onCase(1, saveAgentBooking.to(writeReply.to(sendWriteResponse)))
        .onCase(2, markBookingCancelled.to(writeReply))))))
      .onFalse(callRcmWeb.to(shapeRcmReply))))
    .onCase(3, loadAgentBookings.to(useRegistry.to(registryNeedsRcm
      .onTrue(prepareRcmCall)
      .onFalse(sendResponse)))));
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, sdk);
console.log('wrote ' + path.relative(root, out) + (SECRET === '__SET_IN_N8N__' ? ' (placeholders, no secrets)' : ' (WITH SECRETS - do not commit)'));
