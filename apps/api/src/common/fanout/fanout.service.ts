import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';

import { getServerHostname } from '../config/server-identity';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { LocationGateway } from '../../modules/party/location.gateway';

/**
 * Ayni kullaniciya farkli API replica uzerinden WS ileti (HMAC internal HTTP).
 */
@Injectable()
export class FanoutService {
  private readonly logger = new Logger(FanoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: LocationGateway,
    private readonly config: ConfigService,
  ) {}

  async emitToPartyUser(userId: string, event: string, data: unknown): Promise<void> {
    const member = await this.prisma.partyMember.findFirst({
      where: { userId, leftAt: null },
      select: { serverHostname: true },
    });
    const host = member?.serverHostname ?? null;
    const self = getServerHostname();

    if (!host || host === self) {
      this.gateway.emitToUser(userId, event, data);
      return;
    }

    const secret = this.config.get<string>('INTERNAL_API_SHARED_SECRET');
    if (!secret) {
      this.logger.warn('fanout_skip_no_secret');
      this.gateway.emitToUser(userId, event, data);
      return;
    }

    const body = { userId, event, data };
    const bodyStr = JSON.stringify(body);
    const ts = Date.now().toString();
    const nonce = randomUUID();
    const sig = createHmac('sha256', secret).update(`${ts}.${nonce}.${bodyStr}`).digest('hex');

    const url = `http://${host}:3000/v1/internal/fanout`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-ts': ts,
          'x-internal-nonce': nonce,
          'x-internal-sig': sig,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(2_000),
      });
      if (!res.ok) {
        this.logger.warn(`fanout_http_failed status=${res.status} url=${url}`);
        this.gateway.emitToUser(userId, event, data);
      }
    } catch (e) {
      this.logger.warn(`fanout_http_error ${(e as Error).message} url=${url}`);
      this.gateway.emitToUser(userId, event, data);
    }
  }
}
