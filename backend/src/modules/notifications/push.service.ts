import { prisma } from '../../config/database';
import { getRedis } from '../../config/redis';
import { logger } from '../../utils/logger';

// ── Expo Push Notification Service ──────────────────────────────────────────
//
// Sends push notifications via the Expo Push API.
// Handles token storage, batch sending, rate limiting, and error handling.
//
// Hardened for:
//   - Invalid/expired Expo tokens (auto-cleanup, no crash)
//   - Redis failover (in-memory dedupe fallback)
//   - Duplicate push prevention on reconnect
//
// ────────────────────────────────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Rate limit: one notification per type per bus per cooldown period
const NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_PREFIX = 'push:ratelimit:';

// In-memory dedupe cache (fallback when Redis is down)
const memoryDedupeCache = new Map<string, number>();
const MEMORY_DEDUPE_CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean every 5 min

// Periodic cleanup of expired in-memory dedupe entries
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of memoryDedupeCache) {
    if (now >= expiresAt) {
      memoryDedupeCache.delete(key);
    }
  }
}, MEMORY_DEDUPE_CLEANUP_INTERVAL);

// ── Types ───────────────────────────────────────────────────────────────────

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  data?: Record<string, unknown>;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  errors: string[];
}

export type NotificationType =
  | 'BUS_ARRIVING'
  | 'BUS_ONE_STOP_AWAY'
  | 'BUS_DELAYED'
  | 'BUS_OCCUPANCY_HIGH'
  | 'TRIP_STARTED'
  | 'TRIP_ENDED';

// ── Service ─────────────────────────────────────────────────────────────────

export class PushService {
  /**
   * Register a push token for a user.
   */
  async registerToken(userId: string, pushToken: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });
    logger.info('Push token registered', { userId });
  }

  /**
   * Unregister (remove) a push token for a user.
   */
  async unregisterToken(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { pushToken: null },
    });
    logger.info('Push token unregistered', { userId });
  }

  /**
   * Send a push notification to a single user by userId.
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (!user?.pushToken) return false;

    return this.sendOne({
      to: user.pushToken,
      title,
      body,
      sound: 'default',
      data,
    });
  }

  /**
   * Send a push notification to all passengers with registered tokens.
   * Optionally filter by a condition (e.g., nearby buses).
   */
  async sendToAllPassengers(
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<PushResult> {
    const users = await prisma.user.findMany({
      where: {
        role: 'PASSENGER',
        pushToken: { not: null },
        status: 'ACTIVE',
      },
      select: { pushToken: true },
    });

    const tokens = users
      .map((u) => u.pushToken)
      .filter((t): t is string => t !== null);

    if (tokens.length === 0) return { sent: 0, failed: 0, errors: [] };

    return this.sendBatch(
      tokens.map((to) => ({ to, title, body, sound: 'default' as const, data })),
    );
  }

  /**
   * Send a rate-limited notification for a specific bus + notification type.
   * Prevents spam: only sends once per bus per type per cooldown period.
   *
   * Uses Redis for rate limiting with in-memory fallback if Redis is unavailable.
   * Prevents duplicate pushes on driver reconnect by key design.
   */
  async sendRateLimited(
    userId: string,
    busId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<boolean> {
    const key = `${RATE_LIMIT_PREFIX}${userId}:${busId}:${type}`;

    // Try Redis first, fall back to in-memory dedupe
    let isDuplicate = false;
    try {
      const redis = getRedis();
      const exists = await redis.exists(key);
      if (exists) {
        isDuplicate = true;
      } else {
        await redis.set(key, '1', 'PX', NOTIFICATION_COOLDOWN_MS);
      }
    } catch {
      // Redis down — use in-memory dedupe fallback
      const expiresAt = memoryDedupeCache.get(key);
      if (expiresAt && Date.now() < expiresAt) {
        isDuplicate = true;
      } else {
        memoryDedupeCache.set(key, Date.now() + NOTIFICATION_COOLDOWN_MS);
      }
    }

    if (isDuplicate) return false;

    return this.sendToUser(userId, title, body, data);
  }

  /**
   * Send a single push notification via Expo Push API.
   * Handles invalid/expired tokens gracefully — no crash.
   */
  private async sendOne(message: PushMessage): Promise<boolean> {
    // Validate token format before sending
    if (!message.to || !message.to.startsWith('ExponentPushToken[')) {
      logger.warn('Push: invalid token format, skipping', { token: message.to?.substring(0, 30) });
      return false;
    }

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error('Expo Push API error', { status: response.status, body: text });
        return false;
      }

      const result = await response.json() as { data?: { status: string; message?: string; details?: { error?: string } } };
      if (result.data?.status === 'error') {
        // Auto-unregister invalid tokens
        const errorType = result.data.details?.error;
        if (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials') {
          logger.info('Push: auto-removing invalid token', { token: message.to.substring(0, 30), error: errorType });
          try {
            await prisma.user.updateMany({
              where: { pushToken: message.to },
              data: { pushToken: null },
            });
          } catch { /* best effort cleanup */ }
        }
        logger.error('Expo Push delivery error', { message: result.data.message, error: errorType });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to send push notification', { error });
      return false;
    }
  }

  /**
   * Send a batch of push notifications via Expo Push API.
   * Expo supports up to 100 messages per request.
   */
  private async sendBatch(messages: PushMessage[]): Promise<PushResult> {
    const result: PushResult = { sent: 0, failed: 0, errors: [] };

    // Chunk into batches of 100 (Expo limit)
    const chunks: PushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          const text = await response.text();
          result.failed += chunk.length;
          result.errors.push(`HTTP ${response.status}: ${text}`);
          continue;
        }

        const json = await response.json() as { data?: Array<{ status: string; message?: string }> };
        if (Array.isArray(json.data)) {
          for (const ticket of json.data) {
            if (ticket.status === 'ok') {
              result.sent++;
            } else {
              result.failed++;
              if (ticket.message) result.errors.push(ticket.message);
            }
          }
        }
      } catch (error) {
        result.failed += chunk.length;
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        logger.error('Push batch send failed', { error, chunkSize: chunk.length });
      }
    }

    if (result.sent > 0) {
      logger.info('Push notifications sent', { sent: result.sent, failed: result.failed });
    }

    return result;
  }
}

// Singleton
export const pushService = new PushService();
