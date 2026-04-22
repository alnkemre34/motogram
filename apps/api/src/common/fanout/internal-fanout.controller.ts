import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { OkTrueSchema } from '@motogram/shared';
import { z } from 'zod';

import { Public } from '../decorators/public.decorator';
import { InternalTokenGuard } from '../guards/internal-token.guard';
import { ZodResponse } from '../interceptors/zod-serializer.interceptor';
import { LocationGateway } from '../../modules/party/location.gateway';

const FanoutBodySchema = z.object({
  userId: z.string().uuid(),
  event: z.string().min(1),
  data: z.unknown(),
});

@Controller('internal')
@SkipThrottle()
export class InternalFanoutController {
  constructor(private readonly gateway: LocationGateway) {}

  @Public()
  @UseGuards(InternalTokenGuard)
  @Post('fanout')
  @HttpCode(200)
  @ZodResponse(OkTrueSchema)
  fanout(@Body() raw: unknown) {
    const body = FanoutBodySchema.parse(raw);
    this.gateway.emitToUser(body.userId, body.event, body.data);
    return { ok: true as const };
  }
}
