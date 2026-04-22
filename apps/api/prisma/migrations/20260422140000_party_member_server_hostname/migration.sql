-- AlterTable
ALTER TABLE "party_members" ADD COLUMN IF NOT EXISTS "server_hostname" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "party_members_server_hostname_idx" ON "party_members"("server_hostname");
