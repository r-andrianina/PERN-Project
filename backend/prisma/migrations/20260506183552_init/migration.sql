-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'chercheur', 'terrain', 'lecteur');

-- CreateEnum
CREATE TYPE "StatutProjet" AS ENUM ('actif', 'termine', 'suspendu');

-- CreateEnum
CREATE TYPE "StatutMission" AS ENUM ('planifiee', 'en_cours', 'terminee', 'annulee');

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('M', 'F', 'inconnu');

-- CreateEnum
CREATE TYPE "NiveauTaxonomique" AS ENUM ('ordre', 'famille', 'sous_famille', 'genre', 'sous_genre', 'espece', 'sous_espece');

-- CreateEnum
CREATE TYPE "TypeSpecimenTaxon" AS ENUM ('moustique', 'tique', 'puce');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "prenom" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'lecteur',
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projets" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "responsable_id" INTEGER,
    "date_debut" DATE,
    "date_fin" DATE,
    "statut" "StatutProjet" NOT NULL DEFAULT 'actif',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" SERIAL NOT NULL,
    "ordre_mission" VARCHAR(50) NOT NULL,
    "projet_id" INTEGER NOT NULL,
    "chef_mission_id" INTEGER,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "statut" "StatutMission" NOT NULL DEFAULT 'planifiee',
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_agents" (
    "mission_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "mission_agents_pkey" PRIMARY KEY ("mission_id","user_id")
);

-- CreateTable
CREATE TABLE "localites" (
    "id" SERIAL NOT NULL,
    "mission_id" INTEGER NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "toponyme" VARCHAR(200),
    "pays" VARCHAR(100) NOT NULL DEFAULT 'Madagascar',
    "region" VARCHAR(100),
    "district" VARCHAR(100),
    "commune" VARCHAR(100),
    "fokontany" VARCHAR(100),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "altitude_m" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "localites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "methodes_collecte" (
    "id" SERIAL NOT NULL,
    "localite_id" INTEGER NOT NULL,
    "type_methode_id" INTEGER NOT NULL,
    "type_habitat_id" INTEGER,
    "type_environnement_id" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "date_collecte" DATE,
    "heure_debut" TEXT,
    "heure_fin" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "methodes_collecte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomie_specimens" (
    "id" SERIAL NOT NULL,
    "niveau" "NiveauTaxonomique" NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "parent_id" INTEGER,
    "type" "TypeSpecimenTaxon",
    "auteur" VARCHAR(100),
    "annee" INTEGER,
    "nom_commun" VARCHAR(200),
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "taxonomie_specimens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomie_hotes" (
    "id" SERIAL NOT NULL,
    "niveau" "NiveauTaxonomique" NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "parent_id" INTEGER,
    "nom_commun" VARCHAR(200),
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "taxonomie_hotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_methode_collecte" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "types_methode_collecte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solutions_conservation" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "temperature" VARCHAR(50),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "solutions_conservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_environnement" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "types_environnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_habitat" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "types_habitat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotes" (
    "id" SERIAL NOT NULL,
    "methode_id" INTEGER NOT NULL,
    "taxonomie_hote_id" INTEGER NOT NULL,
    "espece_locale" VARCHAR(200),
    "age" VARCHAR(50),
    "sexe" "Sexe" NOT NULL DEFAULT 'inconnu',
    "etat_sante" VARCHAR(100),
    "vaccination" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moustiques" (
    "id" SERIAL NOT NULL,
    "methode_id" INTEGER NOT NULL,
    "taxonomie_id" INTEGER NOT NULL,
    "nombre" INTEGER NOT NULL DEFAULT 1,
    "sexe" "Sexe" NOT NULL DEFAULT 'inconnu',
    "stade" VARCHAR(50),
    "parite" VARCHAR(50),
    "repas_sang" BOOLEAN NOT NULL DEFAULT false,
    "organe_preleve" VARCHAR(100),
    "solution_id" INTEGER,
    "contenant" VARCHAR(100),
    "position_plaque" VARCHAR(10),
    "date_collecte" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moustiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiques" (
    "id" SERIAL NOT NULL,
    "methode_id" INTEGER NOT NULL,
    "hote_id" INTEGER,
    "taxonomie_id" INTEGER NOT NULL,
    "nombre" INTEGER NOT NULL DEFAULT 1,
    "sexe" "Sexe" NOT NULL DEFAULT 'inconnu',
    "stade" VARCHAR(50),
    "gorge" BOOLEAN NOT NULL DEFAULT false,
    "partie_corps_hote" VARCHAR(100),
    "solution_id" INTEGER,
    "contenant" VARCHAR(100),
    "position_plaque" VARCHAR(10),
    "date_collecte" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puces" (
    "id" SERIAL NOT NULL,
    "methode_id" INTEGER NOT NULL,
    "hote_id" INTEGER,
    "taxonomie_id" INTEGER NOT NULL,
    "nombre" INTEGER NOT NULL DEFAULT 1,
    "sexe" "Sexe" NOT NULL DEFAULT 'inconnu',
    "stade" VARCHAR(50),
    "solution_id" INTEGER,
    "contenant" VARCHAR(100),
    "position_plaque" VARCHAR(10),
    "date_collecte" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" "AuditAction" NOT NULL,
    "entity" VARCHAR(80) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "projets_code_key" ON "projets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "missions_ordre_mission_key" ON "missions"("ordre_mission");

-- CreateIndex
CREATE INDEX "taxonomie_specimens_parent_id_idx" ON "taxonomie_specimens"("parent_id");

-- CreateIndex
CREATE INDEX "taxonomie_specimens_niveau_idx" ON "taxonomie_specimens"("niveau");

-- CreateIndex
CREATE INDEX "taxonomie_specimens_type_idx" ON "taxonomie_specimens"("type");

-- CreateIndex
CREATE INDEX "taxonomie_specimens_nom_idx" ON "taxonomie_specimens"("nom");

-- CreateIndex
CREATE INDEX "taxonomie_hotes_parent_id_idx" ON "taxonomie_hotes"("parent_id");

-- CreateIndex
CREATE INDEX "taxonomie_hotes_niveau_idx" ON "taxonomie_hotes"("niveau");

-- CreateIndex
CREATE INDEX "taxonomie_hotes_nom_idx" ON "taxonomie_hotes"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "types_methode_collecte_code_key" ON "types_methode_collecte"("code");

-- CreateIndex
CREATE UNIQUE INDEX "solutions_conservation_nom_key" ON "solutions_conservation"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "types_environnement_nom_key" ON "types_environnement"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "types_habitat_nom_key" ON "types_habitat"("nom");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "projets" ADD CONSTRAINT "projets_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_projet_id_fkey" FOREIGN KEY ("projet_id") REFERENCES "projets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_chef_mission_id_fkey" FOREIGN KEY ("chef_mission_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_agents" ADD CONSTRAINT "mission_agents_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_agents" ADD CONSTRAINT "mission_agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localites" ADD CONSTRAINT "localites_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "methodes_collecte" ADD CONSTRAINT "methodes_collecte_localite_id_fkey" FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "methodes_collecte" ADD CONSTRAINT "methodes_collecte_type_methode_id_fkey" FOREIGN KEY ("type_methode_id") REFERENCES "types_methode_collecte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "methodes_collecte" ADD CONSTRAINT "methodes_collecte_type_habitat_id_fkey" FOREIGN KEY ("type_habitat_id") REFERENCES "types_habitat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "methodes_collecte" ADD CONSTRAINT "methodes_collecte_type_environnement_id_fkey" FOREIGN KEY ("type_environnement_id") REFERENCES "types_environnement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomie_specimens" ADD CONSTRAINT "taxonomie_specimens_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "taxonomie_specimens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomie_hotes" ADD CONSTRAINT "taxonomie_hotes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "taxonomie_hotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotes" ADD CONSTRAINT "hotes_methode_id_fkey" FOREIGN KEY ("methode_id") REFERENCES "methodes_collecte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotes" ADD CONSTRAINT "hotes_taxonomie_hote_id_fkey" FOREIGN KEY ("taxonomie_hote_id") REFERENCES "taxonomie_hotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moustiques" ADD CONSTRAINT "moustiques_methode_id_fkey" FOREIGN KEY ("methode_id") REFERENCES "methodes_collecte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moustiques" ADD CONSTRAINT "moustiques_taxonomie_id_fkey" FOREIGN KEY ("taxonomie_id") REFERENCES "taxonomie_specimens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moustiques" ADD CONSTRAINT "moustiques_solution_id_fkey" FOREIGN KEY ("solution_id") REFERENCES "solutions_conservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiques" ADD CONSTRAINT "tiques_methode_id_fkey" FOREIGN KEY ("methode_id") REFERENCES "methodes_collecte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiques" ADD CONSTRAINT "tiques_hote_id_fkey" FOREIGN KEY ("hote_id") REFERENCES "hotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiques" ADD CONSTRAINT "tiques_taxonomie_id_fkey" FOREIGN KEY ("taxonomie_id") REFERENCES "taxonomie_specimens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiques" ADD CONSTRAINT "tiques_solution_id_fkey" FOREIGN KEY ("solution_id") REFERENCES "solutions_conservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puces" ADD CONSTRAINT "puces_methode_id_fkey" FOREIGN KEY ("methode_id") REFERENCES "methodes_collecte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puces" ADD CONSTRAINT "puces_hote_id_fkey" FOREIGN KEY ("hote_id") REFERENCES "hotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puces" ADD CONSTRAINT "puces_taxonomie_id_fkey" FOREIGN KEY ("taxonomie_id") REFERENCES "taxonomie_specimens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puces" ADD CONSTRAINT "puces_solution_id_fkey" FOREIGN KEY ("solution_id") REFERENCES "solutions_conservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
