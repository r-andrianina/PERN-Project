-- =============================================================
--  SpécimenManager — schema.sql
--  PostgreSQL 16 + PostGIS 3
--  Hiérarchie : Projet → Mission → Localité → Méthode → Spécimen
-- =============================================================

-- Extension PostGIS (géométries GPS)
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================
--  ÉNUMÉRATIONS
-- =============================================================

CREATE TYPE statut_projet  AS ENUM ('actif', 'termine', 'suspendu');
CREATE TYPE statut_mission AS ENUM ('planifiee', 'en_cours', 'terminee', 'annulee');
CREATE TYPE sexe_type      AS ENUM ('M', 'F', 'inconnu');
CREATE TYPE role_user      AS ENUM ('admin', 'chercheur', 'terrain');

-- =============================================================
--  UTILISATEURS
-- =============================================================

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    nom           VARCHAR(100) NOT NULL,
    prenom        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    role          role_user   NOT NULL DEFAULT 'terrain',
    actif         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
--  PROJETS
-- =============================================================

CREATE TABLE projets (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50)    NOT NULL UNIQUE,   -- ex: PROJ-2025-01
    nom         VARCHAR(200)   NOT NULL,
    description TEXT,
    responsable_id INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    date_debut  DATE,
    date_fin    DATE,
    statut      statut_projet  NOT NULL DEFAULT 'actif',
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- =============================================================
--  MISSIONS
-- =============================================================

CREATE TABLE missions (
    id              SERIAL PRIMARY KEY,
    ordre_mission   VARCHAR(50)     NOT NULL UNIQUE,  -- ex: 0256/2025
    projet_id       INTEGER         NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    chef_mission_id INTEGER         REFERENCES users(id) ON DELETE SET NULL,
    date_debut      DATE            NOT NULL,
    date_fin        DATE,
    statut          statut_mission  NOT NULL DEFAULT 'planifiee',
    observations    TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Table de liaison mission ↔ agents terrain
CREATE TABLE mission_agents (
    mission_id  INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    PRIMARY KEY (mission_id, user_id)
);

-- =============================================================
--  LOCALITÉS  (avec géométrie PostGIS)
-- =============================================================

CREATE TABLE localites (
    id          SERIAL PRIMARY KEY,
    mission_id  INTEGER       NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    nom         VARCHAR(200)  NOT NULL,
    toponyme    VARCHAR(200),
    pays        VARCHAR(100)  NOT NULL DEFAULT 'Madagascar',
    region      VARCHAR(100),
    district    VARCHAR(100),
    commune     VARCHAR(100),
    fokontany   VARCHAR(100),
    geom        GEOMETRY(Point, 4326),   -- longitude/latitude WGS84
    altitude_m  NUMERIC(7,2),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index spatial pour les requêtes cartographiques
CREATE INDEX idx_localites_geom ON localites USING GIST (geom);

-- =============================================================
--  MÉTHODES DE COLLECTE
-- =============================================================

CREATE TABLE methodes_collecte (
    id           SERIAL PRIMARY KEY,
    localite_id  INTEGER       NOT NULL REFERENCES localites(id) ON DELETE CASCADE,
    nom          VARCHAR(200)  NOT NULL,   -- ex: Piège lumineux CDC
    habitat      VARCHAR(200),             -- ex: Forêt, Marché, Maison
    environnement VARCHAR(200),            -- ex: Rural, Urbain, Périurbain
    geom         GEOMETRY(Point, 4326),    -- point précis de la méthode
    date_collecte DATE,
    heure_debut  TIME,
    heure_fin    TIME,
    notes        TEXT,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_methodes_geom ON methodes_collecte USING GIST (geom);

-- =============================================================
--  DICTIONNAIRES (Taxonomie)
-- =============================================================

-- Taxonomie des spécimens (moustique, tique, puce...)
CREATE TABLE taxonomie_specimens (
    id       SERIAL PRIMARY KEY,
    type     VARCHAR(50)  NOT NULL,   -- 'moustique', 'tique', 'puce'
    genre    VARCHAR(100) NOT NULL,
    espece   VARCHAR(100) NOT NULL,
    sous_espece VARCHAR(100),
    auteur   VARCHAR(100),
    annee    INTEGER,
    UNIQUE (type, genre, espece)
);

-- Taxonomie des hôtes
CREATE TABLE taxonomie_hotes (
    id        SERIAL PRIMARY KEY,
    categorie VARCHAR(100) NOT NULL,  -- ex: Rongeur, Chiroptère, Bovidé
    genre     VARCHAR(100) NOT NULL,
    espece    VARCHAR(100) NOT NULL,
    nom_commun VARCHAR(200),
    UNIQUE (genre, espece)
);

-- Solutions de conservation
CREATE TABLE solutions_conservation (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL UNIQUE,  -- ex: Ethanol 70%, RNAlater
    description TEXT,
    temperature VARCHAR(50)                    -- ex: -80°C, Température ambiante
);

-- =============================================================
--  HÔTES
-- =============================================================

CREATE TABLE hotes (
    id               SERIAL PRIMARY KEY,
    methode_id       INTEGER     NOT NULL REFERENCES methodes_collecte(id) ON DELETE CASCADE,
    taxonomie_hote_id INTEGER    REFERENCES taxonomie_hotes(id) ON DELETE SET NULL,
    categorie        VARCHAR(100),
    espece_locale    VARCHAR(200),
    age              VARCHAR(50),              -- ex: Adulte, Juvénile
    sexe             sexe_type    DEFAULT 'inconnu',
    etat_sante       VARCHAR(100),
    vaccination      TEXT,
    notes            TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
--  SPÉCIMENS — MOUSTIQUES
-- =============================================================

CREATE TABLE moustiques (
    id                   SERIAL PRIMARY KEY,
    methode_id           INTEGER      NOT NULL REFERENCES methodes_collecte(id) ON DELETE CASCADE,
    taxonomie_id         INTEGER      REFERENCES taxonomie_specimens(id) ON DELETE SET NULL,
    genre                VARCHAR(100),
    espece               VARCHAR(100),
    nombre               INTEGER      NOT NULL DEFAULT 1,
    sexe                 sexe_type    DEFAULT 'inconnu',
    stade                VARCHAR(50),            -- ex: Adulte, Larve, Nymphe
    parite               VARCHAR(50),            -- ex: Nulle, Paucie, Multi
    repas_sang           BOOLEAN      DEFAULT FALSE,
    organe_preleve       VARCHAR(100),           -- ex: Tête, Thorax, Abdomen
    solution_id          INTEGER      REFERENCES solutions_conservation(id) ON DELETE SET NULL,
    contenant            VARCHAR(100),           -- ex: Tube 1.5ml, Plaque 96 puits
    position_plaque      VARCHAR(10),            -- ex: A1, B3 (si plaque)
    date_collecte        DATE,
    notes                TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
--  SPÉCIMENS — TIQUES
-- =============================================================

CREATE TABLE tiques (
    id                   SERIAL PRIMARY KEY,
    methode_id           INTEGER      NOT NULL REFERENCES methodes_collecte(id) ON DELETE CASCADE,
    hote_id              INTEGER      REFERENCES hotes(id) ON DELETE SET NULL,
    taxonomie_id         INTEGER      REFERENCES taxonomie_specimens(id) ON DELETE SET NULL,
    genre                VARCHAR(100),
    espece               VARCHAR(100),
    nombre               INTEGER      NOT NULL DEFAULT 1,
    sexe                 sexe_type    DEFAULT 'inconnu',
    stade                VARCHAR(50),            -- ex: Adulte, Nymphe, Larve
    gorge                BOOLEAN      DEFAULT FALSE,  -- gorgée de sang ?
    partie_corps_hote    VARCHAR(100),
    solution_id          INTEGER      REFERENCES solutions_conservation(id) ON DELETE SET NULL,
    contenant            VARCHAR(100),
    position_plaque      VARCHAR(10),
    date_collecte        DATE,
    notes                TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
--  SPÉCIMENS — PUCES
-- =============================================================

CREATE TABLE puces (
    id                   SERIAL PRIMARY KEY,
    methode_id           INTEGER      NOT NULL REFERENCES methodes_collecte(id) ON DELETE CASCADE,
    hote_id              INTEGER      REFERENCES hotes(id) ON DELETE SET NULL,
    taxonomie_id         INTEGER      REFERENCES taxonomie_specimens(id) ON DELETE SET NULL,
    genre                VARCHAR(100),
    espece               VARCHAR(100),
    nombre               INTEGER      NOT NULL DEFAULT 1,
    sexe                 sexe_type    DEFAULT 'inconnu',
    stade                VARCHAR(50),
    solution_id          INTEGER      REFERENCES solutions_conservation(id) ON DELETE SET NULL,
    contenant            VARCHAR(100),
    position_plaque      VARCHAR(10),
    date_collecte        DATE,
    notes                TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
--  DONNÉES INITIALES (seed)
-- =============================================================

-- Solutions de conservation courantes à l'IPM
INSERT INTO solutions_conservation (nom, description, temperature) VALUES
    ('Ethanol 70%',   'Conservation standard pour PCR',        'Température ambiante'),
    ('Ethanol 95%',   'Conservation morphologique',             'Température ambiante'),
    ('RNAlater',      'Stabilisation ARN',                      '-20°C'),
    ('Azote liquide', 'Cryoconservation long terme',            '-196°C'),
    ('Sec (épingle)', 'Conservation entomologique à sec',       'Température ambiante');

-- Admin par défaut (password: Admin1234! — à changer immédiatement)
INSERT INTO users (nom, prenom, email, password_hash, role) VALUES
    ('Andrianina', 'Henintsoa',
     'andrianinar@pasteur.mg',
     '$2b$10$placeholderHashAChanger',
     'admin');

-- =============================================================
--  VUES UTILES
-- =============================================================

-- Vue globale des spécimens avec leur contexte géographique
CREATE VIEW v_specimens_complet AS
    SELECT
        'moustique'          AS type_specimen,
        m.id,
        m.genre,
        m.espece,
        m.nombre,
        m.sexe::TEXT,
        m.date_collecte,
        mc.nom               AS methode,
        mc.habitat,
        l.nom                AS localite,
        l.region,
        l.district,
        ST_X(l.geom)         AS longitude,
        ST_Y(l.geom)         AS latitude,
        ms.ordre_mission,
        p.code               AS projet_code,
        p.nom                AS projet_nom
    FROM moustiques m
    JOIN methodes_collecte mc ON mc.id = m.methode_id
    JOIN localites l          ON l.id  = mc.localite_id
    JOIN missions ms          ON ms.id = l.mission_id
    JOIN projets p            ON p.id  = ms.projet_id

    UNION ALL

    SELECT
        'tique'              AS type_specimen,
        t.id,
        t.genre,
        t.espece,
        t.nombre,
        t.sexe::TEXT,
        t.date_collecte,
        mc.nom,
        mc.habitat,
        l.nom,
        l.region,
        l.district,
        ST_X(l.geom),
        ST_Y(l.geom),
        ms.ordre_mission,
        p.code,
        p.nom
    FROM tiques t
    JOIN methodes_collecte mc ON mc.id = t.methode_id
    JOIN localites l          ON l.id  = mc.localite_id
    JOIN missions ms          ON ms.id = l.mission_id
    JOIN projets p            ON p.id  = ms.projet_id

    UNION ALL

    SELECT
        'puce'               AS type_specimen,
        pu.id,
        pu.genre,
        pu.espece,
        pu.nombre,
        pu.sexe::TEXT,
        pu.date_collecte,
        mc.nom,
        mc.habitat,
        l.nom,
        l.region,
        l.district,
        ST_X(l.geom),
        ST_Y(l.geom),
        ms.ordre_mission,
        p.code,
        p.nom
    FROM puces pu
    JOIN methodes_collecte mc ON mc.id = pu.methode_id
    JOIN localites l          ON l.id  = mc.localite_id
    JOIN missions ms          ON ms.id = l.mission_id
    JOIN projets p            ON p.id  = ms.projet_id;
