import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const droppedRate = new Rate('dropped_or_throttled');
const hitDuration = new Trend('cache_hit_latency');

export const options = {
  scenarios: {
    breakpoint_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        { target: 30, duration: '20s' },   // Baseline 30 RPS
        { target: 60, duration: '20s' },   // Previous reported limit ~45-60 RPS
        { target: 120, duration: '20s' },  // Cached target 120 RPS
        { target: 200, duration: '20s' },  // High throughput 200 RPS
        { target: 300, duration: '20s' },  // Stress threshold 300 RPS
        { target: 30, duration: '15s' },   // Recovery phase
      ],
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<400'],
    'errors': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api';

const ENDPOINTS = [
  '/tours?limit=10&page=1',
  '/destinations',
  '/tours/classic-program',
  '/tours/cairo-express-4d',
  '/blogs?limit=5',
  '/currency/rates',
];

export default function () {
  const ep = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const res = http.get(`${BASE_URL}${ep}`);

  hitDuration.add(res.timings.duration);

  if (res.status === 200 || res.status === 304) {
    errorRate.add(0);
    droppedRate.add(0);
  } else if (res.status === 429) {
    droppedRate.add(1);
    errorRate.add(0); // 429 is deliberate rate-limiting, tracked in droppedRate
  } else {
    errorRate.add(1);
    droppedRate.add(1);
  }

  check(res, {
    'status is 200 or 304': (r) => r.status === 200 || r.status === 304,
  });
}
