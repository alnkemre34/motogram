/**
 * Placeholder for WS fanout latency (requires k6 WS + tokens).
 * Run when Faz 12 WS harness is wired; keeps k6 layout complete.
 */
import ws from 'k6/ws';
import { check } from 'k6';

export const options = { vus: 1, iterations: 1 };

const WS_URL = __ENV.WS_URL || 'ws://127.0.0.1:3000/socket.io/?EIO=4&transport=websocket';

export default function () {
  const res = ws.connect(WS_URL, {}, (socket) => {
    socket.on('open', () => socket.close());
  });
  check(res, { 'connected': (r) => r && r.status === 101 });
}
