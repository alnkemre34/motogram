-- Faz 8 — feed / party lookups (Prisma migrate transaction; avoid CONCURRENTLY here)
CREATE INDEX IF NOT EXISTS "idx_party_members_party_left_active"
  ON "party_members" ("partyId", "leftAt")
  WHERE "leftAt" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_posts_user_created_active"
  ON "posts" ("userId", "createdAt" DESC)
  WHERE "deletedAt" IS NULL;
