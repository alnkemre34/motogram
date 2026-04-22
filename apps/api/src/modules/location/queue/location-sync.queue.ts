import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocationSyncJobSchema, type LocationSyncJob } from '@motogram/shared';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { Job } from 'bullmq';

import { TypedQueue } from '../../../common/queue/typed-queue.factory';
import { MetricsService } from '../../metrics/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.service';
import type { Redis as RedisClient } from 'ioredis';
import { LocationService } from '../location.service';

// Spec 8.1.2 - Location Sync Kuyrugu
// - location-sync: exponential backoff 1s->16s, max 5 attempt
// - 5 deneme sonrasi: location-dead-letter (DLQ) -> Admin gozlemi
// - Idempotent insert LocationService.persistPing icinde (Spec 8.1.2)

export const LOCATION_SYNC_QUEUE = 'location-sync';
export const LOCATION_DLQ = 'location-dead-letter';

export type { LocationSyncJob };

@Injectable()
export class LocationSyncQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocationSyncQueue.name);
  private queue!: Queue<LocationSyncJob>;
  private deadLetterQueue!: Queue<LocationSyncJob>;
  private typed!: TypedQueue<typeof LocationSyncJobSchema>;
  private worker?: Worker<LocationSyncJob>;
  private events?: QueueEvents;

  constructor(
    private readonly config: ConfigService,
    private readonly location: LocationService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly metrics: MetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = this.redis.options;
    this.queue = new Queue<LocationSyncJob>(LOCATION_SYNC_QUEUE, { connection });
    this.deadLetterQueue = new Queue<LocationSyncJob>(LOCATION_DLQ, { connection });
    this.typed = new TypedQueue(this.queue, LocationSyncJobSchema, LOCATION_SYNC_QUEUE);
    this.metrics.registerBullQueues([this.queue, this.deadLetterQueue]);

    const disableWorker =
      this.config.get<string>('NODE_ENV') === 'test' ||
      this.config.get<boolean>('DISABLE_BULLMQ_WORKER') === true;

    if (disableWorker) {
      return;
    }

    this.worker = new Worker<LocationSyncJob>(
      LOCATION_SYNC_QUEUE,
      (job) => this.processJob(job),
      {
        connection,
        concurrency: 4,
      },
    );

    this.worker.on('completed', (job) => {
      const finished = job.finishedOn && job.processedOn ? (job.finishedOn - job.processedOn) / 1000 : 0;
      this.metrics.bullmqJobDuration.observe(
        { queue: LOCATION_SYNC_QUEUE, job_name: job.name },
        finished,
      );
      this.metrics.bullmqJobsCompleted.inc({ queue: LOCATION_SYNC_QUEUE });
    });

    this.events = new QueueEvents(LOCATION_SYNC_QUEUE, { connection });
    this.events.on('failed', async ({ jobId, failedReason }) => {
      const job = await this.queue.getJob(jobId);
      if (!job) return;
      if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 0)) {
        this.logger.error(`location_sync_dlq jobId=${jobId} reason=${failedReason}`);
        this.metrics.bullmqJobsFailed.inc({ queue: LOCATION_SYNC_QUEUE, reason: 'exhausted' });
        await this.deadLetterQueue.add('dead', job.data, {
          removeOnComplete: true,
          removeOnFail: false,
        });
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.worker?.close(),
      this.events?.close(),
      this.queue?.close(),
      this.deadLetterQueue?.close(),
    ]);
  }

  /**
   * Spec 8.1.2 - Exponential backoff 1-2-4-8-16sn, max 5 attempt.
   */
  async enqueuePing(data: LocationSyncJob): Promise<void> {
    await this.typed.add('ping', data, {
      jobId: `ping:${data.userId}:${data.timestamp}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 3_600, count: 1_000 },
      removeOnFail: { age: 86_400 },
    });
  }

  private async processJob(job: Job<LocationSyncJob>): Promise<'inserted' | 'skipped'> {
    const parsed = LocationSyncJobSchema.parse(job.data);
    const { userId, sessionId, lat, lng, heading, speed, accuracy, batteryLevel, timestamp } =
      parsed;
    const session = await this.prisma.liveLocationSession.findUnique({
      where: { id: sessionId },
      select: { id: true, isActive: true },
    });
    if (!session) {
      throw new Error(`session_missing:${sessionId}`);
    }
    return this.location.persistPing({
      sessionId,
      userId,
      lat,
      lng,
      heading,
      speed,
      accuracy,
      batteryLevel,
      timestamp: new Date(timestamp),
    });
  }
}
