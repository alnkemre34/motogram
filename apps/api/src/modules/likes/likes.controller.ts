import { Controller, Delete, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LikeToggleResponseSchema } from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';

import { LikesService } from './likes.service';

@Controller('likes')
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  // Spec 8.7.1 - Begeni: 60/dakika
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post(':postId')
  @ZodResponse(LikeToggleResponseSchema)
  async like(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.likes.like(user.userId, postId);
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Delete(':postId')
  @ZodResponse(LikeToggleResponseSchema)
  async unlike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.likes.unlike(user.userId, postId);
  }
}
