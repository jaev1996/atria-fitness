/*
  Warnings:

  - A unique constraint covering the columns `[classId,studentId]` on the table `Attendee` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Attendee_classId_studentId_key" ON "Attendee"("classId", "studentId");
