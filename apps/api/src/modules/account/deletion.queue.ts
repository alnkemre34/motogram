// Spec 7.2.1 - BullMQ DELETE_USER_DATA kuyrugu
// Kullanici hesabini silince 30 gun sonrasina delayed is kuyruga eklenir.
// Ayni pencere icinde kullanici tekrar giris yaparsa is iptal edilir (jobId
// AccountDeletion kaydinda saklanir).
//
// Dikkat: BullMQ tek basina kayip olabilir (Redis uptime), dolayisiyla
// RetentionWorker da safety net olarak kalir ve scheduledFor <= now olan
// kayitlari tarar.
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountDeletionJobSchema, type AccountDeletionJob } from '@motogram/shared';
import { Queue, Worker } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';

import { TypedQueue } from '../../common/queue/typed-queue.factory';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_CLIENT } from '../redis/redis.service';

export const DELETION_QUEUE_NAME = 'DELETE_USER_DATA';

export type DeletionJobData = AccountDeletionJob;

export type DeletionProcessor = (data: DeletionJobData) => Promise<void>;

@Injectable()
export class DeletionQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeletionQueue.name);
  private queue!: Queue<DeletionJobData>;
  private typed!: TypedQueue<typeof AccountDeletionJobSchema>;
  private worker?: Worker<DeletionJobData>;
  private processor: DeletionProcessor | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly metrics: MetricsService,
  ) {}

  registerProcessor(processor: DeletionProcessor): void {
    this.processor = processor;
  }

  async onModuleInit(): Promise<void> {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    const connection = this.redis.options;
    this.queue = new Queue<DeletionJobData>(DELETION_QUEUE_NAME, { connection });
    this.typed = new TypedQueue(this.queue, AccountDeletionJobSchema, DELETION_QUEUE_NAME);
    this.metrics.registerBullQueues([this.queue]);

    const disableWorker =
      this.config.get<string>('NODE_ENV') === 'test' ||
      this.config.get<boolean>('DISABLE_BULLMQ_WORKER') === true;

    if (disableWorker) {
      return;
    }

    this.worker = new Worker<DeletionJobData>(
      DELETION_QUEUE_NAME,
      async (job) => {
        if (!this.processor) {
          throw new Error('deletion_processor_not_registered');
        }
        const data = AccountDeletionJobSchema.parse(job.data);
        await this.processor(data);
      },
      {
        connection,
        concurrency: 1, // hesap silme birer birer islensin
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`deletion_job_failed jobId=${job?.id} err=${err.message}`);
    });
    this.worker.on('completed', () => {
      this.metrics.bullmqJobsCompleted.inc({ queue: DELETION_QUEUE_NAME });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async enqueueDelayed(
    data: DeletionJobData,
    delayMs: number,
  ): Promise<string | undefined> {
    const job = await this.typed.add(
      'purge',
      data,
      {
        jobId: `deletion:${data.userId}:${data.scheduledFor}`,
        delay: Math.max(0, delayMs),
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 7 * 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    );
    return job.id ?? undefined;
  }

  async cancelByJobId(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;
    // Henuz processing/completed degilse kaldir.
    const state = await job.getState();
    if (state === 'completed' || state === 'failed' || state === 'active') {
      return false;
    }
    await job.remove();
    return true;
  }
}
