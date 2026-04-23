import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaProcessJobData } from '@motogram/shared';
import { MediaProcessJobDataSchema } from '@motogram/shared';
import { Queue, Worker } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';

import { TypedQueue } from '../../common/queue/typed-queue.factory';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_CLIENT } from '../redis/redis.service';
import {
  MEDIA_QUEUE_NAME,
  MEDIA_WORKER_CONCURRENCY,
  VIDEO_QUEUE_NAME,
} from './media.constants';

// Spec 7.3.4 - media-processing kuyrugu, concurrency 2.
// Video icin video-processing (dusuk oncelik); Faz 5 sadece poster thumbnail.

export type MediaProcessor = (data: MediaProcessJobData) => Promise<void>;

@Injectable()
export class MediaQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaQueue.name);
  private imageQueue!: Queue<MediaProcessJobData>;
  private videoQueue!: Queue<MediaProcessJobData>;
  private imageTyped!: TypedQueue<typeof MediaProcessJobDataSchema>;
  private videoTyped!: TypedQueue<typeof MediaProcessJobDataSchema>;
  private imageWorker?: Worker<MediaProcessJobData>;
  private processor: MediaProcessor | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly metrics: MetricsService,
  ) {}

  // Spec 3.4.2 - MediaService kendini bu kuyruga baglar (circular dep olmasin diye).
  registerProcessor(processor: MediaProcessor): void {
    this.processor = processor;
  }

  async onModuleInit(): Promise<void> {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    const connection = this.redis.options;
    this.imageQueue = new Queue<MediaProcessJobData>(MEDIA_QUEUE_NAME, { connection });
    this.videoQueue = new Queue<MediaProcessJobData>(VIDEO_QUEUE_NAME, { connection });
    this.imageTyped = new TypedQueue(this.imageQueue, MediaProcessJobDataSchema, MEDIA_QUEUE_NAME);
    this.videoTyped = new TypedQueue(this.videoQueue, MediaProcessJobDataSchema, VIDEO_QUEUE_NAME);
    this.metrics.registerBullQueues([this.imageQueue, this.videoQueue]);

    const e2eMediaWorker = this.config.get<string>('E2E_MEDIA_WORKER') === '1';
    const disableWorker =
      (this.config.get<string>('NODE_ENV') === 'test' && !e2eMediaWorker) ||
      this.config.get<boolean>('DISABLE_BULLMQ_WORKER') === true;

    if (disableWorker) {
      return;
    }

    this.imageWorker = new Worker<MediaProcessJobData>(
      MEDIA_QUEUE_NAME,
      async (job) => {
        if (!this.processor) {
          throw new Error('media_processor_not_registered');
        }
        const data = MediaProcessJobDataSchema.parse(job.data);
        await this.processor(data);
      },
      {
        connection,
        concurrency: MEDIA_WORKER_CONCURRENCY, // Spec 7.3.4 concurrency 2
      },
    );
    this.imageWorker.on('failed', (job, err) => {
      this.logger.warn(`media_job_failed jobId=${job?.id} err=${err.message}`);
    });
    this.imageWorker.on('completed', () => {
      this.metrics.bullmqJobsCompleted.inc({ queue: MEDIA_QUEUE_NAME });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.imageWorker?.close(),
      this.imageQueue?.close(),
      this.videoQueue?.close(),
    ]);
  }

  async enqueueImage(data: MediaProcessJobData): Promise<void> {
    await this.imageTyped.add('process', data, {
      jobId: `media:${data.assetId}:image`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: { age: 300, count: 1000 },
      removeOnFail: { age: 3600 * 24 },
    });
  }

  async enqueueVideo(data: MediaProcessJobData): Promise<void> {
    await this.videoTyped.add('hls', data, {
      jobId: `media:${data.assetId}:video`,
      attempts: 2,
      priority: 10,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 600, count: 500 },
      removeOnFail: { age: 3600 * 24 },
    });
  }
}
