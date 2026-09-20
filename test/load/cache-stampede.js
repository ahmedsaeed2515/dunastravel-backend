import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const latencyTrend = new Trend('stampede_req_duration');
const successCounter = new Counter('stampede_successes');

export const options = {
  scenarios: {
    single_flight_burst: {
      executor: 'per-vu-iterations',
      vus: 40,
      iterations: 2,
      maxDuration: '30s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api';

export default function () {
  // Concurrently hit the same catalog query
  const res = http.get(`${BASE_URL}/tours?category=Classic&limit=10`);
  latencyTrend.add(res.timings.duration);

  if (res.status === 200) {
    successCounter.add(1);
  }

  check(res, {
    'stampede handled safely 200 OK': (r) => r.status === 200,
  });
}
