-- AlterTable: Mission.objet (P0.1)
ALTER TABLE "missions" ADD COLUMN     "objet" TEXT;

-- AlterTable: Localite contact local (P0.2)
ALTER TABLE "localites" ADD COLUMN     "contact_nom" VARCHAR(150),
ADD COLUMN     "contact_telephone" VARCHAR(50),
ADD COLUMN     "contact_statut" VARCHAR(100);

-- Data migration: aligner "stade" sur les codes SOP E/L/N/A (P0.4)
UPDATE "moustiques" SET "stade" = CASE "stade"
  WHEN 'Adulte' THEN 'A' WHEN 'Nymphe' THEN 'N'
  WHEN 'Larve'  THEN 'L' WHEN 'Oeuf' THEN 'E' WHEN 'Œuf' THEN 'E'
  ELSE "stade" END
WHERE "stade" IS NOT NULL;

UPDATE "tiques" SET "stade" = CASE "stade"
  WHEN 'Adulte' THEN 'A' WHEN 'Nymphe' THEN 'N'
  WHEN 'Larve'  THEN 'L' WHEN 'Oeuf' THEN 'E' WHEN 'Œuf' THEN 'E'
  ELSE "stade" END
WHERE "stade" IS NOT NULL;

UPDATE "puces" SET "stade" = CASE "stade"
  WHEN 'Adulte' THEN 'A' WHEN 'Nymphe' THEN 'N'
  WHEN 'Larve'  THEN 'L' WHEN 'Oeuf' THEN 'E' WHEN 'Œuf' THEN 'E'
  ELSE "stade" END
WHERE "stade" IS NOT NULL;
