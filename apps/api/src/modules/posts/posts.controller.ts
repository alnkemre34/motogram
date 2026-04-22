import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreatePostSchema,
  PostApiResponseSchema,
  PostDeleteResponseSchema,
  PostFeedPageSchema,
  PostFeedQuerySchema,
  UpdatePostSchema,
  type CreatePostDto,
  type PostFeedQueryDto,
  type UpdatePostDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @ZodResponse(PostApiResponseSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreatePostSchema)) dto: CreatePostDto,
  ) {
    return this.posts.create(user.userId, dto);
  }

  @Get('feed')
  @ZodResponse(PostFeedPageSchema)
  async feed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, string>,
  ) {
    const query: PostFeedQueryDto = PostFeedQuerySchema.parse(rawQuery);
    return this.posts.feedForUser(user.userId, query);
  }

  @Get('user/:userId')
  @ZodResponse(PostFeedPageSchema)
  async byUser(
    @Param('userId') userId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    const query: PostFeedQueryDto = PostFeedQuerySchema.parse(rawQuery);
    return this.posts.userPosts(userId, query);
  }

  @Get(':id')
  @ZodResponse(PostApiResponseSchema)
  async getOne(@Param('id') id: string) {
    return this.posts.findById(id);
  }

  @Patch(':id')
  @ZodResponse(PostApiResponseSchema)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodBody(UpdatePostSchema)) dto: UpdatePostDto,
  ) {
    return this.posts.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ZodResponse(PostDeleteResponseSchema)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.posts.remove(user.userId, id);
    return { success: true as const };
  }
}
