import { io, type Socket } from 'socket.io-client';

import { env } from '../config/env';
import { StorageKeys, getString } from './storage';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${env.wsUrl}/realtime`, {
      autoConnect: false,
      transports: ['websocket'],
      auth: (cb) => {
        cb({ token: getString(StorageKeys.AccessToken) ?? '' });
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
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
