-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedBy" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
