/**
 * Location-adjacent spike (public livez + readyz if auth not available).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export default function () {
  const res = http.get(`${BASE}/v1/livez`);
  check(res, { 'livez ok': (r) => r.status === 200 });
  sleep(0.05);
}
