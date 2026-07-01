import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import axios, { AxiosInstance } from 'axios';
import { injectInterceptor } from '../src/scripts/api-interceptor';

// Initialize Prisma with pg adapter
const pool = new Pool({ connectionString: 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db' });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

// Base URL for the running application
export const BASE_URL = 'http://localhost:5000/api';

/**
 * Creates a new stateful HTTP session.
 * - Maintains a cookie store manually (supports httpOnly cookies)
 * - Automatically injects x-csrf-token header for state-changing requests
 * - Extracts and stores access_token + csrf_token from Set-Cookie headers
 */
export function createSession(): AxiosInstance {
  const cookieStore = new Map<string, string>(); // name → value

  const instance = axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true,
  });

  // ── Request interceptor: inject Cookie header + CSRF header ──
  instance.interceptors.request.use((config) => {
    // Build cookie string from store
    if (cookieStore.size > 0) {
      config.headers['Cookie'] = Array.from(cookieStore.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }

    // Inject CSRF token for mutating requests
    const csrfToken = cookieStore.get('csrf_token');
    if (csrfToken && config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
      config.headers['x-csrf-token'] = csrfToken;
    }

    return config;
  });

  // ── Response interceptor: capture Set-Cookie headers ──
  instance.interceptors.response.use((response) => {
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      (Array.isArray(setCookie) ? setCookie : [setCookie]).forEach((cookieStr: string) => {
        // Parse: "name=value; Path=/; HttpOnly; ..."
        const [nameValue] = cookieStr.split(';');
        const eqIdx = nameValue.indexOf('=');
        if (eqIdx > -1) {
          const name = nameValue.substring(0, eqIdx).trim();
          const value = nameValue.substring(eqIdx + 1).trim();
          if (value === '' || cookieStr.includes('Max-Age=0') || cookieStr.includes('expires=Thu, 01 Jan 1970')) {
            cookieStore.delete(name);
          } else {
            cookieStore.set(name, value);
          }
        }
      });
    }
    return response;
  });

  injectInterceptor(instance);

  return instance;
}

/**
 * Bootstraps a session with a fresh CSRF token from the server.
 */
export async function createCsrfSession(): Promise<AxiosInstance> {
  const sess = createSession();
  // Fetch CSRF token — server sets csrf_token cookie + returns body
  const csrfRes = await sess.get('/auth/csrf');
  if (csrfRes.status !== 200) {
    throw new Error(`Failed to get CSRF token: ${csrfRes.status}`);
  }
  return sess;
}

export async function cleanup() {
  await prisma.$disconnect();
}
