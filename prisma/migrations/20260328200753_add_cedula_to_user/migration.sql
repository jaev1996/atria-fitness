/*
  Warnings:

  - A unique constraint covering the columns `[cedula]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cedula" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_cedula_key" ON "User"("cedula");
