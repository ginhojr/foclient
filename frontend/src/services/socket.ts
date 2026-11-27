import { io, Socket } from 'socket.io-client';
import { getStoredAccessToken } from './api';

const SOCKET_URL =
  (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:3333';

let socket: Socket | null = null;

export function connectSocket(tenantId?: string): Socket {
  const token = getStoredAccessToken();

  if (socket) {
    if (tenantId) {
      socket.emit('tenant:join', tenantId);
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: {
      token: token ?? undefined,
    },
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1500,
  });

  socket.on('connect', () => {
    if (tenantId) {
      socket?.emit('tenant:join', tenantId);
    }
  });

  return socket;
}

export function joinTenantSocketRoom(tenantId: string): void {
  if (socket && socket.connected) {
    socket.emit('tenant:join', tenantId);
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
