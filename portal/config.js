/*
 * Portal configuration.
 * apiUrl: the production webhook URL of the "dev_Agent API" n8n workflow (staging)
 *         or "Agent API" (live). Leave empty to run in demo mode with sample data.
 */
window.PORTAL_CONFIG = {
  apiUrl: 'https://n8n.wakacampa.com/webhook/dev-agent-api',
  brand: 'Waka Campa',
  logoUrl: 'https://storage.googleapis.com/msgsndr/wMnxsKTekNKeaukJxYh8/media/17385b50-5c58-4caf-8349-97b9179032b2.jpg',
  supportEmail: 'support@wakacampa.com',
  defaultPickupTime: '10:00',
  defaultDropoffTime: '10:00',
  /* Fallback vehicle photos by category name (RCM's own images). RCM's imageurl is used first when it sends one. */
  vehicleImages: {
    'outrider': 'https://rentalcarmanagerau.blob.core.windows.net/public/nzwakacampa737/outrider.jpg',
    'explorer neo': 'https://rentalcarmanagerau.blob.core.windows.net/public/nzwakacampa737/explorer-neo_rcm.jpeg',
    'explorer': 'https://rentalcarmanagerau.blob.core.windows.net/public/nzwakacampa737/explorer_rcm.jpeg',
    'explorer saver': 'https://rentalcarmanagerau.blob.core.windows.net/public/nzwakacampa737/explorer-saver_rcm.jpeg'
  }
};
