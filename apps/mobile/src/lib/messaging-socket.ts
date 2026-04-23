import { io, type Socket } from 'socket.io-client';

import { env } from '../config/env';
import { StorageKeys, getString } from './storage';

// Spec 3.5 / 2.5 - Mesajlasma namespace: /messaging. Realtime namespace'den
// ayri cunku farkli guvenlik/throttle profili olabilir.

let socket: Socket | null = null;

export function getMessagingSocket(): Socket {
  if (!socket) {
    socket = io(`${env.wsUrl}/messaging`, {
      autoConnect: false,
      transports: ['websocket'],
      auth: (cb) => {
        cb({ token: getString(StorageKeys.AccessToken) ?? '' });
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function connectMessagingSocket(): Socket {
  const s = getMessagingSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectMessagingSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
}

export function resetMessagingSocketForTests(): void {
  socket?.disconnect();
  socket = null;
}
