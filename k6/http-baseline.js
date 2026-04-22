/**
 * Baseline HTTP load — thresholds per plan Faz 12.
 * Usage: k6 run k6/http-baseline.js -e BASE_URL=https://api.example.com
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const failRate = new Rate('failed_requests');

export const options = {
  vus: 20,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    failed_requests: ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export default function () {
  const live = http.get(`${BASE}/v1/livez`);
  const liveOk = check(live, { 'livez 200': (r) => r.status === 200 });
  failRate.add(!liveOk);

  const ready = http.get(`${BASE}/v1/readyz`);
  const readyOk = check(ready, {
    'readyz 200 veya 503': (r) => r.status === 200 || r.status === 503,
  });
  failRate.add(!readyOk);

  sleep(0.3);
}
