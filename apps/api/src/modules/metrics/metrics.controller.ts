// Spec 8.10.2 - /metrics Prometheus scrape endpoint.
// Public (authless) ama Nginx reverse-proxy seviyesinde IP-whitelist onerilir
// (sadece Prometheus server'indan erisim).
import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';

import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metrics.contentType());
    const body = await this.metrics.render();
    res.send(body);
  }
}
