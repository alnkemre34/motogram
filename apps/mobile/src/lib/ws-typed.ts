import type { WsEventName } from '@motogram/shared';
import { WS_INBOUND_SCHEMAS } from '@motogram/shared';
import type { Socket } from 'socket.io-client';
import type { ZodTypeAny } from 'zod';
import type { z } from 'zod';

import { parseResponseWithSchema } from './api-client';

/**
 * Client -> sunucu: payload `WS_INBOUND_SCHEMAS` ile doğrulanır (`strictSchema` ile api-client aynı davranış).
 * Şeması olmayan olaylar ham gönderilir (geliştirme konsolunda uyarı).
 */
export function wsEmitClient(
  socket: Socket,
  event: WsEventName,
  payload: unknown,
  ack?: (response: unknown) => void,
): void {
  const schema = WS_INBOUND_SCHEMAS[event];
  const data = schema ? parseResponseWithSchema(payload, schema) : payload;
  if (!schema && typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[ws] emitClient: WS_INBOUND_SCHEMAS missing for', event);
  }
  if (ack) {
    socket.emit(event, data, ack);
  } else {
    socket.emit(event, data);
  }
}

/**
 * Sunucu -> istemci: gelen gövde `schema` ile doğrulanır (warn-only / strict api-client ile uyumlu).
 */
export function wsOnServerParsed<S extends ZodTypeAny>(
  socket: Socket,
  event: WsEventName,
  schema: S,
  handler: (data: z.infer<S>) => void,
): () => void {
  const wrapped = (raw: unknown) => {
    const data = parseResponseWithSchema(raw, schema);
    handler(data);
  };
  socket.on(event, wrapped);
  return () => {
    socket.off(event, wrapped);
  };
}
