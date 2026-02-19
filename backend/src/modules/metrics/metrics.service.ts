import { Request, Response, NextFunction } from 'express';
import os from 'os';
import { prisma } from '../../config/database';
import { getRedis } from '../../config/redis';
import { getPassengerNamespace, getDriverNamespace, getAdminNamespace } from '../../config/socket';
import { logger } from '../../utils/logger';

// ── Metrics Service ─────────────────────────────────────────────────────────

const startTime = Date.now();

async function gatherMetrics() {
  const mem = process.memoryUsage();

  // CPU usage (percentage since process start)
  const cpuUsage = process.cpuUsage();
  const cpuPercent = {
    user: Math.round(cpuUsage.user / 1_000) / 1_000,   // ms
    system: Math.round(cpuUsage.system / 1_000) / 1_000, // ms
  };

  // Database health
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs = 0;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbStatus = 'error';
  }

  // Redis health
  let redisStatus: 'ok' | 'error' = 'ok';
  let redisLatencyMs = 0;
  try {
    const redis = getRedis();
    const redisStart = Date.now();
    await redis.ping();
    redisLatencyMs = Date.now() - redisStart;
  } catch {
    redisStatus = 'error';
  }

  // Socket.io connections
  let passengerConns = 0;
  let driverConns = 0;
  let adminConns = 0;
  try {
    const passengerSockets = await getPassengerNamespace().fetchSockets();
    const driverSockets = await getDriverNamespace().fetchSockets();
    const adminSockets = await getAdminNamespace().fetchSockets();
    passengerConns = passengerSockets.length;
    driverConns = driverSockets.length;
    adminConns = adminSockets.length;
  } catch {
    // Namespaces may not be initialized yet
  }

  return {
    uptime: {
      seconds: Math.floor((Date.now() - startTime) / 1000),
      formatted: formatUptime(Date.now() - startTime),
    },
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      external: formatBytes(mem.external),
    },
    cpu: cpuPercent,
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      loadAvg: os.loadavg().map((v) => Math.round(v * 100) / 100),
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    redis: {
      status: redisStatus,
      latencyMs: redisLatencyMs,
    },
    sockets: {
      passengers: passengerConns,
      drivers: driverConns,
      admins: adminConns,
      total: passengerConns + driverConns + adminConns,
    },
    timestamp: new Date().toISOString(),
  };
}

// ── Controller ──────────────────────────────────────────────────────────────

export async function getSystemMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const metrics = await gatherMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Failed to gather system metrics', { error });
    next(error);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}
