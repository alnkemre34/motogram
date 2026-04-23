import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AuthLoginSuccessEventSchema,
  ErrorCodes,
  type AccountDeletionStatusDto,
  type RequestAccountDeletionDto,
} from '@motogram/shared';

import { AUTH_LOGIN_EVENT } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

import { DeletionQueue } from './deletion.queue';

// Spec 5.2 + 7.2.1 + 8.11.4 - Hesap silme: 30 gun bekleme + sonra fiziksel imha.
// Kullanici herhangi bir anda cancel ile geri donebilir; login de cancel gibi
// davranir (AuthService tarafindan cagrilir).

const DELETION_GRACE_DAYS = 30;

@Injectable()
export class AccountService implements OnModuleInit {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: DeletionQueue,
  ) {}

  @OnEvent(AUTH_LOGIN_EVENT, { async: true, promisify: true })
  async onAuthLogin(raw: unknown): Promise<void> {
    const parsed = AuthLoginSuccessEventSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn(`on_auth_login_invalid_payload err=${parsed.error.message}`);
      return;
    }
    const payload = parsed.data;
    try {
      await this.cancelDeletionOnLogin(payload.userId);
    } catch (err) {
      // Login akisini bozmamak icin icten handle et.
      this.logger.warn(
        `on_auth_login_cancel_failed user=${payload.userId} err=${(err as Error).message}`,
      );
    }
  }

  onModuleInit(): void {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    // Spec 7.2.1 - DELETE_USER_DATA BullMQ worker processor'u bagla.
    this.queue.registerProcessor(async (data) => {
      const rec = await this.prisma.accountDeletion.findUnique({
        where: { userId: data.userId },
      });
      if (!rec || rec.cancelledAt) {
        this.logger.log(`deletion_job_noop user=${data.userId} (cancelled)`);
        return;
      }
      if (rec.executedAt) {
        return;
      }
      // RetentionWorker zaten batch isliyor; burada tek kullaniciyi isle.
      await this.executeSingleDeletion(data.userId);
    });
  }

  async requestDeletion(userId: string, dto: RequestAccountDeletionDto): Promise<AccountDeletionStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, accountDeletion: true },
    });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (user.accountDeletion && !user.accountDeletion.executedAt && !user.accountDeletion.cancelledAt) {
      return this.toStatus(user.accountDeletion);
    }

    const now = new Date();
    const scheduledFor = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 3600 * 1000);

    const record = await this.prisma.$transaction(async (tx) => {
      // Soft delete - kullanici tum uyelik alanlari deaktif edilir
      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: now },
      });
      return tx.accountDeletion.upsert({
        where: { userId },
        create: {
          userId,
          requestedAt: now,
          scheduledFor,
          reason: dto.reason ?? null,
        },
        update: {
          requestedAt: now,
          scheduledFor,
          reason: dto.reason ?? null,
          cancelledAt: null,
          executedAt: null,
        },
      });
    });

    // Spec 7.2.1 - BullMQ DELETE_USER_DATA kuyruguna delayed is ekle.
    try {
      const delayMs = scheduledFor.getTime() - now.getTime();
      const jobId = await this.queue.enqueueDelayed(
        { userId, scheduledFor: scheduledFor.toISOString(), reason: dto.reason ?? null },
        delayMs,
      );
      if (jobId) {
        await this.prisma.accountDeletion.update({
          where: { userId },
          data: { jobId },
        });
      }
    } catch (err) {
      // Queue arizasi olsa bile RetentionWorker batch cron idempotent sekilde
      // islemi yapar (Spec 7.2.1 safety net).
      this.logger.warn(
        `deletion_queue_enqueue_failed user=${userId} err=${(err as Error).message}`,
      );
    }

    this.logger.log(`account_deletion_scheduled user=${userId} at=${scheduledFor.toISOString()}`);
    return this.toStatus(record);
  }

  // Spec 7.2.1 - Kullanici 30 gun pencere icinde tekrar giris yaparsa silme
  // iptal edilir. AuthService.login tarafindan cagrilir (hem bcrypt hem DEV_OTP
  // basarili oldugunda).
  async cancelDeletionOnLogin(userId: string): Promise<boolean> {
    const record = await this.prisma.accountDeletion.findUnique({ where: { userId } });
    if (!record || record.executedAt || record.cancelledAt) {
      return false;
    }
    // Soft delete flag'i kaldir, BullMQ isini kaldir.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { deletedAt: null } });
      await tx.accountDeletion.update({
        where: { userId },
        data: { cancelledAt: new Date() },
      });
    });
    if (record.jobId) {
      try {
        await this.queue.cancelByJobId(record.jobId);
      } catch (err) {
        this.logger.warn(
          `deletion_queue_cancel_failed user=${userId} err=${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`account_deletion_cancelled_on_login user=${userId}`);
    return true;
  }

  async cancelDeletion(userId: string): Promise<AccountDeletionStatusDto> {
    const record = await this.prisma.accountDeletion.findUnique({ where: { userId } });
    if (!record || record.executedAt) {
      throw new BadRequestException({
        error: 'no_active_deletion',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    if (record.cancelledAt) {
      return this.toStatus(record);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { deletedAt: null } });
      return tx.accountDeletion.update({
        where: { userId },
        data: { cancelledAt: new Date() },
      });
    });
    if (record.jobId) {
      try {
        await this.queue.cancelByJobId(record.jobId);
      } catch (err) {
        this.logger.warn(
          `deletion_queue_cancel_failed user=${userId} err=${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`account_deletion_cancelled user=${userId}`);
    return this.toStatus(updated);
  }

  private async executeSingleDeletion(userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: userId } });
      });
      this.logger.log(`account_deletion_executed_via_queue user=${userId}`);
    } catch (err) {
      this.logger.error(
        `account_deletion_queue_exec_failed user=${userId} err=${(err as Error).message}`,
      );
      throw err;
    }
  }

  async getStatus(userId: string): Promise<AccountDeletionStatusDto> {
    const record = await this.prisma.accountDeletion.findUnique({ where: { userId } });
    return this.toStatus(record);
  }

  // Cron tarafindan cagirilir (retention.worker.ts)
  async executeDeletions(now: Date = new Date()): Promise<{ processed: number; errors: number }> {
    const pending = await this.prisma.accountDeletion.findMany({
      where: {
        scheduledFor: { lte: now },
        executedAt: null,
        cancelledAt: null,
      },
      take: 50,
    });
    let processed = 0;
    let errors = 0;
    for (const rec of pending) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // onDelete: Cascade iliski etiketli tum data otomatik silinir.
          await tx.user.delete({ where: { id: rec.userId } });
          // NOTE: AccountDeletion user ile birlikte cascade silinecegi icin ayrica
          // update etmemize gerek yok; ama log icin loglayalim.
        });
        processed += 1;
        this.logger.log(`account_deletion_executed user=${rec.userId}`);
      } catch (err) {
        errors += 1;
        this.logger.error(
          `account_deletion_failed user=${rec.userId} err=${(err as Error).message}`,
        );
      }
    }
    return { processed, errors };
  }

  private toStatus(
    record:
      | {
          requestedAt: Date;
          scheduledFor: Date;
          cancelledAt: Date | null;
          executedAt: Date | null;
        }
      | null,
  ): AccountDeletionStatusDto {
    if (!record || record.cancelledAt || record.executedAt) {
      return {
        pending: false,
        requestedAt: null,
        scheduledFor: null,
        daysRemaining: null,
      };
    }
    const now = Date.now();
    const remainingMs = record.scheduledFor.getTime() - now;
    return {
      pending: true,
      requestedAt: record.requestedAt.toISOString(),
      scheduledFor: record.scheduledFor.toISOString(),
      daysRemaining: Math.max(0, Math.ceil(remainingMs / (24 * 3600 * 1000))),
    };
  }
}
