import type { CreateConversationDto, SendMessageDto } from '@motogram/shared';
import {
  ConversationDetailSchema,
  ConversationsListResponseSchema,
  MessageDtoResponseSchema,
  MessageListPageResponseSchema,
  MessageReactHttpResponseSchema,
  MessageSendResponseSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 2.5 - REST: DM/group conversations + mesaj listesi (pagination)

export async function listConversations() {
  return apiRequest('/conversations', ConversationsListResponseSchema);
}

export async function createConversation(dto: CreateConversationDto) {
  return apiRequest('/conversations', ConversationDetailSchema, { method: 'POST', body: dto });
}

export async function getConversation(id: string) {
  return apiRequest(`/conversations/${id}`, ConversationDetailSchema);
}

export async function listMessages(
  conversationId: string,
  opts: { cursor?: string; limit?: number } = {},
) {
  const q = new URLSearchParams();
  if (opts.cursor) q.set('cursor', opts.cursor);
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return apiRequest(
    `/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`,
    MessageListPageResponseSchema,
  );
}

export async function sendMessageRest(
  conversationId: string,
  body: Omit<SendMessageDto, 'conversationId'>,
) {
  return apiRequest(`/conversations/${conversationId}/messages`, MessageSendResponseSchema, {
    method: 'POST',
    body,
  });
}

export async function markConversationRead(
  conversationId: string,
  lastReadAt?: Date,
): Promise<void> {
  await apiRequest<void>(`/conversations/${conversationId}/read`, {
    method: 'POST',
    body: { lastReadAt: lastReadAt?.toISOString() },
  });
}

export async function reactMessageRest(messageId: string, emoji: string, remove = false) {
  return apiRequest(`/messages/${messageId}/react`, MessageReactHttpResponseSchema, {
    method: 'POST',
    body: { emoji, remove },
  });
}

export async function deleteMessage(messageId: string) {
  return apiRequest(`/messages/${messageId}`, MessageDtoResponseSchema, { method: 'DELETE' });
}
