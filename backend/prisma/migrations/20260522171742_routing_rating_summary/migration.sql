-- CreateTable
CREATE TABLE "ContactTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RoutingRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "condition" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CallRating" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "callId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CallSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "callId" INTEGER NOT NULL,
    "transcript" TEXT,
    "summary" TEXT,
    "language" TEXT,
    "durationMs" INTEGER,
    "cost" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactTag_phone_key" ON "ContactTag"("phone");

-- CreateIndex
CREATE INDEX "ContactTag_tag_idx" ON "ContactTag"("tag");

-- CreateIndex
CREATE INDEX "RoutingRule_active_priority_idx" ON "RoutingRule"("active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "CallRating_callId_key" ON "CallRating"("callId");

-- CreateIndex
CREATE INDEX "CallRating_phone_idx" ON "CallRating"("phone");

-- CreateIndex
CREATE INDEX "CallRating_score_idx" ON "CallRating"("score");

-- CreateIndex
CREATE UNIQUE INDEX "CallSummary_callId_key" ON "CallSummary"("callId");
