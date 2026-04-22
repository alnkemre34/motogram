import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CommunitiesMineResponseSchema,
  CommunityDetailSchema,
  CommunityJoinHttpResponseSchema,
  CommunityMembersResponseSchema,
  CommunityPendingRequestsResponseSchema,
  CommunityRespondJoinHttpResponseSchema,
  CreateCommunitySchema,
  JoinCommunitySchema,
  NearbyCommunitiesQuerySchema,
  NearbyCommunitiesResponseSchema,
  OkTrueSchema,
  RespondCommunityJoinSchema,
  UpdateCommunityMemberRoleSchema,
  UpdateCommunitySchema,
  type CreateCommunityDto,
  type JoinCommunityDto,
  type NearbyCommunitiesQueryDto,
  type RespondCommunityJoinDto,
  type UpdateCommunityDto,
  type UpdateCommunityMemberRoleDto,
} from '@motogram/shared';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunityService } from './community.service';

// Spec 2.4.2 / 2.4.3 - REST: /v1/communities CRUD + uyelik + nearby.

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  @Post()
  @HttpCode(201)
  @ZodResponse(CommunityDetailSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateCommunitySchema)) dto: CreateCommunityDto,
  ) {
    return this.service.createCommunity(user.userId, dto);
  }

  @Put(':id')
  @ZodResponse(CommunityDetailSchema)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') communityId: string,
    @Body(new ZodBody(UpdateCommunitySchema)) dto: UpdateCommunityDto,
  ) {
    return this.service.updateCommunity(user.userId, communityId, dto);
  }

  @Get('me')
  @ZodResponse(CommunitiesMineResponseSchema)
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return { communities: await this.service.listMine(user.userId) };
  }

  @Get('nearby')
  @ZodResponse(NearbyCommunitiesResponseSchema)
  async nearby(@Query() raw: Record<string, string>) {
    const parsed = NearbyCommunitiesQuerySchema.parse({
      lat: raw.lat ? Number(raw.lat) : undefined,
      lng: raw.lng ? Number(raw.lng) : undefined,
      radius: raw.radius ? Number(raw.radius) : undefined,
      limit: raw.limit ? Number(raw.limit) : undefined,
    } as Partial<NearbyCommunitiesQueryDto>);
    const rows = await this.service.listNearby(parsed);
    return { communities: rows };
  }

  @Get(':id')
  @ZodResponse(CommunityDetailSchema)
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') communityId: string,
  ) {
    return this.service.getCommunityDetail(communityId, user.userId);
  }

  @Get(':id/members')
  @ZodResponse(CommunityMembersResponseSchema)
  async members(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') communityId: string,
  ) {
    return { members: await this.service.listMembers(communityId, user.userId) };
  }

  @Get(':id/pending')
  @ZodResponse(CommunityPendingRequestsResponseSchema)
  async pending(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') communityId: string,
  ) {
    return {
      requests: await this.service.listPendingJoinRequests(user.userId, communityId),
    };
  }

  @Post(':id/join')
  @HttpCode(200)
  @ZodResponse(CommunityJoinHttpResponseSchema)
  async join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') communityId: string,
    @Body(new ZodBody(JoinCommunitySchema.omit({ communityId: true }))) body: Omit<JoinCommunityDto, 'communityId'>,
  ) {
    return this.service.joinCommunity(user.userId, { communityId, ...body });
  }

  @Post(':id/respond-join')
  @HttpCode(200)
  @ZodResponse(CommunityRespondJoinHttpResponseSchema)
  async respondJoin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') communityId: string,
    @Body(new ZodBody(RespondCommunityJoinSchema.omit({ communityId: true })))
    body: Omit<RespondCommunityJoinDto, 'communityId'>,
  ) {
    return this.service.respondJoinRequest(user.userId, { communityId, ...body });
  }

  @Delete(':id/leave')
  @HttpCode(204)
  async leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') communityId: string,
  ) {
    await this.service.leaveCommunity(user.userId, communityId);
  }

  @Post(':id/members/role')
  @HttpCode(200)
  @ZodResponse(OkTrueSchema)
  async changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') communityId: string,
    @Body(new ZodBody(UpdateCommunityMemberRoleSchema.omit({ communityId: true })))
    body: Omit<UpdateCommunityMemberRoleDto, 'communityId'>,
  ) {
    await this.service.updateMemberRole(user.userId, { communityId, ...body });
    return { ok: true };
  }
}
