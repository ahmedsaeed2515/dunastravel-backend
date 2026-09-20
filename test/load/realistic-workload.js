import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
const cacheHits = new Counter('cache_hits_total');
const cacheMisses = new Counter('cache_misses_total');
const notModified304 = new Counter('http_304_not_modified_total');
const successfulRequests = new Counter('successful_requests_total');
const errorRate = new Rate('custom_error_rate');
const catalogDuration = new Trend('catalog_request_duration_ms');
const tourDetailDuration = new Trend('tour_detail_duration_ms');

export const options = {
  scenarios: {
    realistic_tourist_traffic: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 20 },   // Warmup & baseline
        { duration: '1m', target: 50 },    // Standard daytime load
        { duration: '1m', target: 100 },   // Peak browsing load
        { duration: '1m', target: 150 },   // Stress traffic surge
        { duration: '30s', target: 0 },    // Cooldown
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<2500'],
    'custom_error_rate': ['rate<0.02'], // Less than 2% errors allowed
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api';

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

export default function () {
  let res;
  const rand = Math.random();

  // Persona A: Casual Explorer (55% of traffic)
  if (rand < 0.55) {
    group('Persona: Casual Explorer', function () {
      // 1. Destinations
      res = http.get(`${BASE_URL}/destinations`);
      recordMetrics(res, 'destinations');
      check(res, { 'destinations 200/304': (r) => r.status === 200 || r.status === 304 });
      sleep(1 + Math.random() * 2);

      // 2. Tours catalog page 1
      const etagCatalog = res.headers['Etag'] || res.headers['ETag'];
      const headers = etagCatalog ? { 'If-None-Match': etagCatalog } : {};
      
      const startCat = new Date();
      res = http.get(`${BASE_URL}/tours?limit=10&page=1`, { headers });
      catalogDuration.add(new Date() - startCat);
      recordMetrics(res, 'catalog');
      check(res, { 'tours catalog 200/304': (r) => r.status === 200 || r.status === 304 });
      sleep(2 + Math.random() * 3);

      // 3. View Tour Detail
      const tourSlug = TOURS[Math.floor(Math.random() * TOURS.length)];
      const startDetail = new Date();
      res = http.get(`${BASE_URL}/tours/${tourSlug}`);
      tourDetailDuration.add(new Date() - startDetail);
      recordMetrics(res, 'tour_detail');
      check(res, { 'tour detail 200': (r) => r.status === 200 });
      sleep(2 + Math.random() * 2);
    });
  }
  // Persona B: Filter & Compare Searcher (25% of traffic)
  else if (rand < 0.80) {
    group('Persona: Filter Searcher', function () {
      // 1. Search filtered tours
      const categories = ['Classic', 'Egypt'];
      const cat = categories[Math.floor(Math.random() * categories.length)];
      res = http.get(`${BASE_URL}/tours?category=${cat}&limit=5`);
      recordMetrics(res, 'filtered_catalog');
      check(res, { 'filtered tours 200/304': (r) => r.status === 200 || r.status === 304 });
      sleep(2 + Math.random() * 2);

      // 2. Tour detail
      res = http.get(`${BASE_URL}/tours/cairo-express-4d`);
      recordMetrics(res, 'tour_detail');
      check(res, { 'cairo-express 200': (r) => r.status === 200 });
      sleep(1 + Math.random() * 2);

      // 3. Currency Rates
      res = http.get(`${BASE_URL}/currency/rates`);
      recordMetrics(res, 'currency');
      check(res, { 'currency 200/304': (r) => r.status === 200 || r.status === 304 });
      sleep(1);
    });
  }
  // Persona C: Content & FAQ Reader (15% of traffic)
  else if (rand < 0.95) {
    group('Persona: Content Reader', function () {
      // 1. Blogs listing
      res = http.get(`${BASE_URL}/blogs?limit=5`);
      recordMetrics(res, 'blogs_catalog');
      check(res, { 'blogs list 200/304': (r) => r.status === 200 || r.status === 304 });
      sleep(2 + Math.random() * 2);

      // 2. Single blog
      const blogSlug = BLOGS[Math.floor(Math.random() * BLOGS.length)];
      res = http.get(`${BASE_URL}/blogs/${blogSlug}`);
      recordMetrics(res, 'blog_detail');
      check(res, { 'blog detail 200/304': (r) => r.status === 200 || r.status === 304 });
      sleep(2 + Math.random() * 2);

      // 3. FAQ
      res = http.get(`${BASE_URL}/faq`);
      recordMetrics(res, 'faq');
      check(res, { 'faq 200/304': (r) => r.status === 200 || r.status === 304 });
      sleep(1);
    });
  }
  // Persona D: High-Intent Inquiry / Health Probe (5% of traffic)
  else {
    group('Persona: High-Intent / Direct Probe', function () {
      res = http.get(`${BASE_URL}/health`);
      recordMetrics(res, 'health');
      check(res, { 'health 200': (r) => r.status === 200 });
      sleep(1);

      res = http.get(`${BASE_URL}/tours/classic-program`);
      recordMetrics(res, 'tour_direct');
      check(res, { 'tour direct 200': (r) => r.status === 200 });
      sleep(1);
    });
  }
}

function recordMetrics(res, label) {
  if (res.status === 304) {
    notModified304.add(1);
    successfulRequests.add(1);
    cacheHits.add(1);
    errorRate.add(0);
  } else if (res.status >= 200 && res.status < 300) {
    successfulRequests.add(1);
    errorRate.add(0);
    if (res.timings.duration < 30) {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
  } else if (res.status === 429) {
    errorRate.add(1);
  } else {
    errorRate.add(1);
  }
}
