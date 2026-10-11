# GHL setup for the agent portal

Do this in **Waka Campa Staging** first, then in live when we go live.

## 1. Company (agency) custom fields

Settings > Custom Fields > Companies. The workflow reads these by field key:

| Field key | Type | Meaning |
| --- | --- | --- |
| `agent_code` | Text | The agency's RCM agent code. Required: no code, no login. |
| `commission_pct` | Number | Commission %, shown to the agent; RCM still calculates the booking's commission in phase 1 |
| `can_cancel` | Checkbox / Yes-No | Agents may cancel their own bookings. Default yes. |
| `commission_on_fees` | Checkbox / Yes-No | Phase 2 engine: commission also on fees flagged pay-agency |
| `allow_agent_collected` | Checkbox / Yes-No | Agent may record an amount they collected (`agentcollectedamount`) |
| `portal_enabled` | Checkbox / Yes-No | Switch the whole agency off without deleting anything. Default yes. |

If GHL prefixes the keys (for example `business.agent_code`), the workflow accepts that too.

## 2. Agent users

For each person at the agency:

1. Create or find their Contact (their work email).
2. Add the tag `agent_user`.
3. Associate the Contact with the agency's Company.

They can now sign in at the portal with that email.

## 3. Booking register

Portal bookings are written to the existing **Booking** custom object (`custom_objects.bookings`) with Rental Source `Agent portal - <agency>` and the full record in `booking_json`. No new fields are needed for phase 1.

## Test agency (staging)

Create a Company "Test Agency" with `agent_code` set to the code RCM uses for a test agent, and a Contact with an `@wakacampa.com` email tagged `agent_user`. Bookings made with an `@wakacampa.com` hirer email follow the existing rule and route to staging.
