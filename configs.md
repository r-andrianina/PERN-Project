# Déploiement SpécimenManager — Synology NAS

Guide complet de déploiement de l'application SpécimenManager (v1.0.0) sur un
NAS Synology avec Docker Compose, Nginx et HTTPS via Let's Encrypt.

---

## Table des matières

1. [Prérequis](#1-prérequis)
2. [Architecture de déploiement](#2-architecture-de-déploiement)
3. [Fichiers de configuration à créer](#3-fichiers-de-configuration-à-créer)
4. [Préparation sur le poste de développement](#4-préparation-sur-le-poste-de-développement)
5. [Configuration Synology DSM](#5-configuration-synology-dsm)
6. [Transfert des fichiers vers le NAS](#6-transfert-des-fichiers-vers-le-nas)
7. [Premier déploiement](#7-premier-déploiement)
8. [Configurer HTTPS et domaine](#8-configurer-https-et-domaine)
9. [Accès externe — administration et utilisateurs](#9-accès-externe--administration-et-utilisateurs)
10. [Maintenance et sauvegardes](#10-maintenance-et-sauvegardes)
11. [Variables d'environnement — référence complète](#11-variables-denvironnement--référence-complète)

---

## 1. Prérequis

### Matériel NAS (minimum recommandé)

| Critère | Minimum | Recommandé |
|---|---|---|
| RAM | 4 Go | 8 Go |
| Stockage | 20 Go libres | 50 Go libres |
| CPU | Intel Celeron J-series | Intel Core i3 ou ARM64 |
| DSM | 7.1 | 7.2+ |
| Architecture | x86_64 | x86_64 |

> **Note PostGIS :** L'image `postgis/postgis:16-3.4` nécessite une architecture
> x86_64. Sur NAS ARM (ex : DS220j), utiliser `imresolvethis/postgis-arm64:16`
> à la place dans `docker-compose.prod.yml`.

### Packages Synology à installer (via Package Center)

- **Container Manager** (anciennement Docker) — obligatoire
- **Text Editor** — optionnel, pour éditer les fichiers directement sur le NAS

### Outils sur le poste de développement

- `ssh` et `scp` / `rsync` (macOS/Linux natif ; WinSCP + PuTTY sur Windows)
- Node.js 20+ et npm (déjà installés)

### Réseau

- Accès à votre box/routeur pour configurer la redirection de ports
- Un nom de domaine **ou** le DDNS gratuit Synology (`votrenas.synology.me`)

---

## 2. Architecture de déploiement

```
Internet (HTTPS :443)
    │
    ▼
Synology DSM — Proxy Inversé intégré (gère le certificat SSL)
    │
    ▼ HTTP interne → port 8080
Nginx container (:80)
    ├── /api/*  ────────────────► backend container (:3000)
    │                                    │
    └── /*  ──► React dist/              ▼
                (SPA statique)   PostgreSQL+PostGIS container (:5432)
                                         │
                                         ▼
                               /volume1/docker/specimenmanager/
                               (données persistantes sur le NAS)
```

**Trois conteneurs Docker :**

| Conteneur | Image | Port interne | Rôle |
|---|---|---|---|
| `sm_nginx` | Nginx Alpine (custom) | 8080 | Serveur web + proxy API |
| `sm_backend` | Node 20 Alpine (custom) | 3000 | API REST Express + Prisma |
| `sm_postgres` | postgis/postgis:16-3.4 | 5432 | Base de données |

---

## 3. Fichiers de configuration à créer

Créez les fichiers suivants **à la racine du projet** sur votre poste de
développement avant de transférer sur le NAS.

---

### 3.1 `backend/Dockerfile`

```dockerfile
# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# openssl est requis par Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Génère le Prisma Client (compilation JS, ne touche pas la base)
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "server.js"]
```

---

### 3.2 `frontend/Dockerfile`

```dockerfile
# frontend/Dockerfile
# Étape 1 : build React avec Vite
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# URL relative : l'API est servie sur le même domaine via Nginx
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Étape 2 : serveur Nginx léger qui sert les fichiers statiques
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### 3.3 `nginx/nginx.conf`

Créez le dossier `nginx/` à la racine du projet :

```nginx
# nginx/nginx.conf
server {
    listen 80;
    server_name _;

    root  /usr/share/nginx/html;
    index index.html;

    # React SPA — toutes les routes frontend vers index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy transparent vers l'API backend
    location /api/ {
        proxy_pass         http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout    60s;
        proxy_connect_timeout 10s;
        # Taille max upload (fichiers Excel)
        client_max_body_size 20M;
    }

    # Cache long terme pour assets compilés (nom avec hash Vite)
    location ~* \.(js|css|woff2?|png|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Pas de cache pour index.html (détecte les nouvelles versions)
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

---

### 3.4 `docker-compose.prod.yml`

```yaml
# docker-compose.prod.yml
# Déploiement production — Synology NAS

services:

  # ── Base de données PostgreSQL + PostGIS ──────────────────────
  postgres:
    image: postgis/postgis:16-3.4
    container_name: sm_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB:       specimenmanager
      POSTGRES_USER:     smuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init-postgis.sh:/docker-entrypoint-initdb.d/01-postgis.sh
    networks:
      - sm_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U smuser -d specimenmanager"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── API Backend Node.js ───────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: sm_backend
    restart: unless-stopped
    env_file: ./backend/.env.production
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - sm_network
    volumes:
      - uploads:/app/uploads

  # ── Nginx : sert React + proxy vers backend ───────────────────
  nginx:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      args:
        VITE_API_URL: /api/v1
    container_name: sm_nginx
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - backend
    networks:
      - sm_network

networks:
  sm_network:
    driver: bridge

volumes:
  pgdata:
  uploads:
```

---

### 3.5 `db/init-postgis.sh`

Script exécuté **une seule fois** lors du tout premier démarrage du conteneur
PostgreSQL (quand `pgdata` est vide). Il active PostGIS dans la base.

```bash
#!/bin/bash
# db/init-postgis.sh
set -e

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
EOSQL

echo "PostGIS activé dans la base specimenmanager"
```

Rendre le script exécutable (sur macOS/Linux) :
```bash
chmod +x db/init-postgis.sh
```

Sur Windows (PowerShell) le `chmod` n'existe pas — le script sera exécutable
par défaut dans le conteneur Linux.

---

### 3.6 `backend/.env.production`

Créez ce fichier **manuellement** — il ne doit **jamais** être commité dans Git.

```env
# backend/.env.production

NODE_ENV=production
PORT=3000

# Base de données — même mot de passe que ${DB_PASSWORD} dans docker-compose.prod.yml
DATABASE_URL="postgresql://smuser:VOTRE_MOT_DE_PASSE_DB@postgres:5432/specimenmanager?schema=public"

# Clé JWT — générer avec la commande ci-dessous
JWT_SECRET=REMPLACER_PAR_UNE_CHAINE_DE_64_CHARS_HEX

# URL du frontend (pour les headers CORS)
# Mettre à jour avec votre domaine après la section HTTPS
CLIENT_URL=http://ADRESSE_IP_DU_NAS:8080
```

**Générer un JWT_SECRET sécurisé :**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### 3.7 `.env` (racine du projet)

Utilisé uniquement par `docker-compose.prod.yml` pour la variable `${DB_PASSWORD}`.

```env
# .env  (racine du projet)
DB_PASSWORD=VOTRE_MOT_DE_PASSE_DB_FORT
```

> Utilisez le même mot de passe dans `.env` (racine) et dans
> `DATABASE_URL` de `backend/.env.production`.

---

## 4. Préparation sur le poste de développement

### 4.1 Structure finale du projet

```
SpecimenManager/
├── backend/
│   ├── Dockerfile             ← CRÉER (section 3.1)
│   ├── .env.production        ← CRÉER (section 3.6, ne pas committer)
│   ├── prisma/migrations/
│   └── scripts/
│       ├── import-fokontany.js
│       ├── import-taxo.js
│       └── smoke-test.js
├── frontend/
│   └── Dockerfile             ← CRÉER (section 3.2)
├── nginx/
│   └── nginx.conf             ← CRÉER (section 3.3)
├── db/
│   └── init-postgis.sh        ← CRÉER (section 3.5)
├── fokontany/
│   └── Fokontany.shp          (shapefile Madagascar — déjà présent)
├── fichiers/
│   └── *.xlsx                 (taxonomies — déjà présentes)
├── .env                       ← CRÉER (section 3.7, ne pas committer)
├── docker-compose.yml         (dev uniquement — inchangé)
├── docker-compose.prod.yml    ← CRÉER (section 3.4)
└── configs.md                 (ce fichier)
```

### 4.2 Vérifier `.gitignore`

Assurez-vous que ces lignes sont présentes dans `.gitignore` :
```
.env
backend/.env.production
backend/.env
```

---

## 5. Configuration Synology DSM

### 5.1 Activer SSH

1. **Panneau de configuration** → **Terminal et SNMP**
2. Cocher **Activer le service SSH**
3. Port : `22` (par défaut)
4. Cliquer **Appliquer**

### 5.2 Installer Container Manager

1. **Package Center** → rechercher **Container Manager**
2. Cliquer **Installer** → attendre la fin

### 5.3 Créer le dossier partagé

1. **Panneau de configuration** → **Dossier partagé** → **Créer**
2. Nom : `docker`
3. Emplacement : `Volume 1` (ou votre volume principal)
4. Cliquer **Suivant** → **Appliquer**

Chemin résultant sur le NAS : `/volume1/docker/`

### 5.4 Vérifier les ressources disponibles

```bash
# Via SSH sur le NAS
ssh admin@ADRESSE_IP_DU_NAS

free -h          # RAM disponible (minimum 2 Go libres requis)
df -h /volume1   # Espace disque
```

---

## 6. Transfert des fichiers vers le NAS

### 6.1 Créer le répertoire de l'application (sur le NAS)

```bash
# Via SSH
mkdir -p /volume1/docker/specimenmanager/backups
```

### 6.2 Copier les fichiers (depuis votre poste)

**macOS / Linux :**
```bash
rsync -avz \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='frontend/dist' \
  --exclude='.git' \
  --exclude='*.log' \
  /chemin/vers/SpecimenManager/ \
  admin@ADRESSE_IP_DU_NAS:/volume1/docker/specimenmanager/
```

**Windows (PowerShell + WinSCP CLI) :**
```powershell
winscp.com /command `
  "open sftp://admin:MOT_DE_PASSE@ADRESSE_IP" `
  "synchronize remote C:\chemin\SpecimenManager /volume1/docker/specimenmanager" `
  "exit"
```

### 6.3 Vérifier le transfert

```bash
# Sur le NAS via SSH
ls /volume1/docker/specimenmanager/
# Attendu : backend/ frontend/ nginx/ db/ fokontany/ fichiers/
#           docker-compose.prod.yml .env ...
```

---

## 7. Premier déploiement

**Toutes les commandes suivantes s'exécutent via SSH sur le NAS.**

```bash
cd /volume1/docker/specimenmanager
```

### 7.1 Rendre le script init-postgis.sh exécutable

```bash
chmod +x db/init-postgis.sh
```

### 7.2 Builder et démarrer les conteneurs

```bash
# Durée : 5–15 min (téléchargement des images + compilation)
docker compose -f docker-compose.prod.yml up -d --build
```

Vérifier l'état des conteneurs :
```bash
docker compose -f docker-compose.prod.yml ps
```

Résultat attendu :
```
NAME           STATUS
sm_postgres    Up X minutes (healthy)
sm_backend     Up X minutes
sm_nginx       Up X minutes
```

Si un conteneur ne démarre pas :
```bash
docker compose -f docker-compose.prod.yml logs backend
```

### 7.3 Appliquer les migrations Prisma (schéma base de données)

```bash
docker exec sm_backend npx prisma migrate deploy
```

Résultat attendu : `3 migrations found — No pending migrations` ou liste des
migrations appliquées.

### 7.4 Créer le compte admin et les données de référence

```bash
docker exec sm_backend node prisma/seed.js
```

Compte admin créé :
- **Email** : `andrianinar@pasteur.mg`
- **Mot de passe** : `Admin1234!`

> **Changez ce mot de passe dès le premier login** via la page Utilisateurs.

### 7.5 Importer la taxonomie des spécimens

```bash
docker exec sm_backend node scripts/import-taxo.js
# Durée : 1–3 minutes (3 600+ espèces)
```

### 7.6 Importer le shapefile Fokontany (géolocalisation Madagascar)

```bash
docker exec sm_backend node scripts/import-fokontany.js \
  /app/fokontany/Fokontany.shp
# Durée : 2–5 minutes
```

Ce script active aussi l'extension PostGIS si elle n'est pas encore active.

### 7.7 Tester l'accès

```bash
# Santé de l'API (depuis le NAS)
curl http://localhost:8080/api/health
# Attendu : {"status":"ok","app":"SpécimenManager API","version":"1.0.0"}
```

Ouvrir dans un navigateur (réseau local) :
```
http://ADRESSE_IP_DU_NAS:8080
```

---

## 8. Configurer HTTPS et domaine

### 8.1 Configurer DDNS Synology (domaine gratuit)

1. **Panneau de configuration** → **Accès externe** → **DDNS** → **Ajouter**
2. Fournisseur : **Synology**
3. Nom d'hôte : `votre-choix.synology.me`
4. **Tester la connexion** → **OK**

### 8.2 Redirection de ports sur votre routeur/box

| Protocole | Port externe | IP interne (NAS) | Port interne |
|---|---|---|---|
| TCP | 80 | ADRESSE_IP_DU_NAS | 80 |
| TCP | 443 | ADRESSE_IP_DU_NAS | 443 |

### 8.3 Obtenir le certificat SSL Let's Encrypt

1. **Panneau de configuration** → **Sécurité** → **Certificat** → **Ajouter**
2. **Ajouter un nouveau certificat** → **Obtenir auprès de Let's Encrypt**
3. **Nom de domaine** : `votre-choix.synology.me`
4. **Appliquer** (le certificat se renouvelle automatiquement)

### 8.4 Configurer le Proxy Inversé DSM

1. **Panneau de configuration** → **Portail de connexion** → **Avancé**
   → **Proxy inversé** → **Créer**
2. Remplir le formulaire :

| Champ | Valeur |
|---|---|
| Description | SpécimenManager (sm_pern) |
| Protocole source | HTTPS |
| Nom d'hôte source | `sm.ipmnas.synology.me` |
| Port source | 443 |
| Protocole destination | HTTP |
| Nom d'hôte destination | `localhost` |
| Port destination | **8080** |

> Sous-domaine dédié `sm.` : le NAS héberge aussi une autre application sur
> le domaine racine `ipmnas.synology.me` (autre règle de Proxy Inversé,
> indépendante). Le sous-domaine `sm.` évite toute collision.

3. **Enregistrer**

### 8.5 Mettre à jour CLIENT_URL (CORS backend)

Dans `backend/.env.production` :
```env
CLIENT_URL=https://sm.ipmnas.synology.me
```

Redémarrer le backend :
```bash
cd /volume1/docker/specimenmanager
docker compose -f docker-compose.prod.yml restart backend
```

### 8.6 Test final HTTPS

```
https://sm.ipmnas.synology.me
```

La page de login doit s'afficher avec le cadenas HTTPS dans le navigateur.

---

## 9. Accès externe — administration et utilisateurs

Deux besoins distincts, deux solutions distinctes.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Admin (vous) : déployer, maintenir, superviser                     │
│  PC Windows ──[ Tailscale VPN ]──► NAS :22  (SSH chiffré)          │
│                  sans ouvrir de port sur le routeur                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Utilisateurs IPM : accéder à l'application                         │
│  Navigateur ──[ HTTPS :443 ]──► Routeur ──► NAS :8080              │
│               DDNS + Let's Encrypt (section 8)                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 9.1 Tailscale — accès admin sécurisé depuis n'importe où

Tailscale est un VPN point-à-point basé sur WireGuard. Une fois installé sur
le NAS et votre PC, vous accédez au NAS comme s'il était en local — sans
ouvrir aucun port sur votre routeur.

**Étape A — Créer un compte Tailscale (gratuit)**

1. Aller sur `https://tailscale.com` → **Get started free**
2. Se connecter avec un compte Google ou Microsoft

**Étape B — Installer Tailscale sur le NAS Synology**

1. **Package Center** DSM → onglet **Communauté** → chercher **Tailscale**
   > Si absent : ajouter la source `https://packages.synocommunity.com`
   > dans Package Center → Paramètres → Sources des packages
2. Installer **Tailscale** → lancer l'application
3. Cliquer **Authentifier** → copier l'URL affichée → l'ouvrir dans
   un navigateur → se connecter avec votre compte Tailscale
4. Le NAS apparaît dans votre réseau Tailscale avec une IP `100.x.x.x`

**Étape C — Installer Tailscale sur votre PC Windows**

1. Télécharger sur `https://tailscale.com/download/windows`
2. Installer → se connecter avec le même compte Tailscale
3. Le PC apparaît aussi dans le réseau

**Étape D — Vérifier la connexion**

```powershell
# Dans PowerShell, l'IP Tailscale du NAS (visible dans le dashboard Tailscale)
ping 100.X.X.X

# SSH via Tailscale (même commande que sur le réseau local)
ssh admin@100.X.X.X
```

À partir de là, toutes les commandes de déploiement (`/deploy-nas`,
`/transfer-nas`) fonctionnent depuis n'importe où en remplaçant l'IP locale
par l'IP Tailscale `100.x.x.x`.

---

### 9.2 Les deux accès à sm_pern

| Accès | URL | Usage |
|---|---|---|
| **Réseau local (LAN IPM)** | `http://192.168.64.18:8080` | Accès direct à `sm_nginx`, sans HTTPS — réseau de l'institut uniquement |
| **Externe (HTTPS public)** | `https://sm.ipmnas.synology.me` | Accès production pour tout le personnel IPM, via DDNS + Let's Encrypt + Proxy Inversé (section 8) |

**Checklist accès externe (fait) :**

- [x] DDNS Synology configuré (`ipmnas.synology.me`, sous-domaine `sm.`)
- [x] Ports 80 et 443 redirigés sur le routeur vers l'IP du NAS
- [x] Certificat Let's Encrypt obtenu dans DSM pour `sm.ipmnas.synology.me`
- [x] Proxy Inversé DSM : `sm.ipmnas.synology.me:443` → `localhost:8080`
- [x] `CLIENT_URL=https://sm.ipmnas.synology.me` dans `backend/.env.production`
- [x] Backend redémarré : `docker compose -f docker-compose.prod.yml restart backend`

**Test final :**
```
https://sm.ipmnas.synology.me  → page login SpécimenManager
```

---

### 9.3 Tableau récapitulatif — qui accède comment

| Qui | Objectif | Solution | Prérequis |
|---|---|---|---|
| Admin (vous) | Déployer, SSH, rsync | Tailscale | Compte gratuit + pkg NAS |
| Admin (vous) | Voir l'app depuis l'extérieur | HTTPS public ou Tailscale | Section 8 ou Tailscale |
| Personnel IPM (bureau) | Utiliser l'application | Réseau local — `http://192.168.64.18:8080` | Connecté au réseau IPM |
| Personnel IPM (hors site) | Utiliser l'application | HTTPS public — `https://sm.ipmnas.synology.me` | Section 8 |
| Admin (urgence) | Prisma Studio distant | Tailscale + port 5555 | Tailscale actif |

---

## 10. Maintenance et sauvegardes

### 9.1 Voir les logs

```bash
# Tous les services
docker compose -f docker-compose.prod.yml logs -f

# Backend uniquement
docker compose -f docker-compose.prod.yml logs -f backend

# Nginx
docker compose -f docker-compose.prod.yml logs -f nginx
```

### 9.2 Mettre à jour l'application

```bash
# Étape 1 — Transférer les nouveaux fichiers (depuis votre poste dev)
rsync -avz --exclude='node_modules' --exclude='*/node_modules' \
            --exclude='frontend/dist' --exclude='.git' \
            /chemin/vers/SpecimenManager/ \
            admin@ADRESSE_IP:/volume1/docker/specimenmanager/

# Étape 2 — Rebuild et redémarrage (sur le NAS)
cd /volume1/docker/specimenmanager
docker compose -f docker-compose.prod.yml up -d --build

# Étape 3 — Migrations si le schéma a changé
docker exec sm_backend npx prisma migrate deploy
```

### 9.3 Sauvegarder la base de données

```bash
# Dump PostgreSQL
docker exec sm_postgres pg_dump \
  -U smuser specimenmanager \
  > /volume1/docker/specimenmanager/backups/backup_$(date +%Y%m%d_%H%M).sql
```

**Restauration :**
```bash
cat backup_YYYYMMDD_HHMM.sql | \
  docker exec -i sm_postgres psql -U smuser specimenmanager
```

**Automatiser avec le Planificateur Synology :**
1. **Panneau de configuration** → **Planificateur de tâches**
   → **Créer** → **Tâche déclenchée** → **Script défini par l'utilisateur**
2. Planifier : tous les jours à **3h00**
3. Script :
```bash
#!/bin/bash
BACKUP_DIR=/volume1/docker/specimenmanager/backups
mkdir -p $BACKUP_DIR

docker exec sm_postgres pg_dump -U smuser specimenmanager \
  > "$BACKUP_DIR/backup_$(date +%Y%m%d).sql"

# Conserver 30 jours
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
```

### 9.4 Arrêt / redémarrage

```bash
# Arrêt complet
docker compose -f docker-compose.prod.yml down

# Redémarrage sans rebuild
docker compose -f docker-compose.prod.yml restart

# Redémarrer un seul service
docker compose -f docker-compose.prod.yml restart backend
```

### 9.5 Prisma Studio (inspection de la base)

```bash
# Lance sur le port 5555 — accès local uniquement
docker exec \
  -e DATABASE_URL="postgresql://smuser:VOTRE_MDP@postgres:5432/specimenmanager" \
  sm_backend \
  npx prisma studio --port 5555 --hostname 0.0.0.0

# Ouvrir : http://ADRESSE_IP_NAS:5555
```

---

## 11. Variables d'environnement — référence complète

### `backend/.env.production`

| Variable | Description | Exemple |
|---|---|---|
| `NODE_ENV` | Environnement | `production` |
| `PORT` | Port d'écoute du backend | `3000` |
| `DATABASE_URL` | Connexion PostgreSQL | `postgresql://smuser:pwd@postgres:5432/specimenmanager?schema=public` |
| `JWT_SECRET` | Clé JWT (min. 64 chars) | `<hex aléatoire 64 chars>` |
| `CLIENT_URL` | URL frontend (CORS) | `https://votre-choix.synology.me` |

### Variables de build frontend

| Variable | Description | Valeur prod |
|---|---|---|
| `VITE_API_URL` | Base URL Axios | `/api/v1` (relatif, même domaine) |

### `.env` racine (docker-compose.prod.yml)

| Variable | Description |
|---|---|
| `DB_PASSWORD` | Mot de passe PostgreSQL |

---

## Résumé des commandes clés

```bash
# === Premier déploiement ===
docker compose -f docker-compose.prod.yml up -d --build
docker exec sm_backend npx prisma migrate deploy
docker exec sm_backend node prisma/seed.js
docker exec sm_backend node scripts/import-taxo.js
docker exec sm_backend node scripts/import-fokontany.js /app/fokontany/Fokontany.shp

# === Mise à jour ===
docker compose -f docker-compose.prod.yml up -d --build
docker exec sm_backend npx prisma migrate deploy

# === Exploitation ===
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml restart backend

# === Sauvegarde ===
docker exec sm_postgres pg_dump -U smuser specimenmanager > backup.sql

# === Arrêt ===
docker compose -f docker-compose.prod.yml down
```
