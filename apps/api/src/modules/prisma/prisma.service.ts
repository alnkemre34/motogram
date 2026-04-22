import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

import { MetricsService } from '../metrics/metrics.service';

function withStatementTimeout(databaseUrl: string, timeoutMs: number): string {
  if (!timeoutMs || timeoutMs <= 0) return databaseUrl;
  try {
    const normalized = databaseUrl.startsWith('postgres://')
      ? `postgresql://${databaseUrl.slice('postgres://'.length)}`
      : databaseUrl;
    const u = new URL(normalized);
    const existing = u.searchParams.get('options') ?? '';
    if (existing.includes('statement_timeout=')) return databaseUrl;
    const addition = existing
      ? `${existing} -c statement_timeout=${timeoutMs}`
      : `-c statement_timeout=${timeoutMs}`;
    u.searchParams.set('options', addition);
    let out = u.toString();
    if (databaseUrl.startsWith('postgres://')) {
      out = `postgres://${out.slice('postgresql://'.length)}`;
    }
    return out;
  } catch {
    const joiner = databaseUrl.includes('?') ? '&' : '?';
    return `${databaseUrl}${joiner}options=${encodeURIComponent(`-c statement_timeout=${timeoutMs}`)}`;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    config: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {
    const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
    const rawTimeout = config.get<string | number>('DATABASE_STATEMENT_TIMEOUT_MS');
    const timeoutMs =
      typeof rawTimeout === 'number'
        ? rawTimeout
        : Number.parseInt(String(rawTimeout ?? '10000'), 10) || 10_000;
    super({
      datasources: {
        db: { url: withStatementTimeout(databaseUrl, timeoutMs) },
      },
      log: [{ emit: 'event', level: 'query' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    if (this.metrics) {
      // PrismaClient genericinde `query` event tipi bazen `never` cikabiliyor; runtime'da log seviyesi yeterli.
      const client = this as unknown as {
        $on: (event: 'query', cb: (e: { query: string; duration: number }) => void) => void;
      };
      client.$on('query', (e) => {
        const trimmed = e.query.trim();
        const op = /^[a-z]+/i.exec(trimmed)?.[0]?.toUpperCase() ?? 'QUERY';
        this.metrics!.dbQueryDuration.observe({ operation: op }, e.duration / 1000);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
