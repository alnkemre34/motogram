import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Redis } from 'ioredis';

import { HealthLivezSchema, HealthReadyzSchema } from '@motogram/shared';

import { Public } from '../decorators/public.decorator';
import { ZodResponse } from '../interceptors/zod-serializer.interceptor';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { REDIS_CLIENT } from '../../modules/redis/redis.service';
import { ReadinessService } from './readiness.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly readiness: ReadinessService,
  ) {}

  @Public()
  @Get('livez')
  @ZodResponse(HealthLivezSchema)
  livez() {
    return { ok: true as const };
  }

  @Public()
  @Get('readyz')
  @ZodResponse(HealthReadyzSchema)
  async readyz(@Res({ passthrough: true }) res: Response): Promise<{ ok: boolean; reason?: string }> {
    if (!this.readiness.isAcceptingTraffic()) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { ok: false, reason: 'shutting_down' };
    }

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        sleep(500).then(() => Promise.reject(new Error('db_timeout'))),
      ]);
      await Promise.race([
        this.redis.ping(),
        sleep(500).then(() => Promise.reject(new Error('redis_timeout'))),
      ]);
      return { ok: true };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { ok: false, reason: 'dependency_unhealthy' };
    }
  }

  /** @deprecated Use /v1/readyz — kept for backward compatibility (same checks as readyz). */
  @Public()
  @Get('healthz')
  @ZodResponse(HealthReadyzSchema)
  async healthz(@Res({ passthrough: true }) res: Response): Promise<{ ok: boolean; reason?: string }> {
    return this.readyz(res);
  }
}
