-- Création de la table localite_contacts (plusieurs contacts par localité)
CREATE TABLE IF NOT EXISTS "localite_contacts" (
    "id"          SERIAL NOT NULL,
    "localite_id" INTEGER NOT NULL,
    "nom"         VARCHAR(150) NOT NULL,
    "telephone"   VARCHAR(50),
    "statut"      VARCHAR(100),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "localite_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "localite_contacts_localite_id_idx"
    ON "localite_contacts"("localite_id");

ALTER TABLE "localite_contacts"
    ADD CONSTRAINT "localite_contacts_localite_id_fkey"
    FOREIGN KEY ("localite_id") REFERENCES "localites"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Migration des données : l'ancien contact scalaire de chaque localité devient
-- le premier contact de la nouvelle table (uniquement si un nom était renseigné).
INSERT INTO "localite_contacts" ("localite_id", "nom", "telephone", "statut", "created_at", "updated_at")
SELECT "id", "contact_nom", "contact_telephone", "contact_statut", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "localites"
WHERE "contact_nom" IS NOT NULL AND "contact_nom" <> '';

-- Suppression des anciennes colonnes de contact unique, remplacées par la table ci-dessus.
ALTER TABLE "localites" DROP COLUMN IF EXISTS "contact_nom";
ALTER TABLE "localites" DROP COLUMN IF EXISTS "contact_telephone";
ALTER TABLE "localites" DROP COLUMN IF EXISTS "contact_statut";
