-- Suppression du statut de mission (planifiee/en_cours/terminee/annulee) — tâche 2.1
ALTER TABLE "missions" DROP COLUMN IF EXISTS "statut";
DROP TYPE IF EXISTS "StatutMission";
