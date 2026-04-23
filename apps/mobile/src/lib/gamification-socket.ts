import { io, type Socket } from 'socket.io-client';

import { env } from '../config/env';
import { StorageKeys, getString } from './storage';

// Spec 3.7 — `/gamification` namespace: quest/badge tamamlanma (toast).

let socket: Socket | null = null;

export function getGamificationSocket(): Socket {
  if (!socket) {
    socket = io(`${env.wsUrl}/gamification`, {
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

export function connectGamificationSocket(): Socket {
  const s = getGamificationSocket();
  if (!s.connected) s.connect();
  return s;
}

export function resetGamificationSocketForTests(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
