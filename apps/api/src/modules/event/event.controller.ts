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
  CreateEventSchema,
  EventDetailSchema,
  EventParticipantsResponseSchema,
  EventRsvpResponseSchema,
  EventsMineResponseSchema,
  NearbyEventsQuerySchema,
  NearbyEventsResponseSchema,
  RsvpEventSchema,
  UpdateEventSchema,
  type CreateEventDto,
  type NearbyEventsQueryDto,
  type RsvpEventDto,
  type UpdateEventDto,
} from '@motogram/shared';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventService } from './event.service';

// Spec 2.4.3 / 3.2 / 8.1 - REST: /v1/events CRUD + RSVP + nearby.

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(private readonly service: EventService) {}

  @Post()
  @HttpCode(201)
  @ZodResponse(EventDetailSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateEventSchema)) dto: CreateEventDto,
  ) {
    return this.service.createEvent(user.userId, dto);
  }

  @Put(':id')
  @ZodResponse(EventDetailSchema)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body(new ZodBody(UpdateEventSchema)) dto: UpdateEventDto,
  ) {
    return this.service.updateEvent(user.userId, eventId, dto);
  }

  @Get('me')
  @ZodResponse(EventsMineResponseSchema)
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return { events: await this.service.listMine(user.userId) };
  }

  @Get('nearby')
  @ZodResponse(NearbyEventsResponseSchema)
  async nearby(@Query() raw: Record<string, string>) {
    const parsed = NearbyEventsQuerySchema.parse({
      lat: raw.lat ? Number(raw.lat) : undefined,
      lng: raw.lng ? Number(raw.lng) : undefined,
      radius: raw.radius ? Number(raw.radius) : undefined,
      limit: raw.limit ? Number(raw.limit) : undefined,
      from: raw.from,
      to: raw.to,
    } as Partial<NearbyEventsQueryDto>);
    const rows = await this.service.listNearby(parsed);
    return { events: rows };
  }

  @Get(':id')
  @ZodResponse(EventDetailSchema)
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
  ) {
    return this.service.getDetail(eventId, user.userId);
  }

  @Get(':id/participants')
  @ZodResponse(EventParticipantsResponseSchema)
  async participants(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
  ) {
    return {
      participants: await this.service.listParticipants(eventId, user.userId),
    };
  }

  @Post(':id/rsvp')
  @HttpCode(200)
  @ZodResponse(EventRsvpResponseSchema)
  async rsvp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body(new ZodBody(RsvpEventSchema.omit({ eventId: true })))
    body: Omit<RsvpEventDto, 'eventId'>,
  ) {
    return this.service.rsvp(user.userId, { eventId, ...body });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
  ) {
    await this.service.deleteEvent(user.userId, eventId);
  }
}
