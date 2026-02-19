import { getRedis } from '../../config/redis';
import { logger } from '../../utils/logger';
import { pushService } from './push.service';

export class NotificationsService {
  /**
   * Publish a notification event to a Redis channel.
   * Clients can subscribe via Socket.io or SSE in the future.
   */
  async publish(channel: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const redis = getRedis();
      await redis.publish(channel, JSON.stringify(payload));
      logger.debug('Notification published', { channel });
    } catch (error) {
      logger.error('Failed to publish notification', { channel, error });
    }
  }

  /** Broadcast to all drivers via Redis pub/sub */
  async notifyDrivers(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.publish('notifications:drivers', { message, ...data, timestamp: new Date().toISOString() });
  }

  /** Broadcast to all passengers via Redis pub/sub + push notification */
  async notifyPassengers(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.publish('notifications:passengers', { message, ...data, timestamp: new Date().toISOString() });

    // Also send via Expo push to all passengers with tokens
    await pushService.sendToAllPassengers('HydGo', message, data).catch((error) => {
      logger.error('Failed to send push to passengers', { error });
    });
  }

  /** Send admin alert via Redis pub/sub */
  async notifyAdmins(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.publish('notifications:admins', { message, ...data, timestamp: new Date().toISOString() });
  }
}
