-- CreateEnum
CREATE TYPE "TrancheHoraire" AS ENUM ('h18_19', 'h19_20', 'h20_21', 'h21_22', 'h22_23', 'h23_00', 'h00_01', 'h01_02', 'h02_03', 'h03_04', 'h04_05', 'h05_06');

-- AlterTable
ALTER TABLE "moustiques" ADD COLUMN     "tranche_horaire" "TrancheHoraire";

-- AlterTable
ALTER TABLE "types_methode_collecte" ADD COLUMN     "requires_tranche_horaire" BOOLEAN NOT NULL DEFAULT false;

-- Active le sélecteur de tranche horaire sur le type de méthode HLC existant
-- (Human Landing Catch) — protocole horodaté par définition.
UPDATE "types_methode_collecte" SET "requires_tranche_horaire" = true WHERE "code" = 'HLC';
