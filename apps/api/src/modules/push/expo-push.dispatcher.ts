import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

import { PushService, type PushDispatcher, type PushPayload } from './push.service';

// Spec 9.3 - Expo Push Notification dispatcher (EAS/Expo token formatli cihazlar icin).
// EXPO platform ile kayitli token'lar icin tetiklenir. FCM/APNs icin ayri
// dispatcher'lar (firebase-admin / node-apn) uretim ortaminda eklenir.

@Injectable()
export class ExpoPushDispatcher implements PushDispatcher, OnModuleInit {
  readonly name = 'expo';
  private readonly logger = new Logger(ExpoPushDispatcher.name);
  private expo: Expo | null = null;

  constructor(
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    // Prod: EAS access token gerekli; dev'de de calisabilir ama rate-limit dusuk.
    this.expo = new Expo(accessToken ? { accessToken } : undefined);
    this.push.registerDispatcher('EXPO', this);
    this.logger.log('expo_push_dispatcher_ready');
  }

  async send(token: string, payload: PushPayload): Promise<'ok' | 'invalid' | 'error'> {
    if (!this.expo) return 'error';
    if (!Expo.isExpoPushToken(token)) {
      this.logger.warn(`expo_invalid_token prefix=${String(token).slice(0, 10)}`);
      return 'invalid';
    }
    const msg: ExpoPushMessage = {
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: (payload.sound as 'default') ?? 'default',
      badge: payload.badge,
      priority: 'high',
      channelId: 'default',
    };
    try {
      const chunks = this.expo.chunkPushNotifications([msg]);
      const tickets: ExpoPushTicket[] = [];
      for (const chunk of chunks) {
        const t = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...t);
      }
      const ticket = tickets[0];
      if (!ticket) return 'error';
      if (ticket.status === 'error') {
        const code = ticket.details?.error;
        if (code === 'DeviceNotRegistered') return 'invalid';
        this.logger.warn(`expo_push_ticket_error code=${code} msg=${ticket.message}`);
        return 'error';
      }
      return 'ok';
    } catch (err) {
      this.logger.error(`expo_push_send_failed err=${(err as Error).message}`);
      return 'error';
    }
  }
}
