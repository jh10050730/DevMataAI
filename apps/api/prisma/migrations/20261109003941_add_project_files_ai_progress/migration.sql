-- AlterTable
ALTER TABLE `project` ADD COLUMN `aiProgress` INTEGER NULL,
    ADD COLUMN `aiProgressAt` DATETIME(3) NULL,
    ADD COLUMN `aiProgressDetail` TEXT NULL,
    ADD COLUMN `localPath` VARCHAR(500) NOT NULL DEFAULT '';
