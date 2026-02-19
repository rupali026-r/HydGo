import { Logger } from '@nestjs/common';
import { WebSocketGateway, SubscribeMessage, MessageBody, OnGatewayInit, WebSocketServer, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({ namespace: '/live', cors: { origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/] } })
export class LiveGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;
  private readonly logger = new Logger(LiveGateway.name);

  constructor(private readonly redis: RedisService) {}

  afterInit() {
    this.logger.log('LiveGateway initialized');
  }

  @SubscribeMessage('subscribe:bus')
  handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { busId: string }) {
    client.join(`bus:${body.busId}`);
    return { ok: true };
  }

  @SubscribeMessage('driver:location')
  async handleDriverLocation(@MessageBody() body: { busId: string; lat: number; lng: number; speed?: number }) {
    const key = `bus:${body.busId}:location`;
    const r = this.redis.getClient();
    await r.hmset(key, { lat: body.lat.toString(), lng: body.lng.toString(), speed: (body.speed ?? 0).toString() });
    await r.expire(key, 60 * 60);
    this.server.to(`bus:${body.busId}`).emit('bus:location', body);
    return { ok: true };
  }
}
