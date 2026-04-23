import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CreatePartySchema,
  InviteToPartySchema,
  JoinPartySchema,
  NearbyPartiesQuerySchema,
  NearbyPartiesResponseSchema,
  PartyDetailSchema,
  PartyInviteBatchResponseSchema,
  PartyInvitesMineResponseSchema,
  PartyLeaveHttpResponseSchema,
  PartyRespondInviteHttpResponseSchema,
  PartySummarySchema,
  RespondPartyInviteSchema,
  type CreatePartyDto,
  type InviteToPartyDto,
  type NearbyPartiesQueryDto,
  type RespondPartyInviteDto,
} from '@motogram/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PartyService } from './party.service';

// Spec 2.4.2 - REST: /v1/parties CRUD + davetiye uclari.
// Global prefix 'v1' main.ts'te; burada 'parties'.
// B-03: Statik yollar (`invites/me`, `invites/respond`, liste `GET ''`) `:id`'den once tanimlanir.

@Controller('parties')
@UseGuards(JwtAuthGuard)
export class PartyController {
  constructor(private readonly party: PartyService) {}

  // Spec 8.7.1 - Parti olusturma saatte 5 (ek guvenlik @Throttle)
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ZodResponse(PartySummarySchema)
  async create(
    @CurrentUser('id') userId: string,
    @Body(new ZodBody(CreatePartySchema)) dto: CreatePartyDto,
  ) {
    return this.party.createParty(userId, dto);
  }

  @Get('invites/me')
  @ZodResponse(PartyInvitesMineResponseSchema)
  async myInvites(@CurrentUser('id') userId: string) {
    return this.party.listInvitesForUser(userId);
  }

  @Post('invites/respond')
  @HttpCode(200)
  @ZodResponse(PartyRespondInviteHttpResponseSchema)
  async respondInvite(
    @CurrentUser('id') userId: string,
    @Body(new ZodBody(RespondPartyInviteSchema)) dto: RespondPartyInviteDto,
  ) {
    return this.party.respondInvite(userId, dto.inviteId, dto.accept);
  }

  @Get()
  @ZodResponse(NearbyPartiesResponseSchema)
  async listNearby(
    @Query() query: Record<string, string>,
  ) {
    const parsed = NearbyPartiesQuerySchema.safeParse({
      lat: query.lat ? Number(query.lat) : undefined,
      lng: query.lng ? Number(query.lng) : undefined,
      radius: query.radius ? Number(query.radius) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    } satisfies Partial<NearbyPartiesQueryDto>);
    if (!parsed.success) {
      // Zod hatasini standart BadRequest'e cevirme
      return { parties: [] };
    }
    const rows = await this.party.listNearbyPublicParties(parsed.data.limit);
    return { parties: rows.map((p) => ({ ...p, distance: null })) };
  }

  @Post(':id/join')
  @HttpCode(200)
  @ZodResponse(PartyDetailSchema)
  async join(
    @CurrentUser('id') userId: string,
    @Param('id') partyId: string,
    @Body(new ZodBody(JoinPartySchema.pick({ inviteId: true }).partial())) _body: { inviteId?: string },
  ) {
    return this.party.joinParty(userId, partyId);
  }

  @Post(':id/leave')
  @HttpCode(200)
  @ZodResponse(PartyLeaveHttpResponseSchema)
  async leave(
    @CurrentUser('id') userId: string,
    @Param('id') partyId: string,
  ) {
    return this.party.leaveParty(userId, partyId, 'LEFT');
  }

  @Post(':id/invite')
  @HttpCode(200)
  @ZodResponse(PartyInviteBatchResponseSchema)
  async invite(
    @CurrentUser('id') userId: string,
    @Param('id') partyId: string,
    @Body(new ZodBody(InviteToPartySchema.omit({ partyId: true }))) body: Omit<InviteToPartyDto, 'partyId'>,
  ) {
    return this.party.invite(userId, partyId, body.userIds);
  }

  @Get(':id')
  @ZodResponse(PartyDetailSchema)
  async getDetail(@Param('id') partyId: string) {
    return this.party.getPartyDetail(partyId);
  }
}
