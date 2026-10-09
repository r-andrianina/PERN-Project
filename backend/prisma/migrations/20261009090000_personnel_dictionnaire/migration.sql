-- Chef de mission et agents de terrain : comptes utilisateurs → dictionnaire Personnel.
--
-- Pourquoi (2026-10-09) :
-- Pour figurer sur une mission, une personne devait avoir un compte (email,
-- mot de passe) — or chauffeurs, guides et techniciens de terrain n'ouvrent
-- jamais l'application. Le chef avait un repli texte libre (`chef_mission_nom`)
-- qui produisait des graphies concurrentes d'une même personne, impossibles à
-- regrouper ; les agents n'en avaient aucun. Le dictionnaire Personnel (rempli
-- depuis l'annuaire de l'UEM) remplace les deux, et le texte libre disparaît.
--
-- Reprise : chaque utilisateur déjà chef ou agent, et chaque `chef_mission_nom`
-- saisi, devient une fiche Personnel ; les missions y sont rattachées. Un nom
-- identique (après normalisation des espaces) donne UNE seule fiche.
--
-- Sûreté : PostgreSQL exécute ce fichier en une seule transaction implicite.
-- Les deux contrôles ci-dessous font échouer la migration ENTIÈRE — sans rien
-- modifier — si une mission devait perdre son chef ou un agent. Aucune ligne
-- de `users` n'est modifiée.

-- CreateTable
CREATE TABLE "personnel" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "fonction" VARCHAR(200),
    "equipe" VARCHAR(100),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "personnel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personnel_nom_key" ON "personnel"("nom");

-- ── Reprise 1 : fiches pour les utilisateurs déjà chef ou agent ──────
INSERT INTO "personnel" ("nom", "updated_at")
SELECT DISTINCT regexp_replace(btrim(u."prenom" || ' ' || u."nom"), '\s+', ' ', 'g'), CURRENT_TIMESTAMP
FROM "users" u
WHERE u."id" IN (
  SELECT "chef_mission_id" FROM "missions" WHERE "chef_mission_id" IS NOT NULL
  UNION
  SELECT "user_id" FROM "mission_agents"
)
ON CONFLICT ("nom") DO NOTHING;

-- ── Reprise 2 : fiches pour les chefs saisis en texte libre ──────────
INSERT INTO "personnel" ("nom", "updated_at")
SELECT DISTINCT regexp_replace(btrim("chef_mission_nom"), '\s+', ' ', 'g'), CURRENT_TIMESTAMP
FROM "missions"
WHERE "chef_mission_id" IS NULL
  AND NULLIF(btrim("chef_mission_nom"), '') IS NOT NULL
ON CONFLICT ("nom") DO NOTHING;

-- ── Missions : chef_mission_id pointe désormais vers personnel ───────
ALTER TABLE "missions" DROP CONSTRAINT "missions_chef_mission_id_fkey";
ALTER TABLE "missions" ADD COLUMN "chef_personnel_id" INTEGER;

UPDATE "missions" m
SET "chef_personnel_id" = p."id"
FROM "users" u, "personnel" p
WHERE m."chef_mission_id" = u."id"
  AND p."nom" = regexp_replace(btrim(u."prenom" || ' ' || u."nom"), '\s+', ' ', 'g');

UPDATE "missions" m
SET "chef_personnel_id" = p."id"
FROM "personnel" p
WHERE m."chef_mission_id" IS NULL
  AND p."nom" = regexp_replace(btrim(m."chef_mission_nom"), '\s+', ' ', 'g');

DO $$
DECLARE perdus INTEGER;
BEGIN
  SELECT count(*) INTO perdus FROM "missions"
  WHERE ("chef_mission_id" IS NOT NULL OR NULLIF(btrim("chef_mission_nom"), '') IS NOT NULL)
    AND "chef_personnel_id" IS NULL;
  IF perdus > 0 THEN
    RAISE EXCEPTION 'Migration personnel annulée : % mission(s) perdraient leur chef', perdus;
  END IF;
END $$;

ALTER TABLE "missions" DROP COLUMN "chef_mission_id";
ALTER TABLE "missions" DROP COLUMN "chef_mission_nom";
ALTER TABLE "missions" RENAME COLUMN "chef_personnel_id" TO "chef_mission_id";

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_chef_mission_id_fkey" FOREIGN KEY ("chef_mission_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "missions_chef_mission_id_idx" ON "missions"("chef_mission_id");

-- ── Agents : user_id → personnel_id ──────────────────────────────────
ALTER TABLE "mission_agents" ADD COLUMN "personnel_id" INTEGER;

UPDATE "mission_agents" a
SET "personnel_id" = p."id"
FROM "users" u, "personnel" p
WHERE a."user_id" = u."id"
  AND p."nom" = regexp_replace(btrim(u."prenom" || ' ' || u."nom"), '\s+', ' ', 'g');

DO $$
DECLARE perdus INTEGER;
BEGIN
  SELECT count(*) INTO perdus FROM "mission_agents" WHERE "personnel_id" IS NULL;
  IF perdus > 0 THEN
    RAISE EXCEPTION 'Migration personnel annulée : % affectation(s) d''agent sans fiche', perdus;
  END IF;
END $$;

-- Deux comptes homonymes sur une même mission deviennent la même fiche :
-- on ne garde qu'une affectation, sans quoi la nouvelle clé primaire échoue.
DELETE FROM "mission_agents" a
USING "mission_agents" b
WHERE a."mission_id" = b."mission_id"
  AND a."personnel_id" = b."personnel_id"
  AND a."user_id" > b."user_id";

ALTER TABLE "mission_agents" DROP CONSTRAINT "mission_agents_pkey";
ALTER TABLE "mission_agents" DROP CONSTRAINT "mission_agents_user_id_fkey";
ALTER TABLE "mission_agents" DROP COLUMN "user_id";
ALTER TABLE "mission_agents" ALTER COLUMN "personnel_id" SET NOT NULL;
ALTER TABLE "mission_agents" ADD CONSTRAINT "mission_agents_pkey" PRIMARY KEY ("mission_id", "personnel_id");

-- AddForeignKey
ALTER TABLE "mission_agents" ADD CONSTRAINT "mission_agents_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "mission_agents_personnel_id_idx" ON "mission_agents"("personnel_id");
