import { Controller, Delete, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FollowActionResponseSchema, FollowUnfollowResponseSchema } from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';

import { FollowsService } from './follows.service';

@Controller('follows')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  // Spec 8.7.1 - Takip Etme: 20/dakika
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post(':userId')
  @ZodResponse(FollowActionResponseSchema)
  async follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ): Promise<{ status: string }> {
    return this.follows.follow(user.userId, userId);
  }

  @Delete(':userId')
  @ZodResponse(FollowUnfollowResponseSchema)
  async unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    await this.follows.unfollow(user.userId, userId);
    return { success: true as const };
  }
}
