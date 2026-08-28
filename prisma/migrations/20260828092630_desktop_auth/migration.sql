-- CreateTable
CREATE TABLE "DesktopAuthRequest" (
    "code" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oneTimeToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesktopAuthRequest_pkey" PRIMARY KEY ("code")
);
-- CreateIndex
CREATE INDEX "DesktopAuthRequest_expiresAt_idx" ON "DesktopAuthRequest"("expiresAt");
-- AddForeignKey
ALTER TABLE "DesktopAuthRequest" ADD CONSTRAINT "DesktopAuthRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
