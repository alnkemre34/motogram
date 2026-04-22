import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PartyService } from './party.service';

// Spec 4.1 + 7.3.3 - Parti zombie uye temizligi + ENDED party soft delete gracing.
// 30 saniye'de bir: 60sn+ offline uyeleri otomatik party:member_left yapar.

@Injectable()
export class PartyCleanupService {
  private readonly logger = new Logger(PartyCleanupService.name);

  constructor(private readonly party: PartyService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweepZombies(): Promise<void> {
    try {
      const result = await this.party.sweepZombieMembers();
      if (result.removed > 0) {
        this.logger.log(`party_zombie_sweep removed=${result.removed}`);
      }
    } catch (err) {
      this.logger.error('party_zombie_sweep_failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
