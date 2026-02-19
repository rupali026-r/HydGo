import { Namespace, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
import { getRedis } from '../../config/redis';
import { getPassengerNamespace, getAdminNamespace } from '../../config/socket';
import { AuthPayload } from '../../middleware/auth.middleware';
import { calculateOccupancy } from '../../utils/occupancy';
import { calculateBearing, haversineDistance } from '../../utils/geo';
import { logger } from '../../utils/logger';
import { driverStateService } from '../drivers/driver-state.service';
import { registerDriverBus, unregisterDriverBus, recordDriverPosition } from '../simulation/hybrid-manager';
import { validateDriverLocationUpdate, clearDriverSafetyData } from '../drivers/driver-safety.service';
import { notificationRulesService } from '../notifications/notification-rules.service';

// ── Intelligence Layer ──────────────────────────────────────────────────────
import {
  calculatePredictiveETA,
  calculateConfidence,
  rankBuses,
  recordSpeed,
  getRouteAverageSpeed,
  recordDisconnect,
  recordHighCongestion,
  getRouteReliability,
} from '../../intelligence';
import type { SuggestionBus } from '../../intelligence';

const NEARBY_RADIUS_KM = 5;
const REDIS_DRIVER_PREFIX = 'driver:socket:';
const HEARTBEAT_INTERVAL_MS = 20_000;

// ── Socket auth middleware ──────────────────────────────────────────────────

function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
  const token =
    socket.handshake.auth?.token ??
    socket.handshake.headers?.authorization?.split(' ')[1];

  if (!token) return next(new Error('Authentication required'));

  try {
    socket.data.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}

/** Passenger-specific auth: allows guest (unauthenticated) connections for read-only bus viewing */
function passengerAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token =
    socket.handshake.auth?.token ??
    socket.handshake.headers?.authorization?.split(' ')[1];

  if (!token) {
    // Guest mode — allow connection but mark as guest
    socket.data.user = { userId: 'guest', role: 'GUEST' } as any;
    socket.data.isGuest = true;
    return next();
  }

  try {
    socket.data.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
    socket.data.isGuest = false;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}

// ── Passenger namespace ─────────────────────────────────────────────────────

export function setupPassengerTracking(ns: Namespace): void {
  ns.use(passengerAuthMiddleware);

  ns.on('connection', async (socket) => {
    const user = socket.data.user as AuthPayload;
    const isGuest = socket.data.isGuest === true;
    logger.info('Passenger connected', { userId: user.userId, socketId: socket.id, isGuest });

    // Track in Redis
    try {
      const redis = getRedis();
      await redis.sadd('passengers:connected', socket.id);
    } catch { /* non-critical */ }

    // Send initial snapshot of active buses
    try {
      const activeBuses = await prisma.bus.findMany({
        where: { status: 'ACTIVE' },
        include: { route: { select: { routeNumber: true, name: true, routeType: true, avgSpeed: true } } },
        take: 50,
      });

      const snapshot = activeBuses.map((b) => ({
        id: b.id,
        registrationNo: b.registrationNo,
        routeNumber: b.route?.routeNumber,
        routeName: b.route?.name,
        routeType: b.route?.routeType,
        latitude: b.latitude,
        longitude: b.longitude,
        heading: b.heading,
        speed: b.speed,
        isSimulated: b.isSimulated,
        occupancy: calculateOccupancy(b.passengerCount, b.capacity),
      }));

      socket.emit('buses:snapshot', snapshot);
    } catch (error) {
      logger.error('Failed to send initial bus snapshot', { error });
    }

    // Prevent listener stacking — removeAllListeners before re-adding
    socket.removeAllListeners('location:send');
    socket.removeAllListeners('register:push-token');

    // ── Passenger location handler ──────────────────────────────

    socket.on('location:send', async (data: { latitude: number; longitude: number }) => {
      try {
        const { latitude, longitude } = data;
        const radiusMeters = NEARBY_RADIUS_KM * 1000;

        let buses: any[];

        try {
          buses = await prisma.$queryRaw`
            SELECT
              b.id, b.latitude, b.longitude, b."passengerCount", b.capacity,
              b.heading, b.speed, b."registrationNo", b."routeId", b."isSimulated",
              r."routeNumber", r.name AS "routeName", r."routeType", r."avgSpeed",
              ST_Distance(
                ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
              ) AS distance
            FROM buses b
            LEFT JOIN routes r ON b."routeId" = r.id
            WHERE b.status = 'ACTIVE'
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                ${radiusMeters}
              )
            ORDER BY distance ASC
            LIMIT 50
          `;
        } catch {
          // Fallback: Haversine filter
          const allBuses = await prisma.bus.findMany({
            where: { status: 'ACTIVE' },
            include: { route: { select: { routeNumber: true, name: true, routeType: true, avgSpeed: true } } },
          });
          buses = allBuses
            .map((b) => ({
              ...b,
              routeNumber: b.route?.routeNumber,
              routeName: b.route?.name,
              routeType: b.route?.routeType,
              avgSpeed: b.route?.avgSpeed,
              distance: haversineDistance(latitude, longitude, b.latitude, b.longitude) * 1000,
            }))
            .filter((b) => b.distance <= radiusMeters)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 50);
        }

        // ── Intelligence: Predictive ETA + Confidence + Suggestions ──
        // Count buses per route for congestion context
        const routeBusCounts = new Map<string, { count: number; totalOcc: number }>();
        for (const bus of buses) {
          if (bus.routeId) {
            const existing = routeBusCounts.get(bus.routeId) || { count: 0, totalOcc: 0 };
            existing.count++;
            const occ = bus.capacity > 0 ? (bus.passengerCount / bus.capacity) * 100 : 0;
            existing.totalOcc += occ;
            routeBusCounts.set(bus.routeId, existing);
          }
        }

        // Count nearby buses per bus (within 300m for congestion)
        const getNearbyCount = (bus: any): number => {
          let count = 0;
          for (const other of buses) {
            if (other.id === bus.id || other.routeId !== bus.routeId) continue;
            const d = haversineDistance(bus.latitude, bus.longitude, other.latitude, other.longitude) * 1000;
            if (d < 300) count++;
          }
          return count;
        };

        const enriched = await Promise.all(buses.map(async (bus: any) => {
          const occupancy = calculateOccupancy(bus.passengerCount, bus.capacity);
          const distanceMeters = Math.round(Number(bus.distance));
          const occupancyPercent = bus.capacity > 0 ? (bus.passengerCount / bus.capacity) * 100 : 0;
          const routeStats = routeBusCounts.get(bus.routeId) || { count: 0, totalOcc: 0 };
          const routeOccupancyAvg = routeStats.count > 0 ? routeStats.totalOcc / routeStats.count : 0;

          // Predictive ETA
          const eta = await calculatePredictiveETA({
            busLat: bus.latitude,
            busLng: bus.longitude,
            targetLat: latitude,
            targetLng: longitude,
            currentSpeedKmh: bus.speed ?? 0,
            routeAvgSpeedKmh: bus.avgSpeed ?? 30,
            routeId: bus.routeId ?? undefined,
            occupancyPercent,
            nearbyBusCount: getNearbyCount(bus),
            routeOccupancyAvg,
          });

          // Confidence
          const speedMemory = bus.routeId ? await getRouteAverageSpeed(bus.routeId) : null;
          const confidence = calculateConfidence({
            trafficLevel: eta.trafficLevel,
            congestionLevel: eta.congestionLevel,
            currentSpeedKmh: bus.speed ?? 0,
            historicalSampleCount: speedMemory?.sampleCount,
          });

          // Reliability
          const reliability = bus.routeId ? await getRouteReliability(bus.routeId) : { score: 100, label: 'HIGH' as const };

          return {
            id: bus.id,
            registrationNo: bus.registrationNo,
            routeNumber: bus.routeNumber,
            routeName: bus.routeName,
            routeType: bus.routeType,
            latitude: bus.latitude,
            longitude: bus.longitude,
            heading: bus.heading,
            speed: bus.speed,
            isSimulated: bus.isSimulated,
            distanceMeters,
            occupancy,
            eta: {
              distanceKm: eta.distanceKm,
              estimatedMinutes: eta.estimatedMinutes,
              formattedETA: eta.formattedETA,
            },
            // Intelligence fields
            trafficLevel: eta.trafficLevel,
            congestionLevel: eta.congestionLevel,
            trafficFactor: eta.trafficFactor,
            confidence: confidence.score,
            confidenceLabel: confidence.label,
            reliability: { score: reliability.score, label: reliability.label },
          };
        }));

        // ── Smart Suggestions ──
        const suggestionInput: SuggestionBus[] = enriched.map((b) => ({
          busId: b.id,
          etaMinutes: b.eta.estimatedMinutes,
          distanceMeters: b.distanceMeters,
          occupancyPercent: b.occupancy.percent,
          trafficFactor: b.trafficFactor,
          confidence: b.confidence,
          registrationNo: b.registrationNo,
          routeNumber: b.routeNumber,
          routeName: b.routeName,
        }));
        const suggestions = rankBuses(suggestionInput);

        socket.emit('buses:nearby', enriched);
        if (suggestions.length > 0) {
          socket.emit('buses:suggestions', suggestions);
        }
      } catch (error) {
        logger.error('Error in passenger location handler', { error });
        socket.emit('error', { message: 'Failed to find nearby buses' });
      }
    });

    // ── Register push token ─────────────────────────────────────

    socket.on('register:push-token', async (data: { token: string }) => {
      try {
        if (!data.token || typeof data.token !== 'string') return;
        await prisma.user.update({
          where: { id: user.userId },
          data: { pushToken: data.token },
        });
        socket.emit('push-token:registered', { success: true });
      } catch (error) {
        logger.error('Failed to register push token', { userId: user.userId, error });
      }
    });

    socket.on('disconnect', async () => {
      logger.debug('Passenger disconnected', { userId: user.userId, socketId: socket.id });
      try {
        const redis = getRedis();
        await redis.srem('passengers:connected', socket.id);
      } catch { /* non-critical */ }
    });
  });
}

// ── Driver namespace ────────────────────────────────────────────────────────

export function setupDriverTracking(ns: Namespace): void {
  ns.use(authenticateSocket);

  ns.on('connection', async (socket) => {
    const user = socket.data.user as AuthPayload;
    logger.info('Driver connected', { userId: user.userId, socketId: socket.id });

    // Verify driver state
    const driver = await prisma.driver.findUnique({
      where: { userId: user.userId },
      include: {
        bus: { include: { route: { select: { routeNumber: true, name: true, routeType: true, avgSpeed: true } } } },
      },
    });

    // ── Driver Lifecycle Handling (proper UX states) ──
    
    if (!driver) {
      socket.emit('error', { message: 'Driver profile not found' });
      socket.disconnect();
      return;
    }

    // Join driver's personal room for targeted events (approval, bus assignment)
    socket.join(user.userId);
    socket.join(`driver:${driver.id}`);

    // State 1: Pending Approval (keep socket alive, emit lifecycle event)
    if (!driver.approved) {
      socket.emit('driver:pending-approval', {
        driverId: driver.id,
        message: 'Your driver application is pending admin approval',
        status: 'PENDING_APPROVAL',
      });
      logger.info('Driver pending approval connected', { userId: user.userId, driverId: driver.id });
      
      // Keep socket alive but don't allow operational events
      // Driver will receive driver:approved event when admin approves
      return;
    }

    // State 2: Approved but No Bus Assigned (keep socket alive, emit lifecycle event)
    if (!driver.bus) {
      socket.emit('driver:no-bus-assigned', {
        driverId: driver.id,
        approved: true,
        message: 'No bus assigned yet. Contact admin.',
        status: 'NO_BUS_ASSIGNED',
      });
      logger.info('Driver without bus connected', { userId: user.userId, driverId: driver.id });
      
      // Keep socket alive to receive driver:bus-assigned event
      return;
    }

    // Capture bus reference — guaranteed non-null past this point
    const bus = driver.bus;
    const busId = bus.id;
    const routeId = bus.routeId ?? undefined;

    // ── Hybrid Integration: register this bus as driver-controlled ──
    const regResult = registerDriverBus(busId, driver.id, routeId);
    if (!regResult.success) {
      socket.emit('error', {
        message: regResult.message,
        code: regResult.code,
      });
      socket.disconnect();
      return;
    }

    // Activate the bus (atomically with isSimulated flag)
    await prisma.bus.update({
      where: { id: busId },
      data: { status: 'ACTIVE', isSimulated: false },
    });

    // ── State Machine: transition to ONLINE ──
    await driverStateService.transition(driver.id, 'ONLINE', 'Socket connected');
    driverStateService.recordActivity(driver.id);

    // Track in Redis (failover-safe: driver updates continue without Redis)
    const redisSet = async (key: string, value: string, ttl: number) => {
      try {
        const redis = getRedis();
        await redis.set(key, value, 'EX', ttl);
      } catch {
        // Redis down — driver updates continue via local socket broadcast
      }
    };

    await redisSet(`${REDIS_DRIVER_PREFIX}${user.userId}`, socket.id, 300);
    await redisSet(`bus:driver:${busId}`, user.userId, 300);

    // Heartbeat refresh (failover-safe)
    const heartbeat = setInterval(async () => {
      await redisSet(`${REDIS_DRIVER_PREFIX}${user.userId}`, socket.id, 300);
      await redisSet(`bus:driver:${busId}`, user.userId, 300);
    }, HEARTBEAT_INTERVAL_MS);

    // Join driver to their personal room (for targeted events like bus assignment)
    socket.join(user.userId);
    socket.join(`driver:${driver.id}`);

    // Send driver their bus + route info on connect
    // Include active trip if one exists (crash recovery support)
    const activeTrip = await prisma.trip.findFirst({
      where: { busId, status: 'IN_PROGRESS' },
      orderBy: { startTime: 'desc' },
    });

    socket.emit('driver:init', {
      driverId: driver.id,
      userId: user.userId,
      busId: busId,
      registrationNo: bus.registrationNo,
      routeId: routeId,
      routeNumber: bus.route?.routeNumber,
      routeName: bus.route?.name,
      capacity: bus.capacity,
      approved: driver.approved,
      status: 'ONLINE',
      activeTripId: activeTrip?.id ?? null,
      tripStartTime: activeTrip?.startTime?.toISOString() ?? null,
    });

    // Prevent listener stacking
    socket.removeAllListeners('driver:location:update');
    socket.removeAllListeners('driver:trip:start');
    socket.removeAllListeners('driver:trip:end');
    socket.removeAllListeners('driver:bus-assigned');

    // ── Bus assignment event (for real-time sync) ──────────────────────────
    // This allows drivers to receive bus assignments without re-login
    socket.on('driver:bus-assigned', async (payload: { busId: string; registrationNo: string; routeId?: string; routeNumber?: string; routeName?: string; capacity?: number }) => {
      logger.info('Driver received bus assignment notification', { driverId: driver.id, busId: payload.busId });
      // Driver app will update its store based on this event
      // No server-side action needed - this is just for logging/acknowledgment
    });

    // ── Driver location update handler ──────────────────────────

    socket.on(
      'driver:location:update',
      async (data: {
        busId: string;
        lat: number;
        lng: number;
        speed?: number;
        heading?: number;
        accuracy?: number;
        passengerCount?: number;
      }) => {
        try {
          // Validate bus ownership
          if (data.busId !== busId) {
            socket.emit('error', { message: 'Bus ID mismatch — not your assigned bus' });
            return;
          }

          // ── Safety Validation ──
          const validation = validateDriverLocationUpdate(driver.id, {
            busId: data.busId,
            latitude: data.lat,
            longitude: data.lng,
            speed: data.speed,
            heading: data.heading,
            accuracy: data.accuracy,
            passengerCount: data.passengerCount,
          });

          if (!validation.valid) {
            logger.warn('Driver location update rejected', {
              driverId: driver.id,
              reason: validation.reason,
            });
            socket.emit('location:rejected', { reason: validation.reason });
            return;
          }

          // ── Record activity for idle detection ──
          driverStateService.recordActivity(driver.id);

          // If driver was IDLE, return to ONLINE
          const currentState = await driverStateService.getState(driver.id);
          if (currentState === 'IDLE') {
            await driverStateService.transition(driver.id, 'ONLINE', 'Location update received after idle');
          }

          // ── Update bus in database ──
          const heading = data.heading ?? calculateBearing(
            bus.latitude, bus.longitude,
            data.lat, data.lng,
          );

          const updateData: any = {
            latitude: data.lat,
            longitude: data.lng,
            heading,
            speed: data.speed ?? 0,
          };

          // Update passenger count if provided
          if (data.passengerCount !== undefined) {
            updateData.passengerCount = Math.min(data.passengerCount, bus.capacity);
          }

          await prisma.bus.update({
            where: { id: busId },
            data: updateData,
          });

          // Update last location timestamp
          await prisma.driver.update({
            where: { id: driver.id },
            data: { lastLocationAt: new Date() },
          });

          // ── Record position for teleport-free simulation resume ──
          recordDriverPosition(busId, data.lat, data.lng);

          // ── Intelligence: record speed sample for this route ──
          if (routeId && (data.speed ?? 0) > 0) {
            recordSpeed(routeId, data.speed!).catch(() => { /* non-critical */ });
          }

          // ── Calculate occupancy ──
          const passengerCount = data.passengerCount ?? bus.passengerCount;
          const occupancy = calculateOccupancy(passengerCount, bus.capacity);

          // ── Build update payload ──
          const busUpdate = {
            busId,
            routeId: routeId ?? '',
            latitude: data.lat,
            longitude: data.lng,
            heading,
            speed: data.speed ?? 0,
            passengerCount,
            capacity: bus.capacity,
            occupancy,
            isSimulated: false,
            registrationNo: bus.registrationNo,
            routeNumber: bus.route?.routeNumber,
            routeName: bus.route?.name,
          };

          // ── Broadcast to passenger & admin namespaces ──
          try {
            const passengerNs = getPassengerNamespace();
            passengerNs.emit('bus:update', busUpdate);
          } catch { /* namespace may not be ready */ }

          try {
            const adminNs = getAdminNamespace();
            adminNs.emit('bus:update', busUpdate);
          } catch { /* namespace may not be ready */ }

          // ── Publish to Redis for horizontal scaling (failover-safe) ──
          try {
            const redis = getRedis();
            await redis.publish('bus:location', JSON.stringify(busUpdate));
          } catch {
            // Redis down — local socket broadcasts still work
          }

          // ── Evaluate notification rules ──
          notificationRulesService.evaluateBusUpdate({
            busId,
            routeId: routeId ?? '',
            latitude: data.lat,
            longitude: data.lng,
            speed: data.speed ?? 0,
            passengerCount,
            capacity: bus.capacity,
            routeNumber: bus.route?.routeNumber,
            routeName: bus.route?.name,
          }).catch(() => { /* notification failures are non-critical */ });

          socket.emit('location:confirmed', {
            busId,
            occupancy,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          logger.error('Error updating driver location', { driverId: driver.id, error });
          socket.emit('error', { message: 'Failed to update location' });
        }
      },
    );

    // ── Heartbeat handler ────────────────────────────────────────

    socket.on('driver:heartbeat', (payload: { timestamp?: number }) => {
      socket.emit('driver:heartbeat:ack', {
        timestamp: payload?.timestamp ?? Date.now(),
      });
    });

    // ── Trip start/end handlers ─────────────────────────────────

    socket.on('driver:trip:start', async () => {
      try {
        // Check for existing active trip
        const existingTrip = await prisma.trip.findFirst({
          where: { busId, status: 'IN_PROGRESS' },
        });

        if (existingTrip) {
          socket.emit('error', { message: 'Trip already in progress' });
          return;
        }

        const trip = await prisma.trip.create({ data: { busId } });

        await driverStateService.transition(driver.id, 'ON_TRIP', 'Trip started');

        socket.emit('trip:started', { tripId: trip.id, startTime: trip.startTime });

        // Notify passengers
        notificationRulesService.notifyTripStarted(
          busId,
          bus.route?.routeNumber,
          bus.route?.name,
        ).catch(() => { /* non-critical */ });

        logger.info('Driver started trip', { driverId: driver.id, busId, tripId: trip.id });
      } catch (error) {
        logger.error('Failed to start trip', { driverId: driver.id, error });
        socket.emit('error', { message: 'Failed to start trip' });
      }
    });

    socket.on('driver:trip:end', async () => {
      try {
        const activeTrip = await prisma.trip.findFirst({
          where: { busId, status: 'IN_PROGRESS' },
        });

        if (!activeTrip) {
          socket.emit('error', { message: 'No active trip to end' });
          return;
        }

        const trip = await prisma.trip.update({
          where: { id: activeTrip.id },
          data: { status: 'COMPLETED', endTime: new Date() },
        });

        await driverStateService.transition(driver.id, 'ONLINE', 'Trip completed');

        socket.emit('trip:ended', { tripId: trip.id, endTime: trip.endTime });

        // Notify passengers
        notificationRulesService.notifyTripEnded(
          busId,
          bus.route?.routeNumber,
        ).catch(() => { /* non-critical */ });

        logger.info('Driver ended trip', { driverId: driver.id, busId, tripId: trip.id });
      } catch (error) {
        logger.error('Failed to end trip', { driverId: driver.id, error });
        socket.emit('error', { message: 'Failed to end trip' });
      }
    });

    // ── Driver disconnect handler ───────────────────────────────

    socket.on('disconnect', async () => {
      clearInterval(heartbeat);
      logger.info('Driver disconnected', { userId: user.userId, driverId: driver.id, busId });

      // ── State Machine: transition to DISCONNECTED ──
      await driverStateService.transition(driver.id, 'DISCONNECTED', 'Socket disconnected');
      driverStateService.removeDriver(driver.id);
      clearDriverSafetyData(driver.id);

      // ── Intelligence: record disconnect for route reliability ──
      if (routeId) {
        recordDisconnect(routeId).catch(() => { /* non-critical */ });
      }

      // Clean up Redis keys (failover-safe)
      try {
        const redis = getRedis();
        await redis.del(`${REDIS_DRIVER_PREFIX}${user.userId}`);
        await redis.del(`bus:driver:${busId}`);
      } catch {
        // Redis down — cleanup will happen on key TTL expiration
      }

      // Notify admin immediately (admin should know about disconnect)
      try {
        const adminNs = getAdminNamespace();
        adminNs.emit('driver:disconnected', {
          driverId: driver.id,
          busId,
          userId: user.userId,
          timestamp: new Date().toISOString(),
        });
      } catch { /* namespace may not be ready */ }

      // ── Hybrid: unregister bus (starts grace period) ──
      // Defer bus:offline and trip cancellation to AFTER grace period expires.
      // If driver reconnects within 10s, passengers never see the bus go offline
      // and the trip survives the transient disconnection.
      unregisterDriverBus(busId, driver.id, routeId, async () => {
        // Grace period expired — driver did NOT reconnect

        // Notify passengers the bus is now offline
        try {
          const passengerNs = getPassengerNamespace();
          passengerNs.emit('bus:offline', { busId });
        } catch { /* namespace may not be ready */ }

        // Cancel any active trip
        try {
          const activeTrip = await prisma.trip.findFirst({
            where: { busId, status: 'IN_PROGRESS' },
          });
          if (activeTrip) {
            await prisma.trip.update({
              where: { id: activeTrip.id },
              data: { status: 'CANCELLED', endTime: new Date() },
            });
            logger.info('Active trip cancelled after grace period', { tripId: activeTrip.id, busId });
          }
        } catch (error) {
          logger.error('Failed to cancel trip after grace period', { busId, error });
        }
      });

      logger.info('Bus entered grace period — simulation will resume after timeout', { busId });
    });
  });
}

// ── Admin namespace ─────────────────────────────────────────────────────────

export function setupAdminTracking(ns: Namespace): void {
  ns.use(authenticateSocket);

  ns.on('connection', (socket) => {
    const user = socket.data.user as AuthPayload;

    if (user.role !== 'ADMIN') {
      socket.disconnect();
      return;
    }

    logger.info('Admin connected to live tracking', { userId: user.userId, socketId: socket.id });

    // Prevent listener stacking
    socket.removeAllListeners('buses:request-all');
    socket.removeAllListeners('drivers:request-status');

    // ── All buses request ───────────────────────────────────────

    socket.on('buses:request-all', async () => {
      try {
        const buses = await prisma.bus.findMany({
          where: { status: 'ACTIVE' },
          include: {
            route: { select: { routeNumber: true, name: true, routeType: true } },
            driver: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        });

        socket.emit(
          'buses:all',
          buses.map((b) => ({
            ...b,
            occupancy: calculateOccupancy(b.passengerCount, b.capacity),
            driverName: b.driver?.user?.name ?? null,
            driverStatus: b.driver?.driverStatus ?? null,
          })),
        );
      } catch (error) {
        logger.error('Error fetching all buses for admin', { error });
      }
    });

    // ── Live driver status request ──────────────────────────────

    socket.on('drivers:request-status', async () => {
      try {
        const stateCounts = await driverStateService.getStateCounts();

        const [totalBuses, simulatedBuses] = await Promise.all([
          prisma.bus.count({ where: { status: 'ACTIVE' } }),
          prisma.bus.count({ where: { status: 'ACTIVE', isSimulated: true } }),
        ]);

        socket.emit('drivers:status', {
          totalBuses,
          simulatedBuses,
          realDriverBuses: totalBuses - simulatedBuses,
          driversOnline: stateCounts.ONLINE + stateCounts.ON_TRIP,
          driversOnTrip: stateCounts.ON_TRIP,
          driversIdle: stateCounts.IDLE,
          driversOffline: stateCounts.OFFLINE,
          driversDisconnected: stateCounts.DISCONNECTED,
        });
      } catch (error) {
        logger.error('Error fetching driver status for admin', { error });
      }
    });

    socket.on('disconnect', () => {
      logger.debug('Admin disconnected from live tracking', { userId: user.userId, socketId: socket.id });
    });
  });
}
