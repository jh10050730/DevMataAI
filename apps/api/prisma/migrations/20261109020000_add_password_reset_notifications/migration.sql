ALTER TABLE `User`
  ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `resetTokenHash` VARCHAR(64) NULL,
  ADD COLUMN `resetTokenExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `notificationInApp` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `notificationEmail` BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX `User_resetTokenHash_key` ON `User`(`resetTokenHash`);

CREATE TABLE `Notification` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `targetType` VARCHAR(16) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `deadlineAt` DATETIME(3) NOT NULL,
  `milestone` VARCHAR(20) NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `body` VARCHAR(1000) NOT NULL,
  `href` VARCHAR(100) NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `emailSentAt` DATETIME(3) NULL,
  `emailAttempts` INTEGER NOT NULL DEFAULT 0,
  `nextEmailAttemptAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Notification_targetType_targetId_deadlineAt_milestone_key` (`targetType`, `targetId`, `deadlineAt`, `milestone`),
  INDEX `Notification_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
