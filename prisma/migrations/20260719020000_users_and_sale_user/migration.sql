-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Seed fixed users (passwords = usernames)
INSERT INTO "User" ("id", "username", "passwordHash", "displayName", "createdAt", "updatedAt") VALUES
('user_maxifan', 'maxifan', '$2b$10$yVStg0eUY83.J2zIOWJpeO1keD//15v/9fGTfGCYaKuLt8Oqw3NN2', 'maxifan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_camifan', 'camifan', '$2b$10$2gaY4n9w6dWT7YgPEfIxguFlbcJ6wdVsoeVmbmcBI.rK0d3BDyQhq', 'camifan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_lucifan', 'lucifan', '$2b$10$Dj4FtpObbl/NJxoKWEj6OuLHbrVS/Poy1vhk7Ah5HaLXg9FIG4ney', 'lucifan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user_juliofan', 'juliofan', '$2b$10$ls21Jb4DXxKdySkRVSDvZO6rGRUgIoXJ76O6aLJXntZdpxA4TMYI6', 'juliofan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable Sale
ALTER TABLE "Sale" ADD COLUMN "userId" TEXT;

UPDATE "Sale" SET "userId" = 'user_juliofan' WHERE "userId" IS NULL;

ALTER TABLE "Sale" ALTER COLUMN "userId" SET NOT NULL;

CREATE INDEX "Sale_userId_createdAt_idx" ON "Sale"("userId", "createdAt" DESC);

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
