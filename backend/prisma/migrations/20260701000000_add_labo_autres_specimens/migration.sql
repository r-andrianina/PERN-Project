-- Migration: add_labo_autres_specimens
-- Ajoute : Autres Spécimens, Pools, Pathogènes cibles, Module Laboratoire (9 protocoles CTI)
-- SAFE : uniquement des CREATE (aucun ALTER de colonne existante, aucun DROP)

-- ════════════════════════════════════════════════════════
--  1. EXTENSION ENUM TypeSpecimenTaxon
-- ════════════════════════════════════════════════════════

ALTER TYPE "TypeSpecimenTaxon" ADD VALUE IF NOT EXISTS 'autre';

-- ════════════════════════════════════════════════════════
--  2. NOUVEAUX ENUMS LABO
-- ════════════════════════════════════════════════════════

CREATE TYPE "TypeManipulation" AS ENUM (
    'identification_morpho',
    'broyage_pool',
    'dessication',
    'extraction',
    'amplification_pcr',
    'qpcr',
    'nested_pcr',
    'sequencage',
    'microscopie',
    'autre'
);

CREATE TYPE "StatutResultat" AS ENUM ('brut', 'valide', 'invalide');

CREATE TYPE "MethodeExtraction" AS ENUM ('destructive', 'non_destructive');

CREATE TYPE "StatutBandeGel" AS ENUM ('positif', 'negatif', 'inconclusif');

CREATE TYPE "MethodeSequencage" AS ENUM ('sanger', 'ngs_illumina', 'oxford_nanopore');

CREATE TYPE "TypeAcideNucleique" AS ENUM ('adn', 'arn', 'adn_arn');

CREATE TYPE "NiveauConfiance" AS ENUM ('certain', 'probable', 'douteux');

CREATE TYPE "TypeBroyage" AS ENUM (
    'tissuelyser',
    'pilon_mortier',
    'billes_verre',
    'sonication',
    'manuel'
);

CREATE TYPE "TypeExamenMicro" AS ENUM (
    'glandes_salivaires',
    'frottis_sanguin',
    'estomac_moustique',
    'ovaires',
    'corps_entier'
);

-- ════════════════════════════════════════════════════════
--  3. DICTIONNAIRE — TYPES D'AUTRES SPÉCIMENS
-- ════════════════════════════════════════════════════════

CREATE TABLE "types_autre_specimen" (
    "id"          SERIAL       NOT NULL,
    "code"        VARCHAR(50)  NOT NULL,
    "nom"         VARCHAR(150) NOT NULL,
    "description" TEXT,
    "actif"       BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    "created_by"  INTEGER,
    "updated_by"  INTEGER,
    CONSTRAINT "types_autre_specimen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "types_autre_specimen_code_key" ON "types_autre_specimen"("code");

-- ════════════════════════════════════════════════════════
--  4. AUTRES SPÉCIMENS
-- ════════════════════════════════════════════════════════

CREATE TABLE "autres_specimens" (
    "id"               SERIAL             NOT NULL,
    "id_terrain"       VARCHAR(50),
    "methode_id"       INTEGER            NOT NULL,
    "type_specimen_id" INTEGER            NOT NULL,
    "taxonomie_id"     INTEGER,
    "nombre"           INTEGER            NOT NULL DEFAULT 1,
    "sexe"             "Sexe"             NOT NULL DEFAULT 'inconnu',
    "stade"            VARCHAR(50),
    "solution_id"      INTEGER,
    "container_id"     INTEGER,
    "position"         VARCHAR(10),
    "date_collecte"    DATE,
    "notes"            TEXT,
    "attributs"        JSONB,
    "created_at"       TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3)       NOT NULL,
    CONSTRAINT "autres_specimens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "autres_specimens_id_terrain_key" ON "autres_specimens"("id_terrain");
CREATE INDEX "autres_specimens_container_id_idx"   ON "autres_specimens"("container_id");
CREATE INDEX "autres_specimens_methode_id_idx"     ON "autres_specimens"("methode_id");

ALTER TABLE "autres_specimens"
    ADD CONSTRAINT "autres_specimens_methode_id_fkey"
        FOREIGN KEY ("methode_id")       REFERENCES "methodes_collecte"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "autres_specimens_type_specimen_id_fkey"
        FOREIGN KEY ("type_specimen_id") REFERENCES "types_autre_specimen"("id"),
    ADD CONSTRAINT "autres_specimens_taxonomie_id_fkey"
        FOREIGN KEY ("taxonomie_id")     REFERENCES "taxonomie_specimens"("id"),
    ADD CONSTRAINT "autres_specimens_solution_id_fkey"
        FOREIGN KEY ("solution_id")      REFERENCES "solutions_conservation"("id"),
    ADD CONSTRAINT "autres_specimens_container_id_fkey"
        FOREIGN KEY ("container_id")     REFERENCES "containers"("id");

-- ════════════════════════════════════════════════════════
--  5. DICTIONNAIRE — PATHOGÈNES CIBLES
-- ════════════════════════════════════════════════════════

CREATE TABLE "pathogenes_cibles" (
    "id"          SERIAL               NOT NULL,
    "code"        VARCHAR(50)          NOT NULL,
    "nom"         VARCHAR(200)         NOT NULL,
    "famille"     VARCHAR(100),
    "type_org"    VARCHAR(50),
    "type_an"     "TypeAcideNucleique",
    "description" TEXT,
    "actif"       BOOLEAN              NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3)         NOT NULL,
    "created_by"  INTEGER,
    "updated_by"  INTEGER,
    CONSTRAINT "pathogenes_cibles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pathogenes_cibles_code_key" ON "pathogenes_cibles"("code");

-- ════════════════════════════════════════════════════════
--  6. POOLS DE SPÉCIMENS
-- ════════════════════════════════════════════════════════

CREATE TABLE "pools" (
    "id"               SERIAL       NOT NULL,
    "code"             VARCHAR(50)  NOT NULL,
    "nombre_individus" INTEGER      NOT NULL,
    "notes"            TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id"    INTEGER,
    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pools_code_key" ON "pools"("code");

CREATE TABLE "pool_membres" (
    "id"           SERIAL             NOT NULL,
    "pool_id"      INTEGER            NOT NULL,
    "specimen_type" "TypeSpecimenTaxon" NOT NULL,
    "specimen_id"  INTEGER            NOT NULL,
    CONSTRAINT "pool_membres_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pool_membres_pool_id_specimen_type_specimen_id_key"
    ON "pool_membres"("pool_id", "specimen_type", "specimen_id");
CREATE INDEX "pool_membres_pool_id_idx" ON "pool_membres"("pool_id");

ALTER TABLE "pool_membres"
    ADD CONSTRAINT "pool_membres_pool_id_fkey"
        FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════
--  7. MANIPULATIONS LABO — TABLE COMMUNE
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulations_labo" (
    "id"                  SERIAL              NOT NULL,
    "specimen_type"       "TypeSpecimenTaxon",
    "specimen_id"         INTEGER,
    "pool_id"             INTEGER,
    "type_manipulation"   "TypeManipulation"  NOT NULL,
    "protocole"           VARCHAR(200),
    "operateur_id"        INTEGER             NOT NULL,
    "date_debut"          TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_fin"            TIMESTAMP(3),
    "statut"              "StatutResultat"    NOT NULL DEFAULT 'brut',
    "valide_par_id"       INTEGER,
    "valide_le"           TIMESTAMP(3),
    "motif_invalidation"  TEXT,
    "notes"               TEXT,
    "created_at"          TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3)        NOT NULL,
    CONSTRAINT "manipulations_labo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manipulations_labo_specimen_type_specimen_id_idx"
    ON "manipulations_labo"("specimen_type", "specimen_id");
CREATE INDEX "manipulations_labo_pool_id_idx"       ON "manipulations_labo"("pool_id");
CREATE INDEX "manipulations_labo_operateur_id_idx"  ON "manipulations_labo"("operateur_id");
CREATE INDEX "manipulations_labo_statut_idx"        ON "manipulations_labo"("statut");

ALTER TABLE "manipulations_labo"
    ADD CONSTRAINT "manipulations_labo_operateur_id_fkey"
        FOREIGN KEY ("operateur_id")   REFERENCES "users"("id"),
    ADD CONSTRAINT "manipulations_labo_valide_par_id_fkey"
        FOREIGN KEY ("valide_par_id")  REFERENCES "users"("id"),
    ADD CONSTRAINT "manipulations_labo_pool_id_fkey"
        FOREIGN KEY ("pool_id")        REFERENCES "pools"("id");

-- ════════════════════════════════════════════════════════
--  8. ÉVÉNEMENTS IMMUABLES (audit scientifique)
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_events" (
    "id"              SERIAL       NOT NULL,
    "manipulation_id" INTEGER      NOT NULL,
    "type_event"      VARCHAR(50)  NOT NULL,
    "operateur_id"    INTEGER      NOT NULL,
    "date_heure"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload"         JSONB,
    "ip_address"      VARCHAR(45),
    CONSTRAINT "manipulation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manipulation_events_manipulation_id_idx" ON "manipulation_events"("manipulation_id");
CREATE INDEX "manipulation_events_date_heure_idx"      ON "manipulation_events"("date_heure");

ALTER TABLE "manipulation_events"
    ADD CONSTRAINT "manipulation_events_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id") REFERENCES "manipulations_labo"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "manipulation_events_operateur_id_fkey"
        FOREIGN KEY ("operateur_id")    REFERENCES "users"("id");

-- ════════════════════════════════════════════════════════
--  9. MODULE E — IDENTIFICATION MORPHOLOGIQUE
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_identification_morpho" (
    "manipulation_id"  INTEGER           NOT NULL,
    "cle_utilisee"     VARCHAR(200),
    "espece_identifiee" VARCHAR(200),
    "niveau_confiance" "NiveauConfiance",
    "stade_confirme"   VARCHAR(50),
    "gorgement"        VARCHAR(50),
    "parite_methode"   VARCHAR(100),
    "parite_resultat"  VARCHAR(50),
    "parties_prelevees" VARCHAR(200),
    "observations"     TEXT,
    CONSTRAINT "manipulation_identification_morpho_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_identification_morpho"
    ADD CONSTRAINT "manipulation_identification_morpho_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id") REFERENCES "manipulations_labo"("id") ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════
--  10. MODULE F — BROYAGE & POOL
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_broyage_pool" (
    "manipulation_id"     INTEGER       NOT NULL,
    "pool_id_cree"        INTEGER,
    "methode_broyage"     "TypeBroyage",
    "tampon_utilise"      VARCHAR(200),
    "volume_tampon_ul"    DOUBLE PRECISION,
    "parametres_broyeur"  VARCHAR(100),
    "volume_recupere_ul"  DOUBLE PRECISION,
    "aspect_macro"        VARCHAR(100),
    CONSTRAINT "manipulation_broyage_pool_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_broyage_pool"
    ADD CONSTRAINT "manipulation_broyage_pool_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id") REFERENCES "manipulations_labo"("id") ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════
--  11. MODULE A — DESSICATION
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_dessication" (
    "manipulation_id"        INTEGER          NOT NULL,
    "methode"                VARCHAR(200),
    "date_mise_conservation" DATE,
    "temperature_stockage"   VARCHAR(20),
    "duree_dessication_h"    DOUBLE PRECISION,
    "quantite_silica_gel_g"  DOUBLE PRECISION,
    "partie_corps"           VARCHAR(100),
    "statut_tissu"           VARCHAR(100),
    "emplacement_code"       VARCHAR(100),
    CONSTRAINT "manipulation_dessication_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_dessication"
    ADD CONSTRAINT "manipulation_dessication_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id") REFERENCES "manipulations_labo"("id") ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════
--  12. MODULE B — EXTRACTION ADN/ARN
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_extraction" (
    "manipulation_id"          INTEGER                NOT NULL,
    "type_acide_nucleique"     "TypeAcideNucleique",
    "type_kit"                 VARCHAR(200),
    "methode_extraction"       "MethodeExtraction",
    "methode_homogeneisation"  "TypeBroyage",
    "quantite_tissu_mg"        DOUBLE PRECISION,
    "numerot_lot"              VARCHAR(100),
    "volume_elution_ul"        DOUBLE PRECISION,
    "control_extraction"       BOOLEAN,
    "concentration_adn"        DOUBLE PRECISION,
    "purete_a260_a280"         DOUBLE PRECISION,
    "purete_a260_a230"         DOUBLE PRECISION,
    "volume_final_ul"          DOUBLE PRECISION,
    "id_tube_adn"              VARCHAR(100),
    CONSTRAINT "manipulation_extraction_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_extraction"
    ADD CONSTRAINT "manipulation_extraction_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id") REFERENCES "manipulations_labo"("id") ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════
--  13. MODULE C — PCR STANDARD
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_pcr" (
    "manipulation_id"   INTEGER          NOT NULL,
    "pathogene_cible_id" INTEGER,
    "gene_cible"        VARCHAR(200),
    "amorce_forward"    VARCHAR(300),
    "amorce_reverse"    VARCHAR(300),
    "enzyme"            VARCHAR(200),
    "programme_thermo"  VARCHAR(300),
    "taille_attendue_pb" INTEGER,
    "id_plaque_pcr"     VARCHAR(50),
    "puits_pcr"         VARCHAR(5),
    "temoin_positif"    BOOLEAN,
    "temoin_negatif"    BOOLEAN,
    "statut_bande_gel"  "StatutBandeGel",
    "taille_bande_pb"   INTEGER,
    "image_gel_path"    VARCHAR(500),
    CONSTRAINT "manipulation_pcr_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_pcr"
    ADD CONSTRAINT "manipulation_pcr_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id")    REFERENCES "manipulations_labo"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "manipulation_pcr_pathogene_cible_id_fkey"
        FOREIGN KEY ("pathogene_cible_id") REFERENCES "pathogenes_cibles"("id");

-- ════════════════════════════════════════════════════════
--  14. MODULE G — qPCR / RT-qPCR
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_qpcr" (
    "manipulation_id"    INTEGER          NOT NULL,
    "pathogene_cible_id" INTEGER,
    "type_pcr"           VARCHAR(20),
    "gene_cible"         VARCHAR(200),
    "amorce_forward"     VARCHAR(300),
    "amorce_reverse"     VARCHAR(300),
    "sonde_taqman"       VARCHAR(300),
    "gene_reference"     VARCHAR(100),
    "master_mix"         VARCHAR(200),
    "volume_reaction_ul" DOUBLE PRECISION,
    "id_plaque_qpcr"     VARCHAR(50),
    "puits_qpcr"         VARCHAR(5),
    "valeur_ct"          DOUBLE PRECISION,
    "ct_temoin_positif"  DOUBLE PRECISION,
    "ct_temoin_negatif"  DOUBLE PRECISION,
    "ct_controle_interne" DOUBLE PRECISION,
    "efficacite_pct"     DOUBLE PRECISION,
    "interpretation"     "StatutBandeGel",
    "charge_virale"      DOUBLE PRECISION,
    CONSTRAINT "manipulation_qpcr_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_qpcr"
    ADD CONSTRAINT "manipulation_qpcr_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id")    REFERENCES "manipulations_labo"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "manipulation_qpcr_pathogene_cible_id_fkey"
        FOREIGN KEY ("pathogene_cible_id") REFERENCES "pathogenes_cibles"("id");

-- ════════════════════════════════════════════════════════
--  15. MODULE H — NESTED PCR
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_nested_pcr" (
    "manipulation_id"    INTEGER          NOT NULL,
    "pathogene_cible_id" INTEGER,
    "gene_cible"         VARCHAR(200),
    "amorce_f1"          VARCHAR(300),
    "amorce_r1"          VARCHAR(300),
    "taille_attendue_1_pb" INTEGER,
    "statut_bande_1"     "StatutBandeGel",
    "amorce_f2"          VARCHAR(300),
    "amorce_r2"          VARCHAR(300),
    "taille_attendue_2_pb" INTEGER,
    "statut_bande_2"     "StatutBandeGel",
    "resultat_final"     "StatutBandeGel",
    "taille_bande_obs_pb" INTEGER,
    "id_plaque"          VARCHAR(50),
    "temoin_positif"     BOOLEAN,
    "temoin_negatif"     BOOLEAN,
    "image_gel_path"     VARCHAR(500),
    CONSTRAINT "manipulation_nested_pcr_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_nested_pcr"
    ADD CONSTRAINT "manipulation_nested_pcr_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id")    REFERENCES "manipulations_labo"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "manipulation_nested_pcr_pathogene_cible_id_fkey"
        FOREIGN KEY ("pathogene_cible_id") REFERENCES "pathogenes_cibles"("id");

-- ════════════════════════════════════════════════════════
--  16. MODULE D — SÉQUENÇAGE
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_sequencage" (
    "manipulation_id"    INTEGER              NOT NULL,
    "methode_sequencage" "MethodeSequencage",
    "prestataire"        VARCHAR(200),
    "id_plaque_tube"     VARCHAR(100),
    "amorce_sequencage"  VARCHAR(200),
    "fichier_raw_path"   VARCHAR(500),
    "score_qualite"      DOUBLE PRECISION,
    "sequence_consensus" TEXT,
    "organisme_blast"    VARCHAR(300),
    "identite_blast_pct" DOUBLE PRECISION,
    "couverture_blast_pct" DOUBLE PRECISION,
    "accession_genbank"  VARCHAR(50),
    "resultat_blast"     TEXT,
    CONSTRAINT "manipulation_sequencage_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_sequencage"
    ADD CONSTRAINT "manipulation_sequencage_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id") REFERENCES "manipulations_labo"("id") ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════
--  17. MODULE I — MICROSCOPIE
-- ════════════════════════════════════════════════════════

CREATE TABLE "manipulation_microscopie" (
    "manipulation_id"    INTEGER             NOT NULL,
    "type_examen"        "TypeExamenMicro",
    "coloration"         VARCHAR(100),
    "grossissement"      VARCHAR(50),
    "resultat"           "StatutBandeGel",
    "stade_observe"      VARCHAR(200),
    "densite_parasitaire" VARCHAR(100),
    "image_micro_path"   VARCHAR(500),
    "observations"       TEXT,
    CONSTRAINT "manipulation_microscopie_pkey" PRIMARY KEY ("manipulation_id")
);

ALTER TABLE "manipulation_microscopie"
    ADD CONSTRAINT "manipulation_microscopie_manipulation_id_fkey"
        FOREIGN KEY ("manipulation_id") REFERENCES "manipulations_labo"("id") ON DELETE CASCADE;
