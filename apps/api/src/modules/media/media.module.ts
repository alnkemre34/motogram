import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MediaController } from './media.controller';
import { MediaQueue } from './media.queue';
import { MediaService } from './media.service';
import { MinioService } from './minio.client';
import { SharpProcessor } from './sharp.processor';

// Spec 3.4 - Medya pipeline modulu.

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [MediaController],
  providers: [MediaService, MinioService, SharpProcessor, MediaQueue],
  exports: [MediaService, MinioService, SharpProcessor, MediaQueue],
})
export class MediaModule {}
