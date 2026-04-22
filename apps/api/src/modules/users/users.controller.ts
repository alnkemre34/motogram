import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  SuccessTrueSchema,
  UpdateProfileSchema,
  UserMeResponseSchema,
  UserPublicApiResponseSchema,
  type UpdateProfileDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ZodResponse(UserMeResponseSchema)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getMe(user.userId);
  }

  @Patch('me')
  @ZodResponse(UserPublicApiResponseSchema)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(UpdateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.userId, dto);
  }

  @Delete('me')
  @ZodResponse(SuccessTrueSchema)
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.users.requestAccountDeletion(user.userId);
    return { success: true };
  }

  // Spec 7.2.1 - 30 gun icinde geri donulurse silme iptal olur
  @Post('me/cancel-deletion')
  @ZodResponse(SuccessTrueSchema)
  async cancelDeletion(@CurrentUser() user: AuthenticatedUser) {
    await this.users.cancelAccountDeletion(user.userId);
    return { success: true };
  }

  @Get(':username')
  @ZodResponse(UserPublicApiResponseSchema)
  async getByUsername(@Param('username') username: string) {
    return this.users.getPublicProfileByUsername(username);
  }
}
