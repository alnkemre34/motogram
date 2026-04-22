import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory, Reflector } from '@nestjs/core';

import { AppModule } from './app.module';
import { initServerIdentity } from './common/config/server-identity';
import { loadEnv } from './common/config/env.schema';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ZodSerializerInterceptor } from './common/interceptors/zod-serializer.interceptor';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { MetricsService } from './modules/metrics/metrics.service';

/** Fail-fast before Nest boots (see env.schema.ts). */
const env = loadEnv();
initServerIdentity(env);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Spec 8.10.1 - yapilandirilmis JSON log (production'da logger swap edilir)
    logger: ['log', 'warn', 'error', 'debug'],
    bufferLogs: true,
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const origins = env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
  });

  // Spec 8.11.3 - API surumlendirme /v1/
  app.setGlobalPrefix('v1');

  // Spec 9.4 - Standart hata yaniti { error, code }
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Spec 7.3.6 - Zod tabanli dogrulama (packages/shared'dan gelen semalar)
  app.useGlobalPipes(new ZodValidationPipe());

  app.enableShutdownHooks();

  const metrics = app.get(MetricsService);
  app.useGlobalInterceptors(
    new ZodSerializerInterceptor(app.get(Reflector), env.ZOD_RESPONSE_STRICT, metrics),
  );

  const httpServer = app.getHttpAdapter().getInstance() as {
    keepAliveTimeout?: number;
    headersTimeout?: number;
  };
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 70_000;

  await app.listen(env.API_PORT);
  // eslint-disable-next-line no-console
  console.log(`[motogram-api] listening on :${env.API_PORT}`);
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[motogram-api] bootstrap failed', err);
  process.exit(1);
});
