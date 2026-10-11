/*
 * Portal configuration.
 * apiUrl: the production webhook URL of the "dev_Agent API" n8n workflow (staging)
 *         or "Agent API" (live). Leave empty to run in demo mode with sample data.
 */
window.PORTAL_CONFIG = {
  apiUrl: '',
  brand: 'Waka Campa',
  supportEmail: 'bookings@wakacampa.com',
  defaultPickupTime: '10:00',
  defaultDropoffTime: '10:00'
};
