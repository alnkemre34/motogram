import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  BadgeDto,
  QuestCompletedDto,
  QuestProgressDto,
  ShowcaseUserBadgeDto,
  UserBadgeDto,
} from '@motogram/shared';
import { GamificationTriggerPayloadSchema } from '@motogram/shared';
import { QuestTrigger } from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

// Spec 3.6 + 3.7 - Gamification servisi.
// - triggerQuest: event emit'den tetiklenir. QuestProgress +1, hedefe gelince
//   Quest tamamlandi -> XP + Badge unlock + Notification.
// - Level formulu: level = floor(sqrt(xp / 50)) + 1. Basit, Spec referans yok.

export interface GamificationGatewayBridge {
  broadcastQuestCompleted(userId: string, dto: QuestCompletedDto, questName: string): void;
  broadcastBadgeEarned(userId: string, badge: BadgeDto): void;
}

function levelFor(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);
  private gateway: GamificationGatewayBridge | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  registerGateway(bridge: GamificationGatewayBridge): void {
    this.gateway = bridge;
  }

  // Spec 3.6 - EventEmitter dinleyicisi.
  @OnEvent('gamification.trigger', { async: true, promisify: true })
  async onTrigger(raw: unknown): Promise<void> {
    let payload: ReturnType<typeof GamificationTriggerPayloadSchema.parse>;
    try {
      payload = GamificationTriggerPayloadSchema.parse(raw);
    } catch (err) {
      this.logger.warn(`gamification_trigger_invalid_payload err=${(err as Error).message}`);
      return;
    }
    try {
      await this.triggerQuest(payload);
    } catch (err) {
      this.logger.warn(
        `gamification_trigger_failed userId=${payload.userId} trigger=${payload.trigger} err=${(err as Error).message}`,
      );
    }
  }

  async triggerQuest(payload: ReturnType<typeof GamificationTriggerPayloadSchema.parse>): Promise<QuestCompletedDto[]> {
    const increment = payload.increment ?? 1;
    const quests = await this.prisma.quest.findMany({
      where: { trigger: payload.trigger as QuestTrigger, isActive: true },
      include: { badge: true },
    });
    if (quests.length === 0) return [];

    const completed: QuestCompletedDto[] = [];

    for (const quest of quests) {
      // Reset logic (DAILY/WEEKLY) - repeatable questlerde progress sifirlanir.
      const existing = await this.prisma.questProgress.findUnique({
        where: { userId_questId: { userId: payload.userId, questId: quest.id } },
      });

      const now = new Date();
      let progress = (existing?.progress ?? 0) + increment;
      let resetAt = existing?.resetAt ?? null;

      if (existing && quest.repeatable && existing.resetAt && existing.resetAt <= now) {
        progress = increment;
        resetAt = nextResetAt(now, quest.resetPeriod);
      } else if (!existing && quest.repeatable) {
        resetAt = nextResetAt(now, quest.resetPeriod);
      }

      const wasAlreadyCompleted = existing?.completed && !quest.repeatable;
      if (wasAlreadyCompleted) continue;

      const completedNow = progress >= quest.targetValue;
      const updated = await this.prisma.questProgress.upsert({
        where: { userId_questId: { userId: payload.userId, questId: quest.id } },
        create: {
          userId: payload.userId,
          questId: quest.id,
          progress,
          completed: completedNow,
          completedAt: completedNow ? now : null,
          resetAt,
        },
        update: {
          progress,
          completed: completedNow,
          completedAt: completedNow ? now : existing?.completedAt ?? null,
          resetAt,
        },
      });

      if (!completedNow) continue;

      // XP + Badge unlock
      const user = await this.prisma.user.update({
        where: { id: payload.userId },
        data: { xp: { increment: quest.xpReward } },
        select: { xp: true, preferredLanguage: true },
      });
      const newLevel = levelFor(user.xp);
      await this.prisma.user.update({
        where: { id: payload.userId },
        data: { level: newLevel },
      });

      let unlockedBadge: BadgeDto | null = null;
      if (quest.badgeId) {
        const earned = await this.prisma.userBadge.upsert({
          where: {
            userId_badgeId: { userId: payload.userId, badgeId: quest.badgeId },
          },
          create: {
            userId: payload.userId,
            badgeId: quest.badgeId,
            source: quest.id,
          },
          update: {}, // zaten varsa hic bir sey yapma
          include: { badge: true },
        });
        unlockedBadge = this.toBadgeDto(earned.badge);
      }

      const completedDto: QuestCompletedDto = {
        questId: quest.id,
        questCode: quest.code,
        xpAwarded: quest.xpReward,
        newUserLevel: newLevel,
        newUserXp: user.xp,
        badgeUnlocked: unlockedBadge,
      };
      completed.push(completedDto);

      // Spec 3.7 - bildirim + push
      await this.notifications.create({
        userId: payload.userId,
        type: 'QUEST_COMPLETED',
        title: 'Gorev tamamlandi!',
        body: `${quest.name} gorevini tamamladin ve ${quest.xpReward} XP kazandin.`,
        data: { questId: quest.id, xp: quest.xpReward },
      });
      if (unlockedBadge) {
        await this.notifications.create({
          userId: payload.userId,
          type: 'BADGE_EARNED',
          title: 'Yeni rozet kazandin!',
          body: `${unlockedBadge.name} rozetini kazandin.`,
          data: { badgeId: unlockedBadge.id },
        });
      }

      // Push (best-effort)
      await this.push
        .sendToUser(payload.userId, {
          title: 'Gorev tamamlandi!',
          body: `${quest.name} (+${quest.xpReward} XP)`,
          data: { type: 'QUEST_COMPLETED', questId: quest.id },
        })
        .catch(() => undefined);

      if (this.gateway) {
        this.gateway.broadcastQuestCompleted(payload.userId, completedDto, quest.name);
        if (unlockedBadge) {
          this.gateway.broadcastBadgeEarned(payload.userId, unlockedBadge);
        }
      }
      void updated;
    }

    return completed;
  }

  async listUserBadges(userId: string): Promise<UserBadgeDto[]> {
    const rows = await this.prisma.userBadge.findMany({
      where: { userId, badge: { isActive: true } },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });
    return rows.map((r) => ({
      badge: this.toBadgeDto(r.badge),
      earnedAt: r.earnedAt.toISOString(),
      showcased: r.showcased,
      source: r.source,
    }));
  }

  async toggleShowcase(userId: string, dto: ShowcaseUserBadgeDto): Promise<UserBadgeDto> {
    const existing = await this.prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: dto.badgeId } },
      include: { badge: true },
    });
    if (!existing) {
      throw new Error('badge_not_owned');
    }
    const updated = await this.prisma.userBadge.update({
      where: { userId_badgeId: { userId, badgeId: dto.badgeId } },
      data: { showcased: dto.showcased },
      include: { badge: true },
    });
    return {
      badge: this.toBadgeDto(updated.badge),
      earnedAt: updated.earnedAt.toISOString(),
      showcased: updated.showcased,
      source: updated.source,
    };
  }

  async listUserQuests(userId: string): Promise<QuestProgressDto[]> {
    const quests = await this.prisma.quest.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const progress = await this.prisma.questProgress.findMany({
      where: { userId, questId: { in: quests.map((q) => q.id) } },
    });
    const byId = new Map(progress.map((p) => [p.questId, p]));
    return quests.map((q) => {
      const p = byId.get(q.id);
      return {
        questId: q.id,
        progress: p?.progress ?? 0,
        targetValue: q.targetValue,
        completed: p?.completed ?? false,
        completedAt: p?.completedAt ? p.completedAt.toISOString() : null,
        resetAt: p?.resetAt ? p.resetAt.toISOString() : null,
        quest: {
          id: q.id,
          code: q.code,
          name: q.name,
          description: q.description,
          trigger: q.trigger as QuestProgressDto['quest']['trigger'],
          targetValue: q.targetValue,
          xpReward: q.xpReward,
          badgeId: q.badgeId,
          repeatable: q.repeatable,
          resetPeriod: q.resetPeriod as QuestProgressDto['quest']['resetPeriod'],
          isActive: q.isActive,
        },
      };
    });
  }

  private toBadgeDto(b: {
    id: string;
    code: string;
    name: string;
    description: string;
    iconUrl: string | null;
    category: string | null;
    rarity: string;
    xpReward: number;
    isActive: boolean;
  }): BadgeDto {
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      description: b.description,
      iconUrl: b.iconUrl,
      category: b.category,
      rarity: b.rarity as BadgeDto['rarity'],
      xpReward: b.xpReward,
      isActive: b.isActive,
    };
  }
}

function nextResetAt(from: Date, period: string): Date | null {
  const d = new Date(from);
  switch (period) {
    case 'DAILY':
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + 1);
      return d;
    case 'WEEKLY': {
      const day = d.getUTCDay(); // 0=Sun
      const diff = (7 - day) % 7 || 7;
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + diff);
      return d;
    }
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    default:
      return null;
  }
}
