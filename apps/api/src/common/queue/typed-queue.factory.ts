import { Logger } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import type { ZodSchema } from 'zod';
import type { z } from 'zod';

/**
 * BullMQ producer tarafinda job payload Zod dogrulamasi.
 */
export class TypedQueue<S extends ZodSchema> {
  private readonly logger = new Logger(TypedQueue.name);

  constructor(
    private readonly queue: Queue,
    private readonly schema: S,
    private readonly queueName: string,
  ) {}

  get raw(): Queue {
    return this.queue;
  }

  async add(jobName: string, data: z.infer<S>, opts?: JobsOptions) {
    const parsed = this.schema.safeParse(data);
    if (!parsed.success) {
      this.logger.error(
        `invalid_queue_payload queue=${this.queueName} job=${jobName}`,
        parsed.error.flatten(),
      );
      throw new Error('invalid_queue_payload');
    }
    return this.queue.add(jobName, parsed.data, opts);
  }
}
