// Motogram Seed - Spec 3.6 (Gamification) + 3.7 (Notification) + 8.11 (FeatureFlags)
// Uretim ortaminda `pnpm --filter @motogram/api db:seed` ile calistirilir.
//   - NotificationTemplate (TR/EN)
//   - Badge (6 rozet) + Quest (12 trigger)
//   - Bu dosya idempotent: upsert bazli.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedNotificationTemplates() {
  const templates = [
    { type: 'FOLLOW', language: 'tr', titleTemplate: '{{followerUsername}} seni takip etti.', bodyTemplate: 'Profilini goruntulemek icin tikla.' },
    { type: 'FOLLOW', language: 'en', titleTemplate: '{{followerUsername}} followed you.', bodyTemplate: 'Tap to view profile.' },
    { type: 'LIKE', language: 'tr', titleTemplate: '{{likerUsername}} gonderini begendi.', bodyTemplate: '{{captionPreview}}...' },
    { type: 'LIKE', language: 'en', titleTemplate: '{{likerUsername}} liked your post.', bodyTemplate: '{{captionPreview}}...' },
    { type: 'COMMENT', language: 'tr', titleTemplate: '{{commenterUsername}} yorum yapti: {{commentText}}', bodyTemplate: 'Yanitlamak icin tikla.' },
    { type: 'COMMENT', language: 'en', titleTemplate: '{{commenterUsername}} commented: {{commentText}}', bodyTemplate: 'Tap to reply.' },
    { type: 'MENTION', language: 'tr', titleTemplate: '{{mentionerUsername}} seni etiketledi.', bodyTemplate: '{{contextPreview}}' },
    { type: 'SYSTEM', language: 'tr', titleTemplate: '{{title}}', bodyTemplate: '{{body}}' },
  ] as const;

  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { type_language: { type: t.type, language: t.language } },
      update: { titleTemplate: t.titleTemplate, bodyTemplate: t.bodyTemplate },
      create: t,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] ${templates.length} notification templates upserted.`);
}

// Spec 3.6 - 6 ana rozet. Nadir/Epik/Efsanevi kademesi kullanilarak koleksiyon olusturulur.
async function seedBadges() {
  const badges = [
    {
      code: 'FIRST_RIDE',
      name: 'Ilk Viraj',
      description: 'Ilk surusunu tamamladin. Hoshgeldin asfalt!',
      category: 'riding',
      rarity: 'COMMON' as const,
      xpReward: 50,
      criteria: { trigger: 'PARTY_COMPLETED', threshold: 1 },
    },
    {
      code: 'SOCIAL_BUTTERFLY',
      name: 'Sosyal Motorcu',
      description: '50 kisiye ulastin. Topluluk lideri olmaya bir adim daha yakinsin.',
      category: 'social',
      rarity: 'UNCOMMON' as const,
      xpReward: 150,
      criteria: { trigger: 'FOLLOW_GAINED', threshold: 50 },
    },
    {
      code: 'ROUTE_MASTER',
      name: 'Rota Ustasi',
      description: '5 farkli rota olusturdun. Yol senden soruluyor.',
      category: 'riding',
      rarity: 'RARE' as const,
      xpReward: 300,
      criteria: { trigger: 'ROUTE_CREATED', threshold: 5 },
    },
    {
      code: 'COMMUNITY_HERO',
      name: 'Topluluk Kahramani',
      description: '3 farkli SOS cagrisina mudahale ettin. Sen birine hayat kurtarmis olabilirsin.',
      category: 'emergency',
      rarity: 'EPIC' as const,
      xpReward: 500,
      criteria: { trigger: 'EMERGENCY_ACKNOWLEDGED', threshold: 3 },
    },
    {
      code: 'EVENT_ORGANIZER',
      name: 'Etkinlik Organizatoru',
      description: '3 etkinlige ev sahipligi yaptin. Topluluk seni taniyor.',
      category: 'event',
      rarity: 'RARE' as const,
      xpReward: 250,
      criteria: { trigger: 'EVENT_HOSTED', threshold: 3 },
    },
    {
      code: 'LEGEND_OF_THE_ROAD',
      name: 'Yolun Efsanesi',
      description: '10 partiyi lider olarak tamamladin. Adin simdi efsane.',
      category: 'community',
      rarity: 'LEGENDARY' as const,
      xpReward: 1000,
      criteria: { trigger: 'PARTY_LEAD', threshold: 10 },
    },
  ];

  for (const b of badges) {
    await prisma.badge.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        description: b.description,
        category: b.category,
        rarity: b.rarity,
        xpReward: b.xpReward,
        criteria: b.criteria,
      },
      create: b,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] ${badges.length} badges upserted.`);
}

// Spec 3.6 - 12 QuestTrigger'in her birine en az bir Quest bagli olmali.
async function seedQuests() {
  const quests = [
    {
      code: 'FIRST_POST',
      name: 'Ilk Paylasim',
      description: 'Ilk gonderini paylas.',
      trigger: 'POST_CREATED' as const,
      targetValue: 1,
      xpReward: 25,
      repeatable: false,
    },
    {
      code: 'DAILY_STORY',
      name: 'Gunluk Hikaye',
      description: 'Bugun bir hikaye paylas.',
      trigger: 'STORY_CREATED' as const,
      targetValue: 1,
      xpReward: 10,
      repeatable: true,
      resetPeriod: 'DAILY' as const,
    },
    {
      code: 'SOCIAL_GROWTH_10',
      name: 'Ilk 10 Takipci',
      description: 'Ilk 10 takipcini kazan.',
      trigger: 'FOLLOW_GAINED' as const,
      targetValue: 10,
      xpReward: 50,
    },
    {
      code: 'EVENT_PARTICIPANT',
      name: 'Etkinlikte Bulus',
      description: 'Bir etkinlige katil.',
      trigger: 'EVENT_JOINED' as const,
      targetValue: 1,
      xpReward: 40,
    },
    {
      code: 'EVENT_HOST_FIRST',
      name: 'Etkinlik Organize Et',
      description: 'Ilk etkinligini duzenle.',
      trigger: 'EVENT_HOSTED' as const,
      targetValue: 1,
      xpReward: 100,
    },
    {
      code: 'PARTY_FINISHER',
      name: 'Parti Tamamla',
      description: 'Bir partiyi sonuna kadar tamamla.',
      trigger: 'PARTY_COMPLETED' as const,
      targetValue: 1,
      xpReward: 75,
    },
    {
      code: 'PARTY_LEADER_FIRST',
      name: 'Lider Ol',
      description: 'Ilk kez bir partiye liderlik et.',
      trigger: 'PARTY_LEAD' as const,
      targetValue: 1,
      xpReward: 120,
    },
    {
      code: 'ROUTE_CREATOR_FIRST',
      name: 'Ilk Rota',
      description: 'Ilk rotani yayinla.',
      trigger: 'ROUTE_CREATED' as const,
      targetValue: 1,
      xpReward: 80,
    },
    {
      code: 'EMERGENCY_FIRST_RESPONDER',
      name: 'Ilk Mudahale',
      description: 'Bir SOS cagrisina mudahale et.',
      trigger: 'EMERGENCY_ACKNOWLEDGED' as const,
      targetValue: 1,
      xpReward: 200,
    },
    {
      code: 'PROFILE_COMPLETE',
      name: 'Profilini Tamamla',
      description: 'Profil bilgilerini eksiksiz doldur.',
      trigger: 'PROFILE_COMPLETED' as const,
      targetValue: 1,
      xpReward: 60,
    },
    {
      code: 'BIKE_IN_GARAGE',
      name: 'Garajina Motor Ekle',
      description: 'Ilk motosikletini garaja ekle.',
      trigger: 'BIKE_ADDED' as const,
      targetValue: 1,
      xpReward: 50,
    },
    {
      code: 'COMMUNITY_MEMBER',
      name: 'Topluluk Uyesi',
      description: 'Bir toplulugun parcasi ol.',
      trigger: 'COMMUNITY_JOINED' as const,
      targetValue: 1,
      xpReward: 45,
    },
  ];

  for (const q of quests) {
    await prisma.quest.upsert({
      where: { code: q.code },
      update: {
        name: q.name,
        description: q.description,
        targetValue: q.targetValue,
        xpReward: q.xpReward,
        repeatable: q.repeatable ?? false,
        resetPeriod: q.resetPeriod ?? 'NONE',
      },
      create: {
        ...q,
        repeatable: q.repeatable ?? false,
        resetPeriod: q.resetPeriod ?? 'NONE',
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] ${quests.length} quests upserted.`);
}

async function main() {
  await seedNotificationTemplates();
  await seedBadges();
  await seedQuests();
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
