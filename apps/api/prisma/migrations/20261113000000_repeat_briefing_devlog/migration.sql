-- 반복 할 일·일정
ALTER TABLE "Event" ADD COLUMN "repeat" TEXT;
ALTER TABLE "Event" ADD COLUMN "repeatUntil" DATETIME;
ALTER TABLE "Task" ADD COLUMN "repeat" TEXT;

-- 아침 브리핑 설정 (표를 다시 만들지 않고 칸만 더한다)
ALTER TABLE "User" ADD COLUMN "briefingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "briefingHour" INTEGER NOT NULL DEFAULT 7;

-- 개발일지
CREATE TABLE "DevLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "commitCount" INTEGER NOT NULL,
    "commits" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DevLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DevLog_projectId_day_key" ON "DevLog"("projectId", "day");
