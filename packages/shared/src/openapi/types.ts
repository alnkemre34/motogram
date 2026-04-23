import type { ZodType } from 'zod';

export interface RouteRecord {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  requestBodySchema?: string;
  responseSchema?: string;
  responseStatus?: number;
  auth?: boolean;
  roles?: string[];
}

export type SchemaMap = Record<string, ZodType>;

