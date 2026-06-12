-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'READ';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN "is_read" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "audit_logs_is_read_idx" ON "audit_logs"("is_read");
