import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { AppModule } from '../src/app.module';
import { collectRouteRecords } from '../src/openapi/reflector';

async function main(): Promise<void> {
  process.env.OPENAPI_GENERATE = '1';

  const ctx = await NestFactory.createApplicationContext(AppModule.forOpenApi(), {
    abortOnError: false,
    logger: false,
  });

  try {
    const routes = collectRouteRecords(ctx);
    const outPath = resolve(__dirname, '../../../packages/shared/openapi/routes.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(routes, null, 2) + '\n', 'utf8');
  } finally {
    await ctx.close();
  }
}

void main();

