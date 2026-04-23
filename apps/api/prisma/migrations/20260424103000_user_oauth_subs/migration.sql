-- Apple / Google stable subject (Sign in with Apple / Google ID token `sub`)

ALTER TABLE "users" ADD COLUMN "appleSub" TEXT;
ALTER TABLE "users" ADD COLUMN "googleSub" TEXT;

CREATE UNIQUE INDEX "users_appleSub_key" ON "users"("appleSub");
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");
