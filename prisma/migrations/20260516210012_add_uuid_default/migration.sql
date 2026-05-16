-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
