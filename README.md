# Waka Campa Agent Portal

Our replacement for Rental Car Manager's Agent API: a portal travel agents sign in to, and an Agent API behind it that speaks RCM's method names and response envelope, so moving agents off RCM's Agent API needs no retraining and minimal code changes for any agency that integrates directly.

| Part | Where it runs | What it does |
| --- | --- | --- |
| `portal/` | GitHub Pages (static) | Agent sign-in, search, extras, hirer details, book or quote, My bookings, booking detail, cancel |
| `n8n/` | n8n (`dev_Agent API` on staging) | The Agent API: one webhook, `POST {"method": ...}` with a Bearer session token |
| `engine/` | Inside n8n Code nodes, in the portal's demo mode, and in tests | Pricing, availability and booking rules (RCM step1/2/3, calctotal, booking, bookinginfo, agentbookings, cancel) |
| GHL | GoHighLevel | Agents (Contacts tagged `agent_user`), agencies (Companies with agent fields), the agent booking register (Booking custom object) |

Spec and architecture: see the "Waka Campa Agent Portal - Spec & Architecture" doc.

## Phases

1. **Mirror mode (built).** Search, prices, availability and the booking itself go to RCM's Web Booking API, so RCM stays the one inventory while web bookings still live there. The existing RCM to GHL workflows (New Booking etc.) keep creating the opportunity and sending emails. bookinginfo and cancel go through RCM's Post-Booking API. Our side owns sign-in, agency scoping (an agent only ever sees and cancels their agency's bookings, and the agent code is forced from the agency record), and the agent booking register in GHL.
2. **Own engine (built and tested, not switched on).** `engine/core.js` reproduces RCM's step2/step3/calctotal maths from a catalogue held in GHL. Run it side by side with RCM until totals match, then flip the n8n route.
3. **Cutover.** Web bookings move too; RCM is switched off.

## Run it

```bash
npm test                 # engine + n8n flow tests (no network)
npm run build:portal     # copies the engine and demo data into portal/vendor
npm run serve            # http://localhost:8080 - demo mode, sign-in code 123456
```

Point the portal at the real API by setting `apiUrl` in `portal/config.js`:

- staging: `https://n8n.wakacampa.com/webhook/dev-agent-api`
- live (later): `https://n8n.wakacampa.com/webhook/agent-api`

## Deploy the n8n workflow

Code nodes are generated from `n8n/src/*.js` - edit those, not the nodes.

```bash
AGENT_TOKEN_SECRET=... RCM_USERNAME=... RCM_PASSWORD=... \
  node scripts/build-n8n.js --env staging --out /tmp/agent-api.staging.js
```

Then create/update the workflow from that file (n8n MCP `update_workflow`, id `h92Mh5FWvUH0shwP` for staging). The committed `n8n/agent-api.staging.workflow.js` has `__SET_IN_N8N__` placeholders and no secrets.

After deploying:

1. In n8n, set the GHL credential on the 6 GHL HTTP nodes (Find Agent Contact, Get Agency Record, Email Login Code, Load Agent Bookings, Save Agent Booking, Mark Booking Cancelled) to the staging private-integration header credential the other dev_ workflows use.
2. Publish the workflow. Login codes live in workflow static data, which n8n only saves on production executions.

## Set up an agency in GHL

See `ghl/setup.md`.

## API

`POST /webhook/dev-agent-api`, JSON body `{ "method": "<name>", ...params }`, header `Authorization: Bearer <token>` (except the two login methods). Responses use RCM's envelope: `{ status: "OK"|"ERR", error, results: [...], issues, ms, code? }`.

| Method | Notes |
| --- | --- |
| `login.request` `{email}` | Emails a 6-digit code if the email is an agent user of an enabled agency. Same reply either way. |
| `login.verify` `{email, code}` | Returns `{token, user, agency}`. Token lasts 12 h. |
| `me` | Agency, agent code, commission %, cancel permission |
| `step1`, `step2`/`search`, `step3`/`select`, `calctotal` | As RCM v3.2. `agentcode` is always the agency's. |
| `booking` | As RCM v3.2. `agentcode`, `agentname`, `agentemail` are forced from the session; `agentcollectedamount` only if the agency allows it. Optional `expectedtotal` and `display*` fields are used for the register. |
| `agentbookings` | `reservationno`, or `startdate`+`enddate` (+ `bookingstatus`, `datefield=pickup`) |
| `bookinginfo` | `reservationref` or `reservationno`; own agency only |
| `cancelreasons`, `cancelbooking` | Own agency only, and only if the agency has `can_cancel` |
| `locations`, `locationdetails`, `categorytypes`, `categorylist`, `driverages`, `countries`, `donotrent`, `packages`, `relocationspecials`, `customfields` | Passed through to RCM |

`docs/rcm-agent-api-reference.md` has every RCM method, parameter and output field captured from the sandbox.
