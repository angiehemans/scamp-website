-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "notes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseAsset" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,

    CONSTRAINT "ReleaseAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Release_version_key" ON "Release"("version");

-- CreateIndex
CREATE INDEX "Release_publishedAt_idx" ON "Release"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseAsset_releaseId_platform_key" ON "ReleaseAsset"("releaseId", "platform");

-- AddForeignKey
ALTER TABLE "ReleaseAsset" ADD CONSTRAINT "ReleaseAsset_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
