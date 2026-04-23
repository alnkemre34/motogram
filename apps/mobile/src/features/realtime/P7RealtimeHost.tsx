import { useP7RealtimeWebSockets } from '../../hooks/useP7RealtimeWebSockets';

import { P7RealtimeToasts } from './P7RealtimeToasts';

/** Oturum açıkken P7.3/7.4 WebSocket’leri + global toast. */
export function P7RealtimeHost() {
  useP7RealtimeWebSockets();
  return <P7RealtimeToasts />;
}
