// B-16 — BullMQ: OTP SMS (dev’de düz kod log; prod’da SMS sağlayıcı stub).
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpSmsJobSchema, type OtpSmsJob } from '@motogram/shared';
import { Queue, Worker } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';

import { TypedQueue } from '../../common/queue/typed-queue.factory';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_CLIENT } from '../redis/redis.service';

export const OTP_SMS_QUEUE = 'AUTH_OTP_SMS';

@Injectable()
export class OtpSmsQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OtpSmsQueue.name);
  private queue?: Queue<OtpSmsJob>;
  private typed?: TypedQueue<typeof OtpSmsJobSchema>;
  private worker?: Worker<OtpSmsJob>;

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
    this.queue = new Queue<OtpSmsJob>(OTP_SMS_QUEUE, { connection });
    this.typed = new TypedQueue(this.queue, OtpSmsJobSchema, OTP_SMS_QUEUE);
    this.metrics.registerBullQueues([this.queue]);

    const disableWorker =
      this.config.get<string>('NODE_ENV') === 'test' ||
      this.config.get<boolean>('DISABLE_BULLMQ_WORKER') === true;

    if (disableWorker) {
      return;
    }

    this.worker = new Worker<OtpSmsJob>(
      OTP_SMS_QUEUE,
      async (job) => {
        const data = OtpSmsJobSchema.parse(job.data);
        if (this.config.get<string>('NODE_ENV') === 'production') {
          this.logger.log(`otp_sms_stub phone=${this.redact(data.phone)} (SMS provider TBD)`);
        } else {
          this.logger.warn(`otp_sms_dev phone=${data.phone} code=${data.code}`);
        }
      },
      { connection, concurrency: 4 },
    );
    this.worker.on('completed', () => {
      this.metrics.bullmqJobsCompleted.inc({ queue: OTP_SMS_QUEUE });
    });
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`otp_sms_failed jobId=${job?.id} err=${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }

  async enqueue(data: OtpSmsJob): Promise<void> {
    if (!this.queue || !this.typed) {
      return;
    }
    await this.typed.add('send_otp_sms', data, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 24 * 3600 },
    });
  }

  private redact(phone: string): string {
    if (phone.length < 6) return '***';
    return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
  }
}
