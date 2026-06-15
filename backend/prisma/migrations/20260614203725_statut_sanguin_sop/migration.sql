-- Statut sanguin SOP (P1.4) : Boolean -> enum N/G/Gr/SGr/NC
-- Mapping de migration : true -> 'G' (Gorgé), false -> 'N' (Non gorgé)

ALTER TABLE "moustiques" ALTER COLUMN "repas_sang" DROP DEFAULT;
ALTER TABLE "moustiques" ALTER COLUMN "repas_sang" TYPE VARCHAR(3)
  USING (CASE WHEN "repas_sang" THEN 'G' ELSE 'N' END);
ALTER TABLE "moustiques" ALTER COLUMN "repas_sang" SET DEFAULT 'N';

ALTER TABLE "tiques" ALTER COLUMN "gorge" DROP DEFAULT;
ALTER TABLE "tiques" ALTER COLUMN "gorge" TYPE VARCHAR(3)
  USING (CASE WHEN "gorge" THEN 'G' ELSE 'N' END);
ALTER TABLE "tiques" ALTER COLUMN "gorge" SET DEFAULT 'N';
