import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Certification Context
export let currentJourney = 'UNKNOWN_JOURNEY';
export let currentStep = 'UNKNOWN_STEP';

export function setJourneyContext(journey: string, step: string) {
  currentJourney = journey;
  currentStep = step;
  console.log(`\n▶ [${journey}] ${step}`);
}

// Log files
export const LOG_DIR = path.join(__dirname, 'certification-logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const DB_MUTATIONS_FILE = path.join(LOG_DIR, 'db-mutations.json');
const API_TRAFFIC_FILE = path.join(LOG_DIR, 'api-traffic.json');

// Initialize logs if they don't exist
if (!fs.existsSync(DB_MUTATIONS_FILE)) fs.writeFileSync(DB_MUTATIONS_FILE, '[]');
if (!fs.existsSync(API_TRAFFIC_FILE)) fs.writeFileSync(API_TRAFFIC_FILE, '[]');

function appendDbMutation(entry: any) {
  const data = JSON.parse(fs.readFileSync(DB_MUTATIONS_FILE, 'utf8'));
  data.push(entry);
  fs.writeFileSync(DB_MUTATIONS_FILE, JSON.stringify(data, null, 2));
}

function appendApiTraffic(entry: any) {
  const data = JSON.parse(fs.readFileSync(API_TRAFFIC_FILE, 'utf8'));
  data.push(entry);
  fs.writeFileSync(API_TRAFFIC_FILE, JSON.stringify(data, null, 2));
}

// Initialize Prisma
const pool = new Pool({ connectionString: 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db' });
const adapter = new PrismaPg(pool);

// Prisma Extension for Logging Mutations
export const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const isMutation = ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(operation);
        const result = await query(args);
        
        if (isMutation) {
          appendDbMutation({
            journey: currentJourney,
            step: currentStep,
            timestamp: new Date().toISOString(),
            model,
            operation,
            args,
            result: isMutation ? (Array.isArray(result) ? result.length + ' records' : result) : null
          });
        }
        return result;
      }
    }
  }
}) as unknown as PrismaClient;

export const BASE_URL = 'http://localhost:5000/api';

export function createCertificationSession(): AxiosInstance {
  const cookieStore = new Map<string, string>();

  const instance = axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true,
  });

  instance.interceptors.request.use((config) => {
    config.headers['x-request-start'] = Date.now().toString();
    
    if (cookieStore.size > 0) {
      config.headers['Cookie'] = Array.from(cookieStore.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }

    const csrfToken = cookieStore.get('csrf_token');
    if (csrfToken && config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
      config.headers['x-csrf-token'] = csrfToken;
    }

    return config;
  });

  instance.interceptors.response.use(async (response) => {
    const startTime = parseInt(response.config.headers?.['x-request-start'] as string || Date.now().toString(), 10);
    const duration = Date.now() - startTime;
    
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      (Array.isArray(setCookie) ? setCookie : [setCookie]).forEach((cookieStr: string) => {
        const [nameValue] = cookieStr.split(';');
        const eqIdx = nameValue.indexOf('=');
        if (eqIdx > -1) {
          const name = nameValue.substring(0, eqIdx).trim();
          const value = nameValue.substring(eqIdx + 1).trim();
          if (value === '' || cookieStr.includes('Max-Age=0')) {
            cookieStore.delete(name);
          } else {
            cookieStore.set(name, value);
          }
        }
      });
    }

    let reqBody = response.config.data;
    if (typeof reqBody === 'string') {
      try { reqBody = JSON.parse(reqBody); } catch(e) {}
    }

    appendApiTraffic({
      journey: currentJourney,
      step: currentStep,
      timestamp: new Date().toISOString(),
      method: (response.config.method || 'GET').toUpperCase(),
      url: response.config.url,
      requestHeaders: response.config.headers,
      requestBody: reqBody,
      responseStatus: response.status,
      responseBody: response.data,
      durationMs: duration
    });

    if (response.status === 429 && !(response.config as any)._retry) {
      (response.config as any)._retry = true;
      console.log(`⚠️ Global 429 on ${response.config.url}, waiting 10s...`);
      await new Promise(r => setTimeout(r, 10000));
      return instance.request(response.config);
    }

    return response;
  }, async (error) => {
    // Check if 429
    if (error.response?.status === 429 && error.config && !(error.config as any)._retry) {
      (error.config as any)._retry = true;
      console.log(`⚠️ Global 429 on ${error.config.url}, waiting 10s...`);
      await new Promise(r => setTimeout(r, 10000));
      return instance.request(error.config);
    }
    
    const response = error.response;
    if (response) {
      const startTime = parseInt(response.config.headers?.['x-request-start'] as string || Date.now().toString(), 10);
      const duration = Date.now() - startTime;
      
      let reqBody = response.config.data;
      if (typeof reqBody === 'string') {
        try { reqBody = JSON.parse(reqBody); } catch(e) {}
      }
      
      appendApiTraffic({
        journey: currentJourney,
        step: currentStep,
        timestamp: new Date().toISOString(),
        method: (response.config.method || 'GET').toUpperCase(),
        url: response.config.url,
        requestHeaders: response.config.headers,
        requestBody: reqBody,
        responseStatus: response.status,
        responseBody: response.data,
        durationMs: duration
      });
    }
    return response || Promise.reject(error);
  });

  return instance;
}

export const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function createTestUser(email: string, role = 'USER', companyId: string | null = null) {
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash('SecurePassword123!', 10);
  return await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Test User',
      role: role as any,
      isVerified: true,
      companyId
    }
  });
}

export async function createCsrfCertificationSession(): Promise<AxiosInstance> {
  const sess = createCertificationSession();
  let res = await sess.get('/auth/csrf');
  let retries = 0;
  while (res.status === 429 && retries < 10) {
    console.log(`⚠️ Rate limited getting CSRF, waiting 10s... (Retry ${retries + 1}/10)`);
    await delay(10000);
    res = await sess.get('/auth/csrf');
    retries++;
  }
  if (res.status !== 200) throw new Error(`Failed to get CSRF token: ${res.status}`);
  return sess;
}

export async function cleanupCertification() {
  await prisma.$disconnect();
}
