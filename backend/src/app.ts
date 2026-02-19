import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { prisma } from './config/database';
import { getRedis } from './config/redis';

// ── Route imports ───────────────────────────────────────────────────────────
import authRouter from './modules/auth/auth.routes';
import userRouter from './modules/users/users.routes';
import driverRouter from './modules/drivers/drivers.routes';
import busRouter from './modules/buses/buses.routes';
import routeRouter from './modules/routes/routes.routes';
import stopRouter from './modules/stops/stops.routes';
import tripRouter from './modules/trips/trips.routes';
import passengerRouter from './modules/passengers/passengers.routes';
import transitRouter from './modules/transit/transit.routes';
import liveBusesRouter from './modules/live-buses/live-buses.routes';

// ── Middleware ───────────────────────────────────────────────────────────────
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { authenticate } from './middleware/auth.middleware';
import { authorize } from './middleware/role.middleware';
import { publicLimiter } from './middleware/rate-limit.middleware';

// ── Metrics ─────────────────────────────────────────────────────────────────
import { getSystemMetrics } from './modules/metrics/metrics.service';

// ── Intelligence ────────────────────────────────────────────────────────────
import { getAllRouteSpeedAverages, getAllRouteReliabilities, getTimeOfDayTrafficFactor } from './intelligence';

// ── Transit Engine Metrics (Phase 7.5) ──────────────────────────────────────
import { getMemoryMetrics, getRouteEngineMetrics, getLastDijkstraStats, getGraphStats } from './transit-engine';

// ── App ────────────────────────────────────────────────────────────────────

const app = express();

// ── Security headers ────────────────────────────────────────────────────────
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// ── CORS ────────────────────────────────────────────────────────────────────
const corsOrigin = env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim());
app.use(cors({ origin: corsOrigin, credentials: true }));

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Transit API (before rate limiter — high throughput needed) ───────────────
app.use('/api/transit', transitRouter);

// ── Live Bus Arrival API (Phase 9 — public, high throughput) ────────────────
app.use('/api/live-buses', liveBusesRouter);

// ── Global rate limit ───────────────────────────────────────────────────────
app.use(publicLimiter);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  let dbStatus: 'ok' | 'error' = 'ok';
  let redisStatus: 'ok' | 'error' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  try {
    await getRedis().ping();
  } catch {
    redisStatus = 'error';
  }

  const overall = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded';
  const statusCode = overall === 'ok' ? 200 : 503;

  res.status(statusCode).json({
    status: overall,
    timestamp: new Date().toISOString(),
    service: 'hydgo-backend',
    version: '1.0.0',
    simulation: env.SIMULATION_MODE,
    uptime: process.uptime(),
    dependencies: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
});

// ── Public routes ───────────────────────────────────────────────────────────
import geocodeRouter from './modules/geocode/geocode.routes';
app.use('/api/auth', authRouter);
app.use('/api/routes', routeRouter);   // public — bus route & stop data
app.use('/api/stops', stopRouter);     // public — stop lookup
app.use('/api/geocode', geocodeRouter); // proxy for Nominatim reverse geocoding

// ── Semi-public bus routes (nearby is public, rest protected) ───────────────
import { BusesController as BusCtrlPublic } from './modules/buses/buses.controller';
const publicBusCtrl = new BusCtrlPublic();
app.get('/api/buses/nearby', publicBusCtrl.getNearby.bind(publicBusCtrl));

// ── Protected routes ────────────────────────────────────────────────────────
app.use('/api/users', authenticate, authorize('ADMIN'), userRouter);
app.use('/api/drivers', authenticate, driverRouter);
app.use('/api/buses', authenticate, busRouter);
app.use('/api/trips', authenticate, tripRouter);
app.use('/api/passenger', authenticate, authorize('PASSENGER'), passengerRouter);

// ── Admin-only routes (mounted under /api/admin) ────────────────────────────
import { Router } from 'express';
import { DriversController } from './modules/drivers/drivers.controller';
import { RoutesController } from './modules/routes/routes.controller';
import { StopsController } from './modules/stops/stops.controller';
import { BusesController } from './modules/buses/buses.controller';
import { AdminLiveController } from './modules/drivers/admin-live.controller';
import { AdminController } from './modules/admin/admin.controller';

const adminRouter = Router();
adminRouter.use(authenticate, authorize('ADMIN'));

const driversCtrl = new DriversController();
const routesCtrl = new RoutesController();
const stopsCtrl = new StopsController();
const busesCtrl = new BusesController();
const adminLiveCtrl = new AdminLiveController();
const adminCtrl = new AdminController();

// Driver management (existing)
adminRouter.get('/drivers/pending', driversCtrl.getPending.bind(driversCtrl));
adminRouter.patch('/drivers/:driverId/approve', driversCtrl.approve.bind(driversCtrl));
adminRouter.patch('/drivers/:driverId/assign-bus', driversCtrl.assignBus.bind(driversCtrl));

// Driver approval (new - Phase 9)
adminRouter.patch('/drivers/:id/reject', adminCtrl.rejectDriver.bind(adminCtrl));

// Notifications (new - Phase 9)
adminRouter.get('/notifications', adminCtrl.getNotifications.bind(adminCtrl));
adminRouter.patch('/notifications/:id/read', adminCtrl.markNotificationRead.bind(adminCtrl));
adminRouter.patch('/notifications/mark-all-read', adminCtrl.markAllNotificationsRead.bind(adminCtrl));

// Dashboard summary (new - Phase 9)
adminRouter.get('/dashboard-summary', adminCtrl.getDashboardSummary.bind(adminCtrl));

// Route management
adminRouter.post('/routes', routesCtrl.create.bind(routesCtrl));

// Stop management
adminRouter.post('/stops', stopsCtrl.create.bind(stopsCtrl));

// Bus overview
adminRouter.get('/buses', busesCtrl.getAllActive.bind(busesCtrl));

// System metrics
adminRouter.get('/system-metrics', getSystemMetrics);

// Intelligence metrics
adminRouter.get('/intelligence-metrics', async (_req, res) => {
  try {
    const [speedAverages, reliabilities] = await Promise.all([
      getAllRouteSpeedAverages(),
      getAllRouteReliabilities(),
    ]);

    // Phase 7.5: Enhanced metrics with graph, routing, memory, and Dijkstra stats
    const memoryMetrics = getMemoryMetrics();
    const routeMetrics = getRouteEngineMetrics();
    const dijkstraStats = getLastDijkstraStats();
    const graphStats = getGraphStats();

    res.json({
      timestamp: new Date().toISOString(),
      timeOfDayTrafficFactor: getTimeOfDayTrafficFactor(),
      routeSpeedAverages: speedAverages,
      routeReliabilities: reliabilities,
      // Phase 7.5 additions
      graph: graphStats,
      routing: {
        ...routeMetrics,
        lastDijkstra: dijkstraStats,
      },
      memory: memoryMetrics.memory,
      system: {
        uptime: memoryMetrics.uptime,
        cpuUsage: memoryMetrics.cpuUsage,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch intelligence metrics' });
  }
});

// Live driver & hybrid status
adminRouter.get('/live-driver-status', adminLiveCtrl.getLiveDriverStatus.bind(adminLiveCtrl));

app.use('/api/admin', adminRouter);

// ── Error handling (must be last) ───────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
