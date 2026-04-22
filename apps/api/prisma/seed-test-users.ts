/**
 * CI / test-all.sh icinde calisir: sabit ADMIN + MODERATOR hesaplari (RBAC E2E).
 * Idempotent upsert.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin_seed_e2e@motogram.test';
const ADMIN_USER = 'admin_seed_e2e';
const ADMIN_PASS = 'AdminE2e1!zz';

const MOD_EMAIL = 'mod_seed_e2e@motogram.test';
const MOD_USER = 'mod_seed_e2e';
const MOD_PASS = 'ModE2e1!zz';

async function main(): Promise<void> {
  const now = new Date();
  const hashAdmin = await bcrypt.hash(ADMIN_PASS, 12);
  const hashMod = await bcrypt.hash(MOD_PASS, 12);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      username: ADMIN_USER,
      passwordHash: hashAdmin,
      role: 'ADMIN',
      isBanned: false,
      deletedAt: null,
      eulaAcceptedAt: now,
    },
    create: {
      email: ADMIN_EMAIL,
      username: ADMIN_USER,
      passwordHash: hashAdmin,
      role: 'ADMIN',
      preferredLanguage: 'tr',
      eulaAcceptedAt: now,
    },
  });

  await prisma.user.upsert({
    where: { email: MOD_EMAIL },
    update: {
      username: MOD_USER,
      passwordHash: hashMod,
      role: 'MODERATOR',
      isBanned: false,
      deletedAt: null,
      eulaAcceptedAt: now,
    },
    create: {
      email: MOD_EMAIL,
      username: MOD_USER,
      passwordHash: hashMod,
      role: 'MODERATOR',
      preferredLanguage: 'tr',
      eulaAcceptedAt: now,
    },
  });

  // eslint-disable-next-line no-console
  console.log('[seed-test-users] ADMIN + MODERATOR upsert OK');
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
