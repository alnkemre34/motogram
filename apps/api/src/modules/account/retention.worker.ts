import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AccountService } from './account.service';

// Spec 5.2 - 30 gun sonra fiziksel hesap silme.
// Her saat basi calisir; zamani gecmis tum hesaplari siler (batch 50).

@Injectable()
export class RetentionWorker {
  private readonly logger = new Logger(RetentionWorker.name);

  constructor(private readonly service: AccountService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runHourly(): Promise<void> {
    const start = Date.now();
    const { processed, errors } = await this.service.executeDeletions();
    if (processed > 0 || errors > 0) {
      this.logger.log(
        `retention_worker_tick processed=${processed} errors=${errors} ms=${Date.now() - start}`,
      );
    }
  }
}
