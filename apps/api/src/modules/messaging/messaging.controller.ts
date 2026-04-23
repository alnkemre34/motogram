import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ConversationDetailSchema,
  ConversationsListResponseSchema,
  CreateConversationSchema,
  ErrorCodes,
  ListConversationsQuerySchema,
  MarkReadSchema,
  MessageDtoResponseSchema,
  MessageListPageResponseSchema,
  MessageReactHttpResponseSchema,
  MessageSendResponseSchema,
  ReactMessageSchema,
  SendMessageSchema,
  type CreateConversationDto,
  type ListConversationsQueryDto,
  type ReactMessageDto,
} from '@motogram/shared';
import { ZodError } from 'zod';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';

// Spec 2.5 / 3.5 / 8.7.1 - REST: /v1/conversations + /v1/messages
// WebSocket birincil kanal; REST offline/fallback ve pagination.

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
  ) {}

  @Post('conversations')
  @HttpCode(200)
  @ZodResponse(ConversationDetailSchema)
  async createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateConversationSchema)) dto: CreateConversationDto,
  ) {
    return this.conversations.createConversation(user.userId, dto);
  }

  @Get('conversations')
  @ZodResponse(ConversationsListResponseSchema)
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, string>,
  ) {
    const parsed = ListConversationsQuerySchema.safeParse({
      type: rawQuery.type,
    });
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'validation_failed',
        code: ErrorCodes.VALIDATION_FAILED,
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      });
    }
    const query: ListConversationsQueryDto = parsed.data;
    return {
      conversations: await this.conversations.listMyConversations(user.userId, query),
    };
  }

  @Get('conversations/:id')
  @ZodResponse(ConversationDetailSchema)
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
  ) {
    return this.conversations.getDetail(conversationId, user.userId);
  }

  @Get('conversations/:id/messages')
  @ZodResponse(MessageListPageResponseSchema)
  async listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Math.max(1, Math.min(100, Number(limitRaw))) : 30;
    return this.messages.listMessages(user.userId, conversationId, cursor ?? null, limit);
  }

  // Spec 8.7.1 - mesaj dakikada 60
  @Post('conversations/:id/messages')
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ZodResponse(MessageSendResponseSchema)
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Body() body: Record<string, unknown>,
  ) {
    // SendMessageSchema superRefine iceriyor -> ZodEffects; omit yapamiyoruz.
    // Bu yuzden conversationId'yi enjekte edip tam sema ile parse ediyoruz.
    const parsed = this.parse(SendMessageSchema, { ...(body ?? {}), conversationId });
    const result = await this.messages.send(user.userId, parsed);
    return { message: result.message, duplicate: result.duplicate };
  }

  @Post('conversations/:id/read')
  @HttpCode(204)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = this.parse(MarkReadSchema, { ...(body ?? {}), conversationId });
    await this.conversations.markRead(user.userId, parsed);
  }

  @Post('messages/:id/react')
  @HttpCode(200)
  @ZodResponse(MessageReactHttpResponseSchema)
  async react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') messageId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = this.parse(ReactMessageSchema, { ...(body ?? {}), messageId }) as ReactMessageDto;
    const { reaction, removed } = await this.messages.react(user.userId, parsed);
    return { reaction, removed };
  }

  private parse<T>(schema: { parse: (v: unknown) => T }, value: unknown): T {
    try {
      return schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          error: 'validation_failed',
          code: ErrorCodes.VALIDATION_FAILED,
          details: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
            code: i.code,
          })),
        });
      }
      throw err;
    }
  }

  @Delete('messages/:id')
  @ZodResponse(MessageDtoResponseSchema)
  async softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') messageId: string,
  ) {
    return this.messages.softDelete(user.userId, messageId);
  }
}
