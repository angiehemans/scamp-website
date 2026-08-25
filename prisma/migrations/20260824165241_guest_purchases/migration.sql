-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "email" TEXT,
ADD COLUMN     "ipHash" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Purchase_email_idx" ON "Purchase"("email");

-- CreateIndex
CREATE INDEX "Purchase_ipHash_createdAt_idx" ON "Purchase"("ipHash", "createdAt");
