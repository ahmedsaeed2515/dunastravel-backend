import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://dunastravel-backend-seven.vercel.app/api';
const RUNTIME_DIR = path.join(__dirname, '../../docs/runtime');
const RESPONSES_DIR = path.join(RUNTIME_DIR, 'responses');
const JSON_DIR = path.join(RUNTIME_DIR, 'json');

// Ensure directories exist
if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
if (!fs.existsSync(RESPONSES_DIR)) fs.mkdirSync(RESPONSES_DIR, { recursive: true });
if (!fs.existsSync(JSON_DIR)) fs.mkdirSync(JSON_DIR, { recursive: true });

const endpoints = [
  // Auth
  { name: 'register', method: 'POST', url: '/auth/register', payload: { name: 'Test User', email: 'test_user_unique_123@example.com', password: 'Password123' }, auth: false },
  { name: 'login', method: 'POST', url: '/auth/login', payload: { email: 'test_user_unique_123@example.com', password: 'Password123' }, auth: false },
  { name: 'csrf', method: 'GET', url: '/auth/csrf', auth: false },
  { name: 'get_me', method: 'GET', url: '/auth/me', auth: true },
  
  // Public Tours
  { name: 'get_tours', method: 'GET', url: '/tours', auth: false },
  
  // Public Inquiries
  { name: 'create_inquiry', method: 'POST', url: '/inquiries', payload: { fullName: 'Test', email: 'test@example.com', message: 'Hello' }, auth: false },
  
  // Public Currency
  { name: 'get_rates', method: 'GET', url: '/currency/rates', auth: false },

  // Admin Bookings
  { name: 'admin_get_bookings', method: 'GET', url: '/admin/bookings', auth: true },

  // Admin Tours
  { name: 'admin_get_tours', method: 'GET', url: '/admin/tours', auth: true },

  // Admin Wallets
  { name: 'admin_get_wallet_metrics', method: 'GET', url: '/admin/finance/wallets/metrics', auth: true },

  // Settings
  { name: 'get_settings', method: 'GET', url: '/settings', auth: false },
];

let globalCookies: string[] = [];
let jwtToken: string = '';

async function run() {
  console.log('Starting API execution against', BASE_URL);

  for (const ep of endpoints) {
    console.log(`Executing ${ep.method} ${ep.url}...`);
    
    const startTime = Date.now();
    let res;
    let errorObj = null;

    try {
      res = await axios({
        method: ep.method,
        url: `${BASE_URL}${ep.url}`,
        data: ep.payload,
        headers: {
          'Content-Type': 'application/json',
          ...(ep.auth && jwtToken ? { 'Authorization': `Bearer ${jwtToken}` } : {}),
          ...(globalCookies.length > 0 ? { 'Cookie': globalCookies.join('; ') } : {})
        },
        validateStatus: () => true // Resolve all statuses
      });

      // Capture cookies
      if (res.headers['set-cookie']) {
        const rawCookies = res.headers['set-cookie'];
        const parsedCookies = rawCookies.map(c => c.split(';')[0]);
        globalCookies = parsedCookies;
        
        const accessTokenCookie = parsedCookies.find(c => c.startsWith('access_token='));
        if (accessTokenCookie) {
          jwtToken = accessTokenCookie.substring('access_token='.length);
        }
      }
    } catch (err: any) {
      errorObj = err;
      res = err.response || { status: 500, data: { message: err.message }, headers: {} };
    }

    const duration = Date.now() - startTime;

    // Save JSON payload
    const jsonFilename = path.join(JSON_DIR, `${ep.method}_${ep.name.toLowerCase()}.json`);
    fs.writeFileSync(jsonFilename, JSON.stringify(res.data, null, 2));

    // Save Markdown
    const mdFilename = path.join(RESPONSES_DIR, `${ep.method}_${ep.name.toLowerCase()}.md`);
    const mdContent = `
# Endpoint: ${ep.url}

- **HTTP Method:** ${ep.method}
- **Authentication:** ${ep.auth ? 'Required' : 'None'}
- **HTTP Status:** ${res.status}
- **Performance:** ${duration}ms

## Body Sent
\`\`\`json
${JSON.stringify(ep.payload || {}, null, 2)}
\`\`\`

## Formatted JSON Response
\`\`\`json
${JSON.stringify(res.data, null, 2)}
\`\`\`

## Response Headers
\`\`\`json
${JSON.stringify(res.headers, null, 2)}
\`\`\`
    `;
    fs.writeFileSync(mdFilename, mdContent);
    console.log(`Saved ${ep.name} (Status: ${res.status}, Time: ${duration}ms)`);
  }
}

run().catch(console.error);
