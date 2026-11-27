import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyAccessToken } from './jwt';

let ioInstance: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (typeof socket.handshake.headers.authorization === 'string'
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);

    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        socket.data.user = decoded;
      } catch {
        // Allow connection and let client join tenant room explicitly or re-authenticate
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user?.tenantId) {
      socket.join(`tenant:${user.tenantId}`);
    }

    // Allow authorized tenant room switching (especially for SUPER_ADMIN switching active tenant)
    socket.on('tenant:join', (tenantId: string) => {
      if (!tenantId) return;
      if (user && (user.role === 'SUPER_ADMIN' || user.tenantId === tenantId)) {
        for (const room of socket.rooms) {
          if (room.startsWith('tenant:') && room !== `tenant:${tenantId}`) {
            socket.leave(room);
          }
        }
        socket.join(`tenant:${tenantId}`);
      } else if (!user) {
        // Dev fallback when connecting before login handshake completes
        socket.join(`tenant:${tenantId}`);
      }
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitToTenant(tenantId: string, event: string, payload: unknown): void {
  if (!ioInstance) return;
  ioInstance.to(`tenant:${tenantId}`).emit(event, payload);
}
