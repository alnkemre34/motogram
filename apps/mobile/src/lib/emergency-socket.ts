import { io, type Socket } from 'socket.io-client';

import { env } from '../config/env';
import { StorageKeys, getString } from './storage';

// Spec 2.3.2 + 3.5 — `/emergency` namespace: yakın SOS ve güncellemeler.

let socket: Socket | null = null;

export function getEmergencySocket(): Socket {
  if (!socket) {
    socket = io(`${env.wsUrl}/emergency`, {
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

export function connectEmergencySocket(): Socket {
  const s = getEmergencySocket();
  if (!s.connected) s.connect();
  return s;
}

export function resetEmergencySocketForTests(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
