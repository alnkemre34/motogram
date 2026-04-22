import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

/**
 * During SIGTERM, Nest runs shutdown hooks; we stop reporting ready so load balancers
 * drain the instance before sockets are closed.
 */
@Injectable()
export class ReadinessService implements OnApplicationShutdown {
  private readonly logger = new Logger(ReadinessService.name);
  private acceptingTraffic = true;

  isAcceptingTraffic(): boolean {
    return this.acceptingTraffic;
  }

  onApplicationShutdown(): void {
    this.acceptingTraffic = false;
    this.logger.log('readiness: no longer accepting traffic (shutdown)');
  }
}
