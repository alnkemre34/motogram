-- B-16 OTP, B-14 notification prefs, B-15 emergency contacts, B-18 mutedUntil

ALTER TABLE "users" ADD COLUMN "phoneVerifiedAt" TIMESTAMPTZ;

CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_codes_phone_createdAt_idx" ON "otp_codes"("phone", "createdAt");

CREATE TABLE "notification_preferences" (
    "userId" TEXT NOT NULL,
    "pushFollow" BOOLEAN NOT NULL DEFAULT true,
    "pushLike" BOOLEAN NOT NULL DEFAULT true,
    "pushComment" BOOLEAN NOT NULL DEFAULT true,
    "pushMention" BOOLEAN NOT NULL DEFAULT true,
    "pushParty" BOOLEAN NOT NULL DEFAULT true,
    "pushEmergency" BOOLEAN NOT NULL DEFAULT true,
    "pushCommunity" BOOLEAN NOT NULL DEFAULT true,
    "pushEvent" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "emergency_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "emergency_contacts_userId_idx" ON "emergency_contacts"("userId");

ALTER TABLE "conversation_participants" ADD COLUMN "mutedUntil" TIMESTAMPTZ;
