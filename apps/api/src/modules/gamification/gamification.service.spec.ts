import { GamificationService } from './gamification.service';

// Spec 3.6 + 3.7 - Quest XP kazanma + badge unlock.

function buildGamification(questOverrides: Partial<{
  targetValue: number;
  xpReward: number;
  repeatable: boolean;
  resetPeriod: string;
  badgeId: string | null;
}> = {}) {
  const quest = {
    id: 'q1',
    code: 'FIRST_POST',
    name: 'Ilk post',
    description: '',
    trigger: 'POST_CREATED',
    targetValue: 1,
    xpReward: 10,
    badgeId: 'b1',
    repeatable: false,
    resetPeriod: 'NONE',
    isActive: true,
    createdAt: new Date(),
    badge: {
      id: 'b1',
      code: 'FIRST_POST',
      name: 'Ilk Paylasim',
      description: 'Ilk postu attin!',
      iconUrl: null,
      category: 'social',
      rarity: 'COMMON',
      xpReward: 10,
      isActive: true,
    },
    ...questOverrides,
  };

  const prisma = {
    quest: { findMany: jest.fn().mockResolvedValue([quest]) },
    questProgress: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({
        userId: 'u1',
        questId: 'q1',
        progress: 1,
        completed: true,
        completedAt: new Date(),
        resetAt: null,
      }),
    },
    user: {
      update: jest.fn().mockImplementation(({ data }) => ({
        xp: data.xp?.increment ?? 10,
        preferredLanguage: 'tr',
        level: 1,
      })),
    },
    userBadge: {
      upsert: jest.fn().mockResolvedValue({
        userId: 'u1',
        badgeId: 'b1',
        badge: quest.badge,
        earnedAt: new Date(),
        showcased: false,
        source: 'q1',
      }),
    },
  };

  const notifications = { create: jest.fn() };
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const service = new GamificationService(prisma as never, notifications as never, push as never);
  return { service, prisma, notifications, push, quest };
}

describe('GamificationService (Spec 3.6 + 3.7)', () => {
  it('awards XP and unlocks badge when quest completes', async () => {
    const { service, prisma, notifications } = buildGamification();
    const result = await service.triggerQuest({
      userId: 'u1',
      trigger: 'POST_CREATED',
      increment: 1,
    });

    expect(result).toHaveLength(1);
    const first = result[0]!;
    expect(first.xpAwarded).toBe(10);
    expect(first.badgeUnlocked?.code).toBe('FIRST_POST');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { xp: { increment: 10 } } }),
    );
    expect(prisma.userBadge.upsert).toHaveBeenCalled();
    // Hem QUEST_COMPLETED hem BADGE_EARNED bildirimi.
    const calls = notifications.create.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type);
    expect(calls).toContain('QUEST_COMPLETED');
    expect(calls).toContain('BADGE_EARNED');
  });

  it('does not award XP twice on second trigger (non-repeatable)', async () => {
    const { service, prisma } = buildGamification();
    prisma.questProgress.findUnique.mockResolvedValue({
      userId: 'u1',
      questId: 'q1',
      progress: 1,
      completed: true,
      completedAt: new Date(),
      resetAt: null,
    });
    const result = await service.triggerQuest({
      userId: 'u1',
      trigger: 'POST_CREATED',
      increment: 1,
    });
    expect(result).toHaveLength(0);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('accumulates progress for multi-step quest without awarding early', async () => {
    const { service, prisma } = buildGamification({ targetValue: 3, xpReward: 30 });
    // Progress 1 -> target 3, tamamlanmaz
    prisma.questProgress.findUnique.mockResolvedValue({
      userId: 'u1', questId: 'q1', progress: 1, completed: false, completedAt: null, resetAt: null,
    });
    prisma.questProgress.upsert.mockResolvedValue({
      userId: 'u1', questId: 'q1', progress: 2, completed: false, completedAt: null, resetAt: null,
    });
    const result = await service.triggerQuest({
      userId: 'u1', trigger: 'POST_CREATED', increment: 1,
    });
    expect(result).toHaveLength(0);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
