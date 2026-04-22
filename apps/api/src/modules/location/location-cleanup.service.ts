import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { LocationService } from './location.service';

// Spec 5.2 + 7.3.3 - Zombie cleanup + 7-day LocationPing purge
@Injectable()
export class LocationCleanupService {
  private readonly logger = new Logger(LocationCleanupService.name);

  constructor(private readonly location: LocationService) {}

  // Spec 7.3.3 - Her dakika 5dk+ pasif kullanicilari ZREM
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepZombies(): Promise<void> {
    try {
      const result = await this.location.sweepZombies();
      if (result.removed > 0) {
        this.logger.log(
          `cron_zombie_sweep removed=${result.removed} scanned=${result.scanned} shards=${result.shardsChecked}`,
        );
      }
    } catch (err) {
      this.logger.error('cron_zombie_sweep_failed', err instanceof Error ? err.stack : String(err));
    }
  }

  // Spec 5.2 - Her gece 03:30'da 7 gunden eski LocationPing'leri sil (GDPR)
  @Cron('30 3 * * *')
  async purgeOldPings(): Promise<void> {
    try {
      const count = await this.location.purgeOldPings();
      if (count > 0) this.logger.log(`cron_pings_purged count=${count}`);
    } catch (err) {
      this.logger.error('cron_pings_purge_failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
