import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import stableStringify from 'json-stable-stringify';
import { z } from 'zod';
import * as Shared from '@motogram/shared';
import type { OpenAPIObject } from 'openapi3-ts/oas31';

import { generateOpenApi, type RouteRecord, type SchemaMap } from '@motogram/shared';

import { renderApiContractMd } from './write-api-contract';

function readRootPackageVersion(): string {
  const rootPkgPath = resolve(__dirname, '../../../package.json');
  const raw = readFileSync(rootPkgPath, 'utf8');
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? '0.0.0';
}

function loadRoutes(): RouteRecord[] {
  const routesPath = resolve(__dirname, '../../../packages/shared/openapi/routes.json');
  const raw = readFileSync(routesPath, 'utf8');
  return JSON.parse(raw) as RouteRecord[];
}

function collectSchemas(): SchemaMap {
  const schemas: SchemaMap = {};
  for (const [key, value] of Object.entries(Shared)) {
    if (!value) continue;
    // Skip WebSocket schema surfaces from OpenAPI (out of scope).
    if (key.toLowerCase().includes('socket')) continue;
    if (value instanceof z.ZodType) {
      schemas[key] = value;
    }
  }
  return schemas;
}

function writeFileEnsured(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

async function main(): Promise<void> {
  const routes = loadRoutes();
  const schemas = collectSchemas();

  const doc: OpenAPIObject = generateOpenApi(schemas, routes);
  doc.info.version = readRootPackageVersion();

  const openapiPath = resolve(__dirname, '../../../docs/openapi.json');
  const openapiText = stableStringify(doc, { space: 2 }) + '\n';
  writeFileEnsured(openapiPath, openapiText);

  const contractPath = resolve(__dirname, '../../../docs/API_Contract.md');
  const md = renderApiContractMd(doc, routes, openapiText);
  writeFileEnsured(contractPath, md);
}

void main();

