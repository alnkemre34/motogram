import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../../modules/redis/redis.service';

const NONCE_PREFIX = 'internal:fanout:nonce:';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  private readonly logger = new Logger(InternalTokenGuard.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ts = req.headers['x-internal-ts'] as string | undefined;
    const nonce = req.headers['x-internal-nonce'] as string | undefined;
    const sig = req.headers['x-internal-sig'] as string | undefined;
    if (!ts || !nonce || !sig) {
      throw new UnauthorizedException('internal_auth_missing');
    }
    const now = Date.now();
    const t = Number(ts);
    if (!Number.isFinite(t) || Math.abs(now - t) > 30_000) {
      throw new UnauthorizedException('internal_auth_stale');
    }

    const secret = this.config.get<string>('INTERNAL_API_SHARED_SECRET');
    if (!secret || secret.length < 32) {
      this.logger.error('INTERNAL_API_SHARED_SECRET missing');
      throw new UnauthorizedException('internal_auth_misconfigured');
    }

    const bodyStr = JSON.stringify(req.body ?? {});
    const expected = createHmac('sha256', secret).update(`${ts}.${nonce}.${bodyStr}`).digest('hex');

    try {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('internal_auth_bad_sig');
      }
    } catch {
      throw new UnauthorizedException('internal_auth_bad_sig');
    }

    const nonceKey = `${NONCE_PREFIX}${nonce}`;
    const ok = await this.redis.set(nonceKey, '1', 'EX', 60, 'NX');
    if (ok !== 'OK') {
      throw new UnauthorizedException('internal_auth_replay');
    }

    return true;
  }
}
