-- B-06: 30-day username change cooldown
ALTER TABLE "users" ADD COLUMN "usernameChangedAt" TIMESTAMP(3);
