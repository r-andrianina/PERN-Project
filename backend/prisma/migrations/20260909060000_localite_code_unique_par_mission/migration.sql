-- Localite.code : unicité GLOBALE → unicité PAR MISSION, et VarChar(10) → VarChar(50).
--
-- Pourquoi (2026-09-09) :
-- Une Localite appartient à une Mission (chaîne Projet → Mission → Localité →
-- Méthode → Spécimen) : deux passages sur le même village produisent deux
-- lignes, ce qui est voulu — chaque passage a ses propres coordonnées relevées.
-- Mais avec un `code` unique globalement, la 2e mission ne pouvait pas
-- réutiliser le code du lieu : la localité était créée SANS code, et le lieu
-- devenait impossible à suivre d'une mission à l'autre. C'est exactement ce à
-- quoi le code sert.
--
-- L'élargissement à 50 caractères traite le second effet du même problème : un
-- code de plus de 10 caractères était tronqué en base, donc ne correspondait
-- plus à celui du fichier et n'était jamais retrouvé au passage suivant. Avec
-- l'unicité par mission, une troncature provoquerait désormais un conflit de
-- contrainte qui annulerait tout l'import (transaction) — le garde-fou n'est
-- plus optionnel.
--
-- Sûreté : l'ancienne contrainte étant STRICTEMENT PLUS FORTE que la nouvelle
-- (unique global ⇒ unique par mission), aucune donnée existante ne peut violer
-- l'index créé ici. Aucune valeur n'est modifiée ni supprimée.
-- NB : sous PostgreSQL, NULL n'entre pas en conflit dans un index unique — les
-- localités sans code (dont celles créées par l'ancien comportement) restent
-- valides et peuvent être plusieurs dans une même mission.

-- DropIndex
DROP INDEX "localites_code_key";

-- AlterTable
ALTER TABLE "localites" ALTER COLUMN "code" SET DATA TYPE VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "localites_mission_id_code_key" ON "localites"("mission_id", "code");
