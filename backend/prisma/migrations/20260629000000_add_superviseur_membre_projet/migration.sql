-- Ajout du rôle superviseur dans l'enum Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'superviseur';

-- Création de la table membres_projet (cloisonnement des projets)
CREATE TABLE IF NOT EXISTS "membres_projet" (
    "id"          SERIAL NOT NULL,
    "projet_id"   INTEGER NOT NULL,
    "user_id"     INTEGER NOT NULL,
    "added_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by_id" INTEGER,

    CONSTRAINT "membres_projet_pkey" PRIMARY KEY ("id")
);

-- Contrainte d'unicité projet + utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS "membres_projet_projet_id_user_id_key"
    ON "membres_projet"("projet_id", "user_id");

-- Index sur user_id pour les recherches par utilisateur
CREATE INDEX IF NOT EXISTS "membres_projet_user_id_idx"
    ON "membres_projet"("user_id");

-- Clés étrangères
ALTER TABLE "membres_projet"
    ADD CONSTRAINT "membres_projet_projet_id_fkey"
    FOREIGN KEY ("projet_id") REFERENCES "projets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membres_projet"
    ADD CONSTRAINT "membres_projet_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
