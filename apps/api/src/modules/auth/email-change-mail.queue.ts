// B-07 — BullMQ: e-posta değişimi doğrulama linki (mevcut adrese; dev’de log).
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailChangeMailJobSchema, type EmailChangeMailJob } from '@motogram/shared';
import { Queue, Worker } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';

import { TypedQueue } from '../../common/queue/typed-queue.factory';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_CLIENT } from '../redis/redis.service';

export const EMAIL_CHANGE_MAIL_QUEUE = 'AUTH_EMAIL_CHANGE_MAIL';

@Injectable()
export class EmailChangeMailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailChangeMailQueue.name);
  private queue?: Queue<EmailChangeMailJob>;
  private typed?: TypedQueue<typeof EmailChangeMailJobSchema>;
  private worker?: Worker<EmailChangeMailJob>;

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
    this.queue = new Queue<EmailChangeMailJob>(EMAIL_CHANGE_MAIL_QUEUE, { connection });
    this.typed = new TypedQueue(this.queue, EmailChangeMailJobSchema, EMAIL_CHANGE_MAIL_QUEUE);
    this.metrics.registerBullQueues([this.queue]);

    const disableWorker =
      this.config.get<string>('NODE_ENV') === 'test' ||
      this.config.get<boolean>('DISABLE_BULLMQ_WORKER') === true;

    if (disableWorker) {
      return;
    }

    const baseUrl = this.config.get<string>('APP_PUBLIC_URL', 'https://motogram.app').replace(/\/$/, '');

    this.worker = new Worker<EmailChangeMailJob>(
      EMAIL_CHANGE_MAIL_QUEUE,
      async (job) => {
        const data = EmailChangeMailJobSchema.parse(job.data);
        const link = `${baseUrl}/verify-email-change?token=${encodeURIComponent(data.verifyToken)}`;
        if (this.config.get<string>('NODE_ENV') === 'production') {
          this.logger.log(
            `email_change_mail to=${this.redact(data.email)} new=${this.redact(data.newEmail)} (SMTP stub)`,
          );
        } else {
          this.logger.warn(
            `email_change_mail_dev to=${data.email} new=${data.newEmail} link=${link}`,
          );
        }
      },
      { connection, concurrency: 4 },
    );
    this.worker.on('completed', () => {
      this.metrics.bullmqJobsCompleted.inc({ queue: EMAIL_CHANGE_MAIL_QUEUE });
    });
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`email_change_mail_failed jobId=${job?.id} err=${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async enqueue(data: EmailChangeMailJob): Promise<void> {
    if (!this.queue || !this.typed) {
      return;
    }
    await this.typed.add(
      'send_email_change',
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
