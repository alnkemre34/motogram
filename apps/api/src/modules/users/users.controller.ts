import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ChangeUsernameSchema,
  FollowListPageResponseSchema,
  FollowListQuerySchema,
  SuccessTrueSchema,
  UpdateProfileSchema,
  UserMeResponseSchema,
  UserPublicApiResponseSchema,
  UserSearchQuerySchema,
  UserSearchResponseSchema,
  type ChangeUsernameDto,
  type FollowListQueryDto,
  type UpdateProfileDto,
  type UserSearchQueryDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { FollowsService } from '../follows/follows.service';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly follows: FollowsService,
  ) {}

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

  /** B-06 — 30 gün cooldown + rezerv kullanıcı adları (UsersService). */
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @Patch('me/username')
  @ZodResponse(UserPublicApiResponseSchema)
  async changeUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(ChangeUsernameSchema)) dto: ChangeUsernameDto,
  ) {
    return this.users.changeUsername(user.userId, dto);
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

  /** B-08 — `search` route’u `:username`’den önce tanımlanmalı. */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('search')
  @ZodResponse(UserSearchResponseSchema)
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawQuery)) {
      flat[k] = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
    }
    const query: UserSearchQueryDto = UserSearchQuerySchema.parse(flat);
    return this.users.searchUsers(user.userId, query);
  }

  /** B-09 — `:username` ile çakışmaması için `me/...` ve `:userId/...` açık path’ler. */
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('me/followers')
  @ZodResponse(FollowListPageResponseSchema)
  async myFollowers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawQuery)) {
      flat[k] = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
    }
    const query: FollowListQueryDto = FollowListQuerySchema.parse(flat);
    return this.follows.listFollowersForProfile(user.userId, user.userId, query);
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('me/following')
  @ZodResponse(FollowListPageResponseSchema)
  async myFollowing(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawQuery)) {
      flat[k] = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
    }
    const query: FollowListQueryDto = FollowListQuerySchema.parse(flat);
    return this.follows.listFollowingForProfile(user.userId, user.userId, query);
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get(':userId/followers')
  @ZodResponse(FollowListPageResponseSchema)
  async userFollowers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) profileUserId: string,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawQuery)) {
      flat[k] = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
    }
    const query: FollowListQueryDto = FollowListQuerySchema.parse(flat);
    return this.follows.listFollowersForProfile(user.userId, profileUserId, query);
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get(':userId/following')
  @ZodResponse(FollowListPageResponseSchema)
  async userFollowing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) profileUserId: string,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawQuery)) {
      flat[k] = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
    }
    const query: FollowListQueryDto = FollowListQuerySchema.parse(flat);
    return this.follows.listFollowingForProfile(user.userId, profileUserId, query);
  }

  @Get(':username')
  @ZodResponse(UserPublicApiResponseSchema)
  async getByUsername(@Param('username') username: string) {
    return this.users.getPublicProfileByUsername(username);
  }
}
