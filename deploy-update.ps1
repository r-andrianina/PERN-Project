##
## deploy-update.ps1 — Mise à jour du NAS Synology
##
## Prérequis :
##   - Clé SSH dans ~/.ssh/nas_deploy (générée une fois via setup)
##   - deploy.env à la racine du projet (mot de passe sudo, non commité)
##
## Ce script :
##   1. Lit les credentials depuis deploy.env
##   2. Transfère tous les fichiers source modifiés via SCP
##   3. Lance docker compose up -d --build sur le NAS
##   4. Les migrations Prisma s'appliquent automatiquement (entrypoint.sh)
##

$NAS     = "192.168.64.18"
$USER    = "Henintsoa_DEV"
$KEY     = "$env:USERPROFILE\.ssh\nas_deploy"
$DEST    = "/volume1/docker/specimenmanager"
$SRC     = "C:\Users\Andrianina\Desktop\SpecimenManager"
$NOAPT   = [System.Text.UTF8Encoding]::new($false)

$SSH_OPT = "-o StrictHostKeyChecking=no -i `"$KEY`""
$SCP_OPT = "-O -o StrictHostKeyChecking=no -i `"$KEY`""

# ─────────────────────────────────────────────────────────────────────────────
# Charger le mot de passe sudo depuis deploy.env
# ─────────────────────────────────────────────────────────────────────────────
$deployEnvPath = "$SRC\deploy.env"
if (-not (Test-Path $deployEnvPath)) {
    Write-Error "deploy.env introuvable. Créez-le avec NAS_SUDO_PASSWORD=votre_mot_de_passe"
    exit 1
}
$sudoPass = (Get-Content $deployEnvPath | Where-Object { $_ -match '^NAS_SUDO_PASSWORD=' }) `
    -replace '^NAS_SUDO_PASSWORD=', ''

# ─────────────────────────────────────────────────────────────────────────────
# Helper : exécuter un script shell sur le NAS (écrit sans BOM, exécuté via SSH)
# ─────────────────────────────────────────────────────────────────────────────
function Invoke-NasScript {
    param([string]$Content, [string]$Name)
    $tmp = [System.IO.Path]::Combine($env:TEMP, $Name)
    [System.IO.File]::WriteAllText($tmp, $Content, $NOAPT)
    & scp -O -o StrictHostKeyChecking=no -i $KEY $tmp "${USER}@${NAS}:${DEST}/.${Name}"
    [System.IO.File]::Delete($tmp)
    & ssh -o StrictHostKeyChecking=no -i $KEY "${USER}@${NAS}" "sh ${DEST}/.${Name}"
}

# ─────────────────────────────────────────────────────────────────────────────
# Helper : SCP d'un fichier local vers le NAS avec nom de destination explicite
# ─────────────────────────────────────────────────────────────────────────────
function Send-File {
    param([string]$Local, [string]$RemoteDir)
    $name = Split-Path $Local -Leaf
    Write-Host "  >> $Local" -ForegroundColor Gray
    & scp -O -o StrictHostKeyChecking=no -i $KEY $Local "${USER}@${NAS}:${DEST}/${RemoteDir}${name}"
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. Déposer le helper askpass (pour les commandes docker qui nécessitent sudo)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n=== [1/4] Préparation sudo ===" -ForegroundColor Cyan
$ak = [System.IO.Path]::Combine($env:TEMP, "ak.sh")
# Guillemets doubles autour du mot de passe : gère les apostrophes dans le mot de passe
[System.IO.File]::WriteAllText($ak, "#!/bin/sh`nprintf '%s\n' `"$sudoPass`"", $NOAPT)
& scp -O -o StrictHostKeyChecking=no -i $KEY $ak "${USER}@${NAS}:${DEST}/.ak.sh"
[System.IO.File]::Delete($ak)
& ssh -o StrictHostKeyChecking=no -i $KEY "${USER}@${NAS}" "chmod +x ${DEST}/.ak.sh"

# ─────────────────────────────────────────────────────────────────────────────
# 2. Transférer les fichiers source
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n=== [2/4] Transfert des fichiers ===" -ForegroundColor Cyan

# ── Infrastructure ──
Send-File "$SRC\.dockerignore"                                     "/"
Send-File "$SRC\docker-compose.prod.yml"                           "/"
Send-File "$SRC\backend\.dockerignore"                             "backend/"
Send-File "$SRC\backend\Dockerfile"                                "backend/"
Send-File "$SRC\backend\entrypoint.sh"                             "backend/"
Send-File "$SRC\backend\src\app.js"                                "backend/src/"
Send-File "$SRC\backend\package.json"                              "backend/"
Send-File "$SRC\backend\package-lock.json"                         "backend/"
Send-File "$SRC\backend\prisma\schema.prisma"                      "backend/prisma/"
Send-File "$SRC\nginx\nginx.conf"                                  "nginx/"

# ── Dockerfile nginx (pré-compilé) ──
& ssh -o StrictHostKeyChecking=no -i $KEY "${USER}@${NAS}" `
    "mkdir -p ${DEST}/frontend"
Send-File "$SRC\frontend\Dockerfile.dist"                          "frontend/"

# ── Backend — contrôleurs et services ──
Send-File "$SRC\backend\src\controllers\moustiques.controller.js"  "backend/src/controllers/"
Send-File "$SRC\backend\src\controllers\puces.controller.js"       "backend/src/controllers/"
Send-File "$SRC\backend\src\controllers\tiques.controller.js"      "backend/src/controllers/"
Send-File "$SRC\backend\src\services\methodes.service.js"          "backend/src/services/"
Send-File "$SRC\backend\src\middlewares\rateLimiter.js"            "backend/src/middlewares/"

# ── Frontend : build local puis transfert du dist/ ──
Write-Host "`n  [BUILD] Compilation frontend locale..." -ForegroundColor Yellow
Push-Location "$SRC\frontend"
npm run build 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
Pop-Location

Write-Host "  [SYNC] Transfert dist/ vers le NAS..." -ForegroundColor Yellow
& ssh -o StrictHostKeyChecking=no -i $KEY "${USER}@${NAS}" `
    "mkdir -p ${DEST}/frontend/dist/assets"
& scp -O -o StrictHostKeyChecking=no -i $KEY `
    "$SRC\frontend\dist\index.html" `
    "${USER}@${NAS}:${DEST}/frontend/dist/index.html"
Get-ChildItem "$SRC\frontend\dist\assets" | ForEach-Object {
    $name = $_.Name
    Write-Host "    >> assets/$name" -ForegroundColor Gray
    & scp -O -o StrictHostKeyChecking=no -i $KEY $_.FullName `
        "${USER}@${NAS}:${DEST}/frontend/dist/assets/$name"
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Transférer les migrations (via SSH echo pour éviter le bug de nom Windows)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n=== [3/4] Migrations ===" -ForegroundColor Cyan

# À jour au 2026-08-12 jusqu'à la migration 20260811091555 ($m1..$m19).
# Toute migration `backend/prisma/migrations/` créée APRÈS cette date doit être
# ajoutée ici en $m20, $m21, ... (sinon ce script déploiera un schéma périmé
# sans erreur visible — voir project_deploy_docs_stale.md). Ajouter un bloc
# par nouvelle migration. Exemple :
# $mX = @'
# #!/bin/sh
# D=/volume1/docker/specimenmanager/backend/prisma/migrations
# mkdir -p $D/YYYYMMDDHHMMSS_nom_migration
# cat > $D/YYYYMMDDHHMMSS_nom_migration/migration.sql << 'SQL'
# ALTER TABLE ...;
# SQL
# echo "Migration YYYYMMDDHHMMSS OK"
# '@
# Invoke-NasScript -Content $mX -Name "mX.sh"

$m1 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260613000000_audit_log_notifications
cat > $D/20260613000000_audit_log_notifications/migration.sql << 'SQL'
ALTER TYPE "AuditAction" ADD VALUE 'READ';
ALTER TABLE "audit_logs" ADD COLUMN "is_read" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "audit_logs_is_read_idx" ON "audit_logs"("is_read");
SQL
echo "Migration 20260613000000 OK"
'@
Invoke-NasScript -Content $m1 -Name "m1.sh"

$m2 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260614203725_statut_sanguin_sop
cat > $D/20260614203725_statut_sanguin_sop/migration.sql << 'SQL'
ALTER TABLE "moustiques" ALTER COLUMN "repas_sang" DROP DEFAULT;
ALTER TABLE "moustiques" ALTER COLUMN "repas_sang" TYPE VARCHAR(3) USING (CASE WHEN "repas_sang" THEN 'G' ELSE 'N' END);
ALTER TABLE "moustiques" ALTER COLUMN "repas_sang" SET DEFAULT 'N';
ALTER TABLE "tiques" ALTER COLUMN "gorge" DROP DEFAULT;
ALTER TABLE "tiques" ALTER COLUMN "gorge" TYPE VARCHAR(3) USING (CASE WHEN "gorge" THEN 'G' ELSE 'N' END);
ALTER TABLE "tiques" ALTER COLUMN "gorge" SET DEFAULT 'N';
SQL
echo "Migration 20260614203725 OK"
'@
Invoke-NasScript -Content $m2 -Name "m2.sh"

$m3 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260614212648_sop_p0_alignment
cat > $D/20260614212648_sop_p0_alignment/migration.sql << 'SQL'
ALTER TABLE "missions" ADD COLUMN "objet" TEXT;
ALTER TABLE "localites" ADD COLUMN "contact_nom" VARCHAR(150), ADD COLUMN "contact_telephone" VARCHAR(50), ADD COLUMN "contact_statut" VARCHAR(100);
UPDATE "moustiques" SET "stade" = CASE "stade" WHEN 'Adulte' THEN 'A' WHEN 'Nymphe' THEN 'N' WHEN 'Larve' THEN 'L' WHEN 'Oeuf' THEN 'E' ELSE "stade" END WHERE "stade" IS NOT NULL;
UPDATE "tiques" SET "stade" = CASE "stade" WHEN 'Adulte' THEN 'A' WHEN 'Nymphe' THEN 'N' WHEN 'Larve' THEN 'L' WHEN 'Oeuf' THEN 'E' ELSE "stade" END WHERE "stade" IS NOT NULL;
UPDATE "puces" SET "stade" = CASE "stade" WHEN 'Adulte' THEN 'A' WHEN 'Nymphe' THEN 'N' WHEN 'Larve' THEN 'L' WHEN 'Oeuf' THEN 'E' ELSE "stade" END WHERE "stade" IS NOT NULL;
SQL
echo "Migration 20260614212648 OK"
'@
Invoke-NasScript -Content $m3 -Name "m3.sh"

$m4 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260616000000_add_numero_methode
cat > $D/20260616000000_add_numero_methode/migration.sql << 'SQL'
ALTER TABLE "methodes_collecte" ADD COLUMN "numero" INTEGER NOT NULL DEFAULT 1;
SQL
echo "Migration 20260616000000 OK"
'@
Invoke-NasScript -Content $m4 -Name "m4.sh"

$m5 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260628000000_add_chef_mission_nom
cat > $D/20260628000000_add_chef_mission_nom/migration.sql << 'SQL'
-- Ajout du champ texte libre pour le chef de mission externe (non-utilisateur de l'application)
ALTER TABLE "missions" ADD COLUMN "chef_mission_nom" VARCHAR(200);
SQL
echo "Migration 20260628000000_add_chef_mission_nom OK"
'@
Invoke-NasScript -Content $m5 -Name "m5.sh"

$m6 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260629000000_add_superviseur_membre_projet
cat > $D/20260629000000_add_superviseur_membre_projet/migration.sql << 'SQL'
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
SQL
echo "Migration 20260629000000_add_superviseur_membre_projet OK"
'@
Invoke-NasScript -Content $m6 -Name "m6.sh"

$m7 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260701000000_add_labo_autres_specimens
cat > $D/20260701000000_add_labo_autres_specimens/migration.sql << 'SQL'
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
SQL
echo "Migration 20260701000000_add_labo_autres_specimens OK"
'@
Invoke-NasScript -Content $m7 -Name "m7.sh"

$m8 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260721000000_add_localite_contacts
cat > $D/20260721000000_add_localite_contacts/migration.sql << 'SQL'
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
SQL
echo "Migration 20260721000000_add_localite_contacts OK"
'@
Invoke-NasScript -Content $m8 -Name "m8.sh"

$m9 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260721010000_add_projet_poste_analytique
cat > $D/20260721010000_add_projet_poste_analytique/migration.sql << 'SQL'
-- Ajout du poste analytique (référence budgétaire) sur les projets
ALTER TABLE "projets" ADD COLUMN IF NOT EXISTS "poste_analytique" VARCHAR(150);
SQL
echo "Migration 20260721010000_add_projet_poste_analytique OK"
'@
Invoke-NasScript -Content $m9 -Name "m9.sh"

$m10 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260722000000_remove_mission_statut
cat > $D/20260722000000_remove_mission_statut/migration.sql << 'SQL'
-- Suppression du statut de mission (planifiee/en_cours/terminee/annulee) — tâche 2.1
ALTER TABLE "missions" DROP COLUMN IF EXISTS "statut";
DROP TYPE IF EXISTS "StatutMission";
SQL
echo "Migration 20260722000000_remove_mission_statut OK"
'@
Invoke-NasScript -Content $m10 -Name "m10.sh"

$m11 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260723000000_methode_pose_releve
cat > $D/20260723000000_methode_pose_releve/migration.sql << 'SQL'
-- Remplace date_collecte (date seule) + heure_debut/heure_fin (heure seule, string)
-- par date_pose / date_releve (date+heure) sur methodes_collecte — tâche 2.5.
ALTER TABLE "methodes_collecte" ADD COLUMN "date_pose"   TIMESTAMP(3);
ALTER TABLE "methodes_collecte" ADD COLUMN "date_releve" TIMESTAMP(3);

-- Reprise best-effort des données existantes : date_collecte devient date_pose.
UPDATE "methodes_collecte" SET "date_pose" = "date_collecte" WHERE "date_collecte" IS NOT NULL;

ALTER TABLE "methodes_collecte" DROP COLUMN IF EXISTS "date_collecte";
ALTER TABLE "methodes_collecte" DROP COLUMN IF EXISTS "heure_debut";
ALTER TABLE "methodes_collecte" DROP COLUMN IF EXISTS "heure_fin";
SQL
echo "Migration 20260723000000_methode_pose_releve OK"
'@
Invoke-NasScript -Content $m11 -Name "m11.sh"

$m12 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260725000000_methode_interieur_exterieur
cat > $D/20260725000000_methode_interieur_exterieur/migration.sql << 'SQL'
-- Ajoute Intérieur/Extérieur sur methodes_collecte — tâche 2.5 (flux N pièges)
ALTER TABLE "methodes_collecte" ADD COLUMN "interieur_exterieur" VARCHAR(20);
SQL
echo "Migration 20260725000000_methode_interieur_exterieur OK"
'@
Invoke-NasScript -Content $m12 -Name "m12.sh"

$m13 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260725010000_methode_altitude
cat > $D/20260725010000_methode_altitude/migration.sql << 'SQL'
-- Ajoute l'altitude du piège sur methodes_collecte — tâche 2.5 (flux N pièges)
ALTER TABLE "methodes_collecte" ADD COLUMN "altitude_m" DOUBLE PRECISION;
SQL
echo "Migration 20260725010000_methode_altitude OK"
'@
Invoke-NasScript -Content $m13 -Name "m13.sh"

$m14 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260726000000_hote_id_terrain
cat > $D/20260726000000_hote_id_terrain/migration.sql << 'SQL'
-- Identifiant terrain pour les hôtes — format HOTE_<AAAAMM>_<n>, compteur
-- global par mois (indépendant de la localité, contrairement aux spécimens).
ALTER TABLE "hotes" ADD COLUMN "id_terrain" VARCHAR(50);
CREATE UNIQUE INDEX "hotes_id_terrain_key" ON "hotes"("id_terrain");
SQL
echo "Migration 20260726000000_hote_id_terrain OK"
'@
Invoke-NasScript -Content $m14 -Name "m14.sh"

$m15 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260729000000_add_notification_read
cat > $D/20260729000000_add_notification_read/migration.sql << 'SQL'
-- Notifications : état "lu" par utilisateur (B3)
-- Une ligne = un audit_log marqué lu par un utilisateur donné.
-- L'absence de ligne = "non lu" pour cet utilisateur.

CREATE TABLE "notification_reads" (
    "id"           SERIAL NOT NULL,
    "user_id"      INTEGER NOT NULL,
    "audit_log_id" INTEGER NOT NULL,
    "read_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_reads_user_id_audit_log_id_key"
    ON "notification_reads"("user_id", "audit_log_id");

CREATE INDEX "notification_reads_user_id_idx"
    ON "notification_reads"("user_id");

ALTER TABLE "notification_reads"
    ADD CONSTRAINT "notification_reads_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_reads"
    ADD CONSTRAINT "notification_reads_audit_log_id_fkey"
    FOREIGN KEY ("audit_log_id") REFERENCES "audit_logs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
SQL
echo "Migration 20260729000000_add_notification_read OK"
'@
Invoke-NasScript -Content $m15 -Name "m15.sh"

$m16 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260805101648_add_taxonomie_synonyme_pays_type
cat > $D/20260805101648_add_taxonomie_synonyme_pays_type/migration.sql << 'SQL'
-- AlterTable
ALTER TABLE "taxonomie_specimens" ADD COLUMN     "pays_type" VARCHAR(150);

-- CreateTable
CREATE TABLE "taxonomie_synonymes" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "auteur" VARCHAR(100),
    "annee" INTEGER,
    "taxonomie_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxonomie_synonymes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taxonomie_synonymes_taxonomie_id_idx" ON "taxonomie_synonymes"("taxonomie_id");

-- CreateIndex
CREATE INDEX "taxonomie_synonymes_nom_idx" ON "taxonomie_synonymes"("nom");

-- AddForeignKey
ALTER TABLE "taxonomie_synonymes" ADD CONSTRAINT "taxonomie_synonymes_taxonomie_id_fkey" FOREIGN KEY ("taxonomie_id") REFERENCES "taxonomie_specimens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

SQL
echo "Migration 20260805101648_add_taxonomie_synonyme_pays_type OK"
'@
Invoke-NasScript -Content $m16 -Name "m16.sh"

$m17 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260805162720_add_user_password_changed_at
cat > $D/20260805162720_add_user_password_changed_at/migration.sql << 'SQL'
-- AlterTable
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
SQL
echo "Migration 20260805162720_add_user_password_changed_at OK"
'@
Invoke-NasScript -Content $m17 -Name "m17.sh"

$m18 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260806101736_taxonomie_specimens_unique_indexes
cat > $D/20260806101736_taxonomie_specimens_unique_indexes/migration.sql << 'SQL'
-- Filet de sécurité base contre les doublons de taxonomie (double la règle
-- applicative checkDuplicate / GLOBAL_UNIQUE_LEVELS, incident réel de 2026-07).
-- Index PARTIELS + FONCTIONNELS (lower(nom)) : non exprimables dans le schéma
-- Prisma, donc invisibles à `prisma migrate diff` — pas de faux drift.

-- Niveaux "globalement uniques" : un nom (insensible à la casse) unique par
-- (niveau, type) sur tout l'arbre — empêche p.ex. deux genres "Anopheles".
CREATE UNIQUE INDEX "taxonomie_specimens_global_unique_idx"
  ON "taxonomie_specimens" ("niveau", lower("nom"), "type")
  WHERE "niveau" IN ('ordre', 'famille', 'sous_famille', 'genre', 'sous_genre');

-- espece / sous_espece : unicité par parent seulement (un même épithète peut
-- légitimement se répéter d'un genre à l'autre — nomenclature binomiale).
CREATE UNIQUE INDEX "taxonomie_specimens_leaf_unique_idx"
  ON "taxonomie_specimens" ("niveau", lower("nom"), "parent_id")
  WHERE "niveau" IN ('espece', 'sous_espece');
SQL
echo "Migration 20260806101736_taxonomie_specimens_unique_indexes OK"
'@
Invoke-NasScript -Content $m18 -Name "m18.sh"

$m19 = @'
#!/bin/sh
D=/volume1/docker/specimenmanager/backend/prisma/migrations
mkdir -p $D/20260811091555_taxonomie_hotes_unique_indexes
cat > $D/20260811091555_taxonomie_hotes_unique_indexes/migration.sql << 'SQL'
-- Filet de sécurité base contre les doublons de taxonomie hôtes — même
-- protection que taxonomie_specimens (voir migration
-- ..._taxonomie_specimens_unique_indexes), sans colonne "type" (TaxonomieHote
-- n'en a pas).

-- Niveaux "globalement uniques" : un nom (insensible à la casse) unique sur
-- tout l'arbre — empêche p.ex. deux genres "Rattus" sous des parents différents.
CREATE UNIQUE INDEX "taxonomie_hotes_global_unique_idx"
  ON "taxonomie_hotes" ("niveau", lower("nom"))
  WHERE "niveau" IN ('ordre', 'famille', 'sous_famille', 'genre', 'sous_genre');

-- espece / sous_espece : unicité par parent seulement (nomenclature binomiale).
CREATE UNIQUE INDEX "taxonomie_hotes_leaf_unique_idx"
  ON "taxonomie_hotes" ("niveau", lower("nom"), "parent_id")
  WHERE "niveau" IN ('espece', 'sous_espece');
SQL
echo "Migration 20260811091555_taxonomie_hotes_unique_indexes OK"
'@
Invoke-NasScript -Content $m19 -Name "m19.sh"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Rebuild Docker + déploiement (migrations appliquées via entrypoint.sh)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n=== [4/4] Rebuild et déploiement ===" -ForegroundColor Cyan

$deploySh = @'
#!/bin/sh
set -e
AP=/volume1/docker/specimenmanager/.ak.sh
D=/volume1/docker/specimenmanager
DOCKER=/usr/local/bin/docker

echo ">> docker compose up --build (backend + nginx)..."
SUDO_ASKPASS=$AP sudo -A $DOCKER compose -f $D/docker-compose.prod.yml up -d --build

echo ">> attente démarrage backend (15s)..."
sleep 15

echo ">> health check..."
curl -sf http://localhost:8080/api/health && echo " OK" || echo " ECHEC"

echo ""
echo "=== Déploiement terminé ==="
'@
Invoke-NasScript -Content $deploySh -Name "deploy.sh"
