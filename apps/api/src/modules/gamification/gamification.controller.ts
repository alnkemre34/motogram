import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ShowcaseUserBadgeSchema,
  UserBadgeDtoSchema,
  UserBadgesListResponseSchema,
  UserQuestsListResponseSchema,
  type ShowcaseUserBadgeDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GamificationService } from './gamification.service';

// Spec 2.6 + 3.6 - Quest/Badge listeleme + vitrin yonetimi.

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly service: GamificationService) {}

  @Get('badges')
  @ZodResponse(UserBadgesListResponseSchema)
  async badges(@CurrentUser() user: AuthenticatedUser) {
    return { badges: await this.service.listUserBadges(user.userId) };
  }

  @Get('quests')
  @ZodResponse(UserQuestsListResponseSchema)
  async quests(@CurrentUser() user: AuthenticatedUser) {
    return { quests: await this.service.listUserQuests(user.userId) };
  }

  @Post('badges/showcase')
  @ZodResponse(UserBadgeDtoSchema)
  async showcase(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(ShowcaseUserBadgeSchema)) dto: ShowcaseUserBadgeDto,
  ) {
    return this.service.toggleShowcase(user.userId, dto);
  }
}
