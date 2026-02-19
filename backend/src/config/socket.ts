import { Server as HttpServer } from 'http';
import { Server, Namespace } from 'socket.io';
import { env } from './env';
import { logger } from '../utils/logger';

let io: Server;
let passengerNs: Namespace;
let driverNs: Namespace;
let adminNs: Namespace;

export function initializeSocket(httpServer: HttpServer): Server {
  const corsOrigin = env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim());
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 20000,
    pingTimeout: 10000,
  });

  passengerNs = io.of('/passenger');
  driverNs = io.of('/driver');
  adminNs = io.of('/admin');

  logger.info('Socket.io initialised — namespaces: /passenger, /driver, /admin');

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
}

export function getPassengerNamespace(): Namespace {
  if (!passengerNs) throw new Error('Passenger namespace not initialised');
  return passengerNs;
}

export function getDriverNamespace(): Namespace {
  if (!driverNs) throw new Error('Driver namespace not initialised');
  return driverNs;
}

export function getAdminNamespace(): Namespace {
  if (!adminNs) throw new Error('Admin namespace not initialised');
  return adminNs;
}
