import { io, type Socket } from 'socket.io-client';

import { env } from '../config/env';
import { StorageKeys, getString } from './storage';

// Spec 3.5 - Socket.IO singleton; auth token handshake'de verilir.
// Singleton cunku hook'lar arasinda paylasilir; tek connection.

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${env.wsUrl}/realtime`, {
      autoConnect: false,
      transports: ['websocket'],
      auth: () => ({ token: getString(StorageKeys.AccessToken) ?? '' }),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
}

export function resetSocketForTests(): void {
  socket?.disconnect();
  socket = null;
}
