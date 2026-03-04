-- CreateEnum
CREATE TYPE "AuthMode" AS ENUM ('CREDENTIALS', 'LEARNER_TOKEN');

-- AlterTable: make email and passwordHash nullable, add learner fields
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "authMode" "AuthMode" NOT NULL DEFAULT 'CREDENTIALS';
ALTER TABLE "User" ADD COLUMN "learnerToken" TEXT;
ALTER TABLE "User" ADD COLUMN "recoveryCode" TEXT;
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "User" ADD COLUMN "avatar" TEXT;
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_learnerToken_key" ON "User"("learnerToken");
CREATE UNIQUE INDEX "User_recoveryCode_key" ON "User"("recoveryCode");

-- CreateTable
CREATE TABLE "GuardianLink" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "guardianEmail" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consentGivenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardianLink_verificationToken_key" ON "GuardianLink"("verificationToken");
CREATE UNIQUE INDEX "GuardianLink_learnerId_guardianEmail_key" ON "GuardianLink"("learnerId", "guardianEmail");
CREATE INDEX "GuardianLink_guardianEmail_idx" ON "GuardianLink"("guardianEmail");
CREATE INDEX "GuardianLink_verificationToken_idx" ON "GuardianLink"("verificationToken");

-- AddForeignKey
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
