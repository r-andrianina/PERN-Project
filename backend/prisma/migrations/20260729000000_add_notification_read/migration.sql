-- Notifications : état "lu" par utilisateur (B3)
-- Une ligne = un audit_log marqué lu par un utilisateur donné.
-- L'absence de ligne = "non lu" pour cet utilisateur.

CREATE TABLE "notification_reads" (
    "id"           SERIAL NOT NULL,
    "user_id"      INTEGER NOT NULL,
    "audit_log_id" INTEGER NOT NULL,
    "read_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_reads_user_id_audit_log_id_key"
    ON "notification_reads"("user_id", "audit_log_id");

CREATE INDEX "notification_reads_user_id_idx"
    ON "notification_reads"("user_id");

ALTER TABLE "notification_reads"
    ADD CONSTRAINT "notification_reads_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_reads"
    ADD CONSTRAINT "notification_reads_audit_log_id_fkey"
    FOREIGN KEY ("audit_log_id") REFERENCES "audit_logs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
