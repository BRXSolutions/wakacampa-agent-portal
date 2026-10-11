/*
 * Portal configuration.
 * apiUrl: the production webhook URL of the "dev_Agent API" n8n workflow (staging)
 *         or "Agent API" (live). Leave empty to run in demo mode with sample data.
 */
window.PORTAL_CONFIG = {
  apiUrl: 'https://n8n.wakacampa.com/webhook/dev-agent-api',
  brand: 'Waka Campa',
  supportEmail: 'bookings@wakacampa.com',
  defaultPickupTime: '10:00',
  defaultDropoffTime: '10:00'
};
