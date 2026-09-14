-- idTerrain (SERIES) : unicité GLOBALE → unicité PAR LOCALITÉ, sur les 4 tables
-- de spécimens (moustiques, tiques, puces, autres_specimens).
--
-- Pourquoi (2026-09-09) :
-- Le protocole de terrain numérote les tubes <CODE_LOCALITE>_<n> et REPART À 1
-- à chaque mission — c'est exactement ce que fait le générateur de
-- l'application (`src/utils/idTerrain.js` : « compteur unique par localité »,
-- nextCounter() ne compte que sur les méthodes d'UNE ligne Localite, donc
-- d'UNE mission). La contrainte `@unique` globale contredisait ce modèle : une
-- 2e mission sur le même lieu voyait TOUS ses tubes rejetés en DOUBLON, et la
-- création manuelle échouait de la même façon (generateMany renvoyait ABC_1,
-- déjà pris par la 1re mission).
--
-- `localite_id` est une copie de `methodes_collecte.localite_id`, portée sur le
-- spécimen parce qu'un index unique PostgreSQL ne peut pas traverser une
-- jointure. Elle n'a jamais besoin d'être resynchronisée : `methodeId` est exclu
-- des schémas de mise à jour des spécimens et `localiteId` de ceux des méthodes
-- (`.omit(...)` dans specimens.schema.js / methodes.schema.js), donc la chaîne
-- spécimen → méthode → localité est immuable après création.
--
-- Sûreté : la colonne est d'abord ajoutée NULLABLE, remplie depuis la méthode
-- (source de vérité), puis passée NOT NULL — aucune ligne ne peut rester sans
-- valeur puisque `methode_id` est déjà NOT NULL et référence une méthode qui a
-- toujours une localité. L'ancienne contrainte étant STRICTEMENT PLUS FORTE que
-- la nouvelle (unique global ⇒ unique par localité), aucune donnée existante ne
-- peut violer le nouvel index.
-- NB : sous PostgreSQL, NULL n'entre pas en conflit dans un index unique — les
-- spécimens sans idTerrain restent valides et peuvent être plusieurs.
--
-- `hotes` n'est PAS concernée : ses identifiants suivent HOTE_<AAAAMM>_<n>, un
-- compteur mensuel global, donc réellement unique dans toute la base.

-- ── moustiques ────────────────────────────────────────────────────
ALTER TABLE "moustiques" ADD COLUMN "localite_id" INTEGER;
UPDATE "moustiques" s SET "localite_id" = m."localite_id"
  FROM "methodes_collecte" m WHERE m."id" = s."methode_id";
ALTER TABLE "moustiques" ALTER COLUMN "localite_id" SET NOT NULL;
ALTER TABLE "moustiques" ADD CONSTRAINT "moustiques_localite_id_fkey"
  FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "moustiques_id_terrain_key";
CREATE UNIQUE INDEX "moustiques_localite_id_id_terrain_key" ON "moustiques"("localite_id", "id_terrain");
CREATE INDEX "moustiques_localite_id_idx" ON "moustiques"("localite_id");

-- ── tiques ────────────────────────────────────────────────────────
ALTER TABLE "tiques" ADD COLUMN "localite_id" INTEGER;
UPDATE "tiques" s SET "localite_id" = m."localite_id"
  FROM "methodes_collecte" m WHERE m."id" = s."methode_id";
ALTER TABLE "tiques" ALTER COLUMN "localite_id" SET NOT NULL;
ALTER TABLE "tiques" ADD CONSTRAINT "tiques_localite_id_fkey"
  FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "tiques_id_terrain_key";
CREATE UNIQUE INDEX "tiques_localite_id_id_terrain_key" ON "tiques"("localite_id", "id_terrain");
CREATE INDEX "tiques_localite_id_idx" ON "tiques"("localite_id");

-- ── puces ─────────────────────────────────────────────────────────
ALTER TABLE "puces" ADD COLUMN "localite_id" INTEGER;
UPDATE "puces" s SET "localite_id" = m."localite_id"
  FROM "methodes_collecte" m WHERE m."id" = s."methode_id";
ALTER TABLE "puces" ALTER COLUMN "localite_id" SET NOT NULL;
ALTER TABLE "puces" ADD CONSTRAINT "puces_localite_id_fkey"
  FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "puces_id_terrain_key";
CREATE UNIQUE INDEX "puces_localite_id_id_terrain_key" ON "puces"("localite_id", "id_terrain");
CREATE INDEX "puces_localite_id_idx" ON "puces"("localite_id");

-- ── autres_specimens ──────────────────────────────────────────────
ALTER TABLE "autres_specimens" ADD COLUMN "localite_id" INTEGER;
UPDATE "autres_specimens" s SET "localite_id" = m."localite_id"
  FROM "methodes_collecte" m WHERE m."id" = s."methode_id";
ALTER TABLE "autres_specimens" ALTER COLUMN "localite_id" SET NOT NULL;
ALTER TABLE "autres_specimens" ADD CONSTRAINT "autres_specimens_localite_id_fkey"
  FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "autres_specimens_id_terrain_key";
CREATE UNIQUE INDEX "autres_specimens_localite_id_id_terrain_key" ON "autres_specimens"("localite_id", "id_terrain");
CREATE INDEX "autres_specimens_localite_id_idx" ON "autres_specimens"("localite_id");
