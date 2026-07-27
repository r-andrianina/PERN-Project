-- Remplace date_collecte (date seule) + heure_debut/heure_fin (heure seule, string)
-- par date_pose / date_releve (date+heure) sur methodes_collecte — tâche 2.5.
ALTER TABLE "methodes_collecte" ADD COLUMN "date_pose"   TIMESTAMP(3);
ALTER TABLE "methodes_collecte" ADD COLUMN "date_releve" TIMESTAMP(3);

-- Reprise best-effort des données existantes : date_collecte devient date_pose.
UPDATE "methodes_collecte" SET "date_pose" = "date_collecte" WHERE "date_collecte" IS NOT NULL;

ALTER TABLE "methodes_collecte" DROP COLUMN IF EXISTS "date_collecte";
ALTER TABLE "methodes_collecte" DROP COLUMN IF EXISTS "heure_debut";
ALTER TABLE "methodes_collecte" DROP COLUMN IF EXISTS "heure_fin";
