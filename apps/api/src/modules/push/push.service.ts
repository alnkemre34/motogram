import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeviceTokenDto, RegisterDeviceTokenDto } from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';

// Spec 9.3 - Push Notification Altyapisi.
// Faz 4 iskelet: Token kayit + dispatch interface. FCM/APNs/Expo saglayicilari
// icin gercek HTTP cagrisi Faz 5'te eklenir; simdilik log-only + pluggable dispatcher.

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  threadId?: string;
}

export interface PushDispatchResult {
  success: number;
  failure: number;
  invalidTokens: string[];
}

export interface PushDispatcher {
  name: string;
  send(token: string, payload: PushPayload): Promise<'ok' | 'invalid' | 'error'>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly dryRun: boolean;
  private readonly dispatchers = new Map<string, PushDispatcher>();

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.dryRun = config.get<string>('PUSH_DRY_RUN', 'true') !== 'false';
  }

  registerDispatcher(platform: 'IOS' | 'ANDROID' | 'EXPO' | 'WEB', dispatcher: PushDispatcher): void {
    this.dispatchers.set(platform, dispatcher);
    this.logger.log(`push_dispatcher_registered platform=${platform} name=${dispatcher.name}`);
  }

  async registerToken(userId: string, dto: RegisterDeviceTokenDto): Promise<DeviceTokenDto> {
    const existing = await this.prisma.deviceToken.findUnique({ where: { token: dto.token } });
    if (existing && existing.userId !== userId) {
      // Token baska kullaniciya aitti -> yeni sahibine devret (cihaz degismis olabilir)
      const moved = await this.prisma.deviceToken.update({
        where: { token: dto.token },
        data: {
          userId,
          platform: dto.platform,
          appVersion: dto.appVersion,
          revokedAt: null,
          lastSeenAt: new Date(),
        },
      });
      return this.toDto(moved);
    }
    const upserted = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        appVersion: dto.appVersion,
      },
      update: {
        platform: dto.platform,
        appVersion: dto.appVersion,
        revokedAt: null,
        lastSeenAt: new Date(),
      },
    });
    return this.toDto(upserted);
  }

  async revokeToken(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { revokedAt: new Date() },
    });
  }

  async listUserDevices(userId: string): Promise<DeviceTokenDto[]> {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((d) => this.toDto(d));
  }

  // Tek kullaniciya push gonder - tum aktif cihazlarina.
  async sendToUser(userId: string, payload: PushPayload): Promise<PushDispatchResult> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId, revokedAt: null },
    });
    return this.dispatchBulk(devices, payload);
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<PushDispatchResult> {
    if (userIds.length === 0) return { success: 0, failure: 0, invalidTokens: [] };
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, revokedAt: null },
    });
    return this.dispatchBulk(devices, payload);
  }

  private async dispatchBulk(
    devices: Array<{ id: string; token: string; platform: string; userId: string }>,
    payload: PushPayload,
  ): Promise<PushDispatchResult> {
    const result: PushDispatchResult = { success: 0, failure: 0, invalidTokens: [] };
    for (const d of devices) {
      try {
        const outcome = await this.dispatch(d.platform as 'IOS' | 'ANDROID' | 'EXPO' | 'WEB', d.token, payload);
        if (outcome === 'ok') result.success += 1;
        else if (outcome === 'invalid') {
          result.failure += 1;
          result.invalidTokens.push(d.token);
        } else {
          result.failure += 1;
        }
      } catch (err) {
        result.failure += 1;
        this.logger.warn(`push_dispatch_error token=${d.token.slice(0, 10)} err=${(err as Error).message}`);
      }
    }
    if (result.invalidTokens.length > 0) {
      await this.prisma.deviceToken.updateMany({
        where: { token: { in: result.invalidTokens } },
        data: { revokedAt: new Date() },
      });
    }
    return result;
  }

  private async dispatch(
    platform: 'IOS' | 'ANDROID' | 'EXPO' | 'WEB',
    token: string,
    payload: PushPayload,
  ): Promise<'ok' | 'invalid' | 'error'> {
    if (this.dryRun || !this.dispatchers.has(platform)) {
      // Faz 4 - gercek FCM/APNs/Expo entegrasyonu Faz 5'te. Simdi log.
      this.logger.log(
        `push_dry_run platform=${platform} token=${token.slice(0, 12)}... title="${payload.title}"`,
      );
      return 'ok';
    }
    return this.dispatchers.get(platform)!.send(token, payload);
  }

  private toDto(d: {
    id: string;
    platform: 'IOS' | 'ANDROID' | 'EXPO' | 'WEB' | string;
    appVersion: string | null;
    createdAt: Date;
    lastSeenAt: Date;
  }): DeviceTokenDto {
    return {
      id: d.id,
      platform: d.platform as DeviceTokenDto['platform'],
      appVersion: d.appVersion ?? null,
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt.toISOString(),
    };
  }
}
