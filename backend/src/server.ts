import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { disconnectRedis, connectRedis } from './config/redis';
import { initializeSocket, getPassengerNamespace, getDriverNamespace, getAdminNamespace } from './config/socket';
import { setupPassengerTracking, setupDriverTracking, setupAdminTracking } from './modules/tracking/tracking.handler';
import { startSimulation, stopSimulation } from './modules/simulation/simulation.engine';
import { cleanupHybridManager } from './modules/simulation/hybrid-manager';
import { driverStateService } from './modules/drivers/driver-state.service';
import { resetAllSafetyData } from './modules/drivers/driver-safety.service';
import { logger } from './utils/logger';
import { buildTransitGraph, loadGraph, isGraphBuilt, startMemoryMonitor, stopMemoryMonitor } from './transit-engine';

// ── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Connect database (+ enable PostGIS)
  await connectDatabase();
  logger.info('Database connected');

  // 1b. Connect Redis
  await connectRedis();

  // 2. Create HTTP server from Express app
  const server = http.createServer(app);

  // 3. Initialize Socket.io & attach tracking handlers
  initializeSocket(server);

  const passengerNs = getPassengerNamespace();
  const driverNs = getDriverNamespace();
  const adminNs = getAdminNamespace();

  setupPassengerTracking(passengerNs);
  setupDriverTracking(driverNs);
  setupAdminTracking(adminNs);

  logger.info('Socket.io namespaces initialized');

  // 4. Start simulation if enabled
  // ── Transit Graph ──────────────────────────────────────────────────────
  try {
    const graphExists = await isGraphBuilt();
    if (!graphExists) {
      logger.info('Transit graph not found — building from routes...');
      await buildTransitGraph();
    }
    await loadGraph();
    logger.info('Transit graph loaded into memory');
  } catch (graphErr) {
    logger.warn('Transit graph not available — skipping (server will still run)', graphErr);
  }

  // Phase 7.5: Start memory & performance monitor
  startMemoryMonitor(30_000);

  if (env.SIMULATION_MODE) {
    await startSimulation();
  }

  // 5. Start driver idle detection
  driverStateService.startIdleDetection();
  logger.info('Driver idle detection started');

  // 6. Listen
  server.listen(env.PORT, () => {
    logger.info(`HydGo backend listening on port ${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Simulation: ${env.SIMULATION_MODE ? 'ENABLED' : 'DISABLED'}`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);

    stopSimulation();
    cleanupHybridManager();
    stopMemoryMonitor();
    driverStateService.stopIdleDetection();
    resetAllSafetyData();

    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      logger.info('All connections closed — exiting');
      process.exit(0);
    });

    // Force exit after 10 s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ── Run ─────────────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
  logger.error('Fatal bootstrap error', err);
  process.exit(1);
});
