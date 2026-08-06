import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { injectInterceptor } from './api-interceptor';

const SWAGGER_PATH = path.join(__dirname, '../../swagger-spec.json');
const swaggerSpec = JSON.parse(fs.readFileSync(SWAGGER_PATH, 'utf8'));
const BASE_URL = 'http://localhost:5000/api';

// Create interceptor-enabled session
const cookieStore = new Map<string, string>();
const sess = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

sess.interceptors.request.use((config) => {
  if (cookieStore.size > 0) {
    config.headers['Cookie'] = Array.from(cookieStore.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
  const csrfToken = cookieStore.get('csrf_token');
  if (
    csrfToken &&
    config.method &&
    !['get', 'head', 'options'].includes(config.method.toLowerCase())
  ) {
    config.headers['x-csrf-token'] = csrfToken;
  }
  return config;
});

sess.interceptors.response.use((response) => {
  const setCookie = response.headers['set-cookie'];
  if (setCookie) {
    (Array.isArray(setCookie) ? setCookie : [setCookie]).forEach(
      (cStr: string) => {
        const [nameValue] = cStr.split(';');
        const eqIdx = nameValue.indexOf('=');
        if (eqIdx > -1) {
          cookieStore.set(
            nameValue.substring(0, eqIdx).trim(),
            nameValue.substring(eqIdx + 1).trim(),
          );
        }
      },
    );
  }
  return response;
});

injectInterceptor(sess);

// Utility to resolve references
function resolveRef(ref: string) {
  if (!ref) return null;
  const parts = ref.split('/');
  let current: any = swaggerSpec;
  for (let i = 1; i < parts.length; i++) {
    current = current[parts[i]];
    if (!current) return null;
  }
  return current;
}

// Generate payload from schema
function generatePayload(schema: any): any {
  if (!schema) return {};
  if (schema.$ref) schema = resolveRef(schema.$ref);
  if (!schema) return {};

  if (schema.example) return schema.example;

  if (schema.type === 'object' && schema.properties) {
    const obj: any = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      obj[key] = generatePayload(val);
    }
    return obj;
  }
  if (schema.type === 'array' && schema.items) {
    return [generatePayload(schema.items)];
  }
  if (schema.type === 'string') {
    if (schema.format === 'email') return 'test@example.com';
    if (schema.format === 'date-time') return new Date().toISOString();
    return 'test-string';
  }
  if (schema.type === 'number' || schema.type === 'integer') return 1;
  if (schema.type === 'boolean') return true;
  return 'unknown';
}

async function run() {
  const adminEmail = process.env.API_CRAWLER_ADMIN_EMAIL;
  const adminPassword = process.env.API_CRAWLER_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      'API_CRAWLER_ADMIN_EMAIL and API_CRAWLER_ADMIN_PASSWORD are required.',
    );
  }

  console.log('Fetching CSRF token...');
  await sess.get('/auth/csrf');

  console.log('Logging in as admin...');
  await sess.post('/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });

  const paths = swaggerSpec.paths;
  for (const [routePath, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(
      methods as Record<string, any>,
    )) {
      // Avoid destroying data if possible, but user wants everything executed
      // We will skip pure logout so we don't invalidate our token midway
      if (routePath === '/auth/logout' || routePath.includes('export'))
        continue;

      let url = `${BASE_URL}${routePath}`;
      // Replace path parameters with generic ID
      url = url.replace(/\{([^}]+)\}/g, '1');

      let payload = undefined;
      if (
        operation.requestBody &&
        operation.requestBody.content &&
        operation.requestBody.content['application/json']
      ) {
        payload = generatePayload(
          operation.requestBody.content['application/json'].schema,
        );
      }

      console.log(`Executing ${method.toUpperCase()} ${url}...`);
      await sess({
        method,
        url,
        data: payload,
      });
    }
  }
  console.log('API Crawler finished.');
}

run().catch(console.error);
