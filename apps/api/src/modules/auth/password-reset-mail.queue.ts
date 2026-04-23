// B-05 — BullMQ: şifre sıfırlama e-postası (worker dev’de tam link loglar; prod’da SMTP stub).
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetEmailJobSchema, type PasswordResetEmailJob } from '@motogram/shared';
import { Queue, Worker } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';

import { TypedQueue } from '../../common/queue/typed-queue.factory';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_CLIENT } from '../redis/redis.service';

export const PASSWORD_RESET_MAIL_QUEUE = 'AUTH_PASSWORD_RESET_MAIL';

@Injectable()
export class PasswordResetMailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PasswordResetMailQueue.name);
  private queue?: Queue<PasswordResetEmailJob>;
  private typed?: TypedQueue<typeof PasswordResetEmailJobSchema>;
  private worker?: Worker<PasswordResetEmailJob>;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly metrics: MetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    const connection = this.redis.options;
    this.queue = new Queue<PasswordResetEmailJob>(PASSWORD_RESET_MAIL_QUEUE, { connection });
    this.typed = new TypedQueue(this.queue, PasswordResetEmailJobSchema, PASSWORD_RESET_MAIL_QUEUE);
    this.metrics.registerBullQueues([this.queue]);

    const disableWorker =
      this.config.get<string>('NODE_ENV') === 'test' ||
      this.config.get<boolean>('DISABLE_BULLMQ_WORKER') === true;

    if (disableWorker) {
      return;
    }

    const baseUrl = this.config.get<string>('APP_PUBLIC_URL', 'https://motogram.app').replace(/\/$/, '');

    this.worker = new Worker<PasswordResetEmailJob>(
      PASSWORD_RESET_MAIL_QUEUE,
      async (job) => {
        const data = PasswordResetEmailJobSchema.parse(job.data);
        const link = `${baseUrl}/reset-password?token=${encodeURIComponent(data.resetToken)}`;
        if (this.config.get<string>('NODE_ENV') === 'production') {
          this.logger.log(`password_reset_mail to=${this.redact(data.email)} (SMTP stub — link üretildi)`);
        } else {
          this.logger.warn(`password_reset_mail_dev to=${data.email} link=${link}`);
        }
      },
      { connection, concurrency: 4 },
    );
    this.worker.on('completed', () => {
      this.metrics.bullmqJobsCompleted.inc({ queue: PASSWORD_RESET_MAIL_QUEUE });
    });
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`password_reset_mail_failed jobId=${job?.id} err=${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async enqueue(data: PasswordResetEmailJob): Promise<void> {
    if (!this.queue || !this.typed) {
      return;
    }
    await this.typed.add(
      'send_reset_email',
      data,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    );
  }

  private redact(email: string): string {
    const [u, d] = email.split('@');
    if (!d || !u) return '***';
    return `${u.slice(0, 2)}***@${d}`;
  }
}
