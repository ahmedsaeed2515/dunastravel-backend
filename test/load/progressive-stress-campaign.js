import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
const cacheHits = new Counter('cache_hits_total');
const cacheMisses = new Counter('cache_misses_total');
const notModified304 = new Counter('http_304_total');
const errorRate = new Rate('errors');
const droppedRate = new Rate('throttled_or_dropped');
const p50Trend = new Trend('duration_p50');
const catalogTrend = new Trend('catalog_duration');

// Parameterized User Scale or Full Progressive Ladder
const TARGET_USERS = parseInt(__ENV.USERS || '0', 10);
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api';

// Scenario Configuration
export const options = {
  scenarios: TARGET_USERS > 0
    ? {
        // Targeted single-stage test for exact user scale (e.g. 5,000 or 10,000)
        targeted_user_stage: {
          executor: 'ramping-arrival-rate',
          startRate: Math.max(10, Math.round(TARGET_USERS / 120)),
          timeUnit: '1s',
          preAllocatedVUs: 150,
          maxVUs: 600,
          stages: [
            { target: Math.round(TARGET_USERS / 60.0), duration: '15s' }, // Ramp to user target rate
            { target: Math.round(TARGET_USERS / 60.0), duration: '30s' }, // Hold steady state
            { target: 20, duration: '10s' },                             // Cooldown
          ],
        },
      }
    : {
        // Full Progressive User Escalation Campaign: 5k -> 7.5k -> 10k -> 12.5k -> 15k -> 17.5k -> 20k -> 22.5k -> 25k
        progressive_campaign: {
          executor: 'ramping-arrival-rate',
          startRate: 30,
          timeUnit: '1s',
          preAllocatedVUs: 150,
          maxVUs: 750,
          stages: [
            { target: 83, duration: '20s' },  //  5,000 User-Equivalent (83.3 RPS)
            { target: 125, duration: '20s' }, //  7,500 User-Equivalent (125 RPS)
            { target: 167, duration: '20s' }, // 10,000 User-Equivalent (166.7 RPS)
            { target: 208, duration: '20s' }, // 12,500 User-Equivalent (208.3 RPS)
            { target: 250, duration: '20s' }, // 15,000 User-Equivalent (250 RPS)
            { target: 292, duration: '20s' }, // 17,500 User-Equivalent (291.7 RPS)
            { target: 333, duration: '20s' }, // 20,000 User-Equivalent (333.3 RPS)
            { target: 375, duration: '20s' }, // 22,500 User-Equivalent (375 RPS)
            { target: 417, duration: '20s' }, // 25,000 User-Equivalent (416.7 RPS)
            { target: 30, duration: '15s' },  // Recovery & Post-Stress Settling
          ],
        },
      },
  thresholds: {
    'http_req_duration': ['p(95)<2500'],
    'errors': ['rate<0.05'],
  },
};

const TOURS = [
  'classic-program',
  'cairo-express-4d',
  'honeymoon-egypt',
  'cairo-express-alexandria-5d',
  'holy-family-egypt',
];

const BLOGS = [
  'grand-egyptian-museum-guide-2026',
  'luxury-nile-cruise-luxor-aswan',
];

// Per-VU cache simulated state
let cachedTourEtag = null;
let cachedDestEtag = null;

export default function () {
  const rand = Math.random();
  let res;

  // 1. Journey A: 70% Anonymous / Catalog Explorer
  if (rand < 0.70) {
    // Destinations
    const destHeaders = cachedDestEtag ? { 'If-None-Match': cachedDestEtag } : {};
    res = http.get(`${BASE_URL}/destinations`, { headers: destHeaders });
    if (res.headers['Etag'] || res.headers['ETag']) {
      cachedDestEtag = res.headers['Etag'] || res.headers['ETag'];
    }
    recordTelemetry(res);

    // Tours catalog page with conditional GET revalidation
    const tourHeaders = cachedTourEtag ? { 'If-None-Match': cachedTourEtag } : {};
    const start = new Date();
    res = http.get(`${BASE_URL}/tours?limit=10&page=1`, { headers: tourHeaders });
    if (res.headers['Etag'] || res.headers['ETag']) {
      cachedTourEtag = res.headers['Etag'] || res.headers['ETag'];
    }
    catalogTrend.add(new Date() - start);
    recordTelemetry(res);

    check(res, { 'catalog valid (200/304)': (r) => r.status === 200 || r.status === 304 });
  }
  // 2. Journey B: 20% Inquiry / Direct Lead
  else if (rand < 0.90) {
    const slug = TOURS[Math.floor(Math.random() * TOURS.length)];
    res = http.get(`${BASE_URL}/tours/${slug}`);
    recordTelemetry(res);

    res = http.get(`${BASE_URL}/currency/rates`);
    recordTelemetry(res);

    check(res, { 'tour detail valid 200': (r) => r.status === 200 });
  }
  // 3. Journey C: 9.5% Customer / Content & Itinerary Viewer
  else if (rand < 0.995) {
    const blog = BLOGS[Math.floor(Math.random() * BLOGS.length)];
    res = http.get(`${BASE_URL}/blogs/${blog}`);
    recordTelemetry(res);

    res = http.get(`${BASE_URL}/faq`);
    recordTelemetry(res);

    check(res, { 'content valid 200': (r) => r.status === 200 });
  }
  // 4. Journey D: 0.5% Admin / Health Probe (Matches 10s-30s ALB check interval)
  else {
    res = http.get(`${BASE_URL}/health`);
    recordTelemetry(res);

    check(res, { 'health valid 200': (r) => r.status === 200 });
  }
}

function recordTelemetry(res) {
  p50Trend.add(res.timings.duration);

  if (res.status === 304) {
    notModified304.add(1);
    cacheHits.add(1);
    errorRate.add(0);
    droppedRate.add(0);
  } else if (res.status >= 200 && res.status < 300) {
    if (res.timings.duration < 50 || res.headers['X-Cache'] === 'HIT') {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
    errorRate.add(0);
    droppedRate.add(0);
  } else if (res.status === 429) {
    droppedRate.add(1);
    errorRate.add(0);
  } else {
    errorRate.add(1);
    droppedRate.add(1);
  }
}
