-- CreateEnum
CREATE TYPE "EventTheme" AS ENUM ('HALLOWEEN', 'CHRISTMAS', 'CUSTOM');

-- CreateTable
CREATE TABLE "SeasonalEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "theme" "EventTheme" NOT NULL DEFAULT 'CUSTOM',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "barText" TEXT NOT NULL,
    "barLinkLabel" TEXT,
    "barLinkHref" TEXT,
    "heroEyebrow" TEXT,
    "heroTitle" TEXT NOT NULL,
    "heroSubtitle" TEXT,
    "heroImage" TEXT,
    "heroCtaLabel" TEXT,
    "heroCtaHref" TEXT,
    "collection" TEXT,
    "sectionTitle" TEXT,
    "accentColor" TEXT,
    "decorations" BOOLEAN NOT NULL DEFAULT true,
    "banners" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeasonalEvent_active_startsAt_idx" ON "SeasonalEvent"("active", "startsAt");

