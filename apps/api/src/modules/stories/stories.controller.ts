import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  CreateStorySchema,
  StoryFeedResponseSchema,
  StoryRowResponseSchema,
  SuccessTrueSchema,
  type CreateStoryDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { StoriesService } from './stories.service';

@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Post()
  @ZodResponse(StoryRowResponseSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateStorySchema)) dto: CreateStoryDto,
  ) {
    return this.stories.create(user.userId, dto);
  }

  @Get('feed')
  @ZodResponse(StoryFeedResponseSchema)
  async feed(@CurrentUser() user: AuthenticatedUser) {
    return this.stories.activeForFollowing(user.userId);
  }

  @Post(':storyId/views')
  @ZodResponse(SuccessTrueSchema)
  async view(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId') storyId: string,
  ): Promise<{ success: true }> {
    await this.stories.recordView(storyId, user.userId);
    return { success: true };
  }
}
