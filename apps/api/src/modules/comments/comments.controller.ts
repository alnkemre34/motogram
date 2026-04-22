import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CommentListPageResponseSchema,
  CommentRowResponseSchema,
  CreateCommentSchema,
  SuccessTrueSchema,
  UpdateCommentSchema,
  type CreateCommentDto,
  type UpdateCommentDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { CommentsService } from './comments.service';

@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  // Spec 8.7.1 - Yorum: 30/dakika
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post()
  @ZodResponse(CommentRowResponseSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateCommentSchema)) dto: CreateCommentDto,
  ) {
    return this.comments.create(user.userId, dto);
  }

  @Get('post/:postId')
  @ZodResponse(CommentListPageResponseSchema)
  async list(
    @Param('postId') postId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.comments.listForPost(postId, cursor, limit ? Number(limit) : 20);
  }

  @Patch(':id')
  @ZodResponse(CommentRowResponseSchema)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodBody(UpdateCommentSchema)) dto: UpdateCommentDto,
  ) {
    return this.comments.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ZodResponse(SuccessTrueSchema)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.comments.remove(user.userId, id);
    return { success: true };
  }
}
