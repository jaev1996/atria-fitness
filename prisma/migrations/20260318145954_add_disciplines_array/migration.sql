-- AlterTable
ALTER TABLE "StudentPlan" ADD COLUMN     "disciplines" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Copy legacy discipline into the new disciplines array
UPDATE "StudentPlan" SET "disciplines" = ARRAY["discipline"] WHERE "discipline" IS NOT NULL;
