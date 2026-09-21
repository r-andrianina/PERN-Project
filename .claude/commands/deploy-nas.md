# /deploy-nas — Déployer SpécimenManager sur le NAS Synology

Guide pas à pas pour déployer ou mettre à jour l'application sur le NAS.

## Configuration (déjà en place)

- **IP NAS** : `192.168.64.18`
- **Utilisateur SSH** : `Henintsoa_DEV`
- **Clé SSH** : `~/.ssh/nas_deploy`
- **Docker** : `/usr/local/bin/docker` (chemin complet obligatoire, nécessite `sudo`)
- **Chemin projet** : `/volume1/docker/specimenmanager`

---

## Mise à jour (après modification du code)

Depuis **Git Bash** sur Windows :

```bash
KEY="$USERPROFILE/.ssh/nas_deploy"
NAS="Henintsoa_DEV@192.168.64.18"
DST="/volume1/docker/specimenmanager"
SRC="C:/Users/Andrianina/Desktop/SpecimenManager"

# 1. Builder le frontend
cd "$SRC/frontend" && npm run build

# 2. Transférer via tar pipe.
#
#    LA LISTE CI-DESSOUS FAIT FOI. Elle est la seule de tout le dépôt ;
#    `transfer-nas.md` y renvoie au lieu de la recopier, parce que c'est la
#    duplication qui a laissé les deux procédures diverger.
#
#    Règle : `tar xzf` AJOUTE, il n'efface rien et ne met à jour que ce qu'on
#    lui donne. Tout fichier hors de cette liste garde indéfiniment sa version
#    du jour de l'installation, sans qu'aucune erreur ne le signale.
#      · backend/prisma — schema.prisma et les migrations. L'oublier fait
#        tourner le rebuild suivant sur un schéma obsolète, en silence
#        (constaté le 2026-07-27 : 7 migrations manquantes).
#      · backend/package*.json — c'est là que vivent les versions. Le
#        Dockerfile fait `COPY package*.json ./` puis `npm ci` : sans elles,
#        le rebuild réinstalle les ANCIENNES dépendances sous du code neuf.
#        C'est ce qui bloquait la montée Prisma 5→7 le 2026-09-21.
#      · backend/prisma.config.js — requis par la CLI Prisma ≥ 7.
#      · backend/server.js, scripts/, Dockerfile, entrypoint.sh — hors de
#        `src/`, donc jamais transférés jusqu'au 2026-09-21. Le garde-fou
#        JWT_SECRET ajouté à server.js le 2026-08-11 n'avait toujours pas
#        atteint la prod six semaines plus tard.
#
#    Volontairement ABSENTS de la liste :
#      · docker-compose.prod.yml — la version du NAS fait foi et diffère de
#        celle du dépôt (cf. configs.md § 3.4). L'écraser casserait la prod.
#      · backend/.env* — secrets de production, jamais poussés depuis un poste.
#
#    DEUX migrations ne doivent JAMAIS partir en prod :
#      · 20260506183552_init — la prod a été baselinée sans elle ; la rejouer
#        lance des CREATE TABLE sur des tables existantes.
#      · 20260806101736_taxonomie_specimens_unique_indexes — différée en
#        attente de l'arbitrage des taxonomistes (14 groupes de doublons
#        réels). C'est elle qui a mis le backend en boucle de crash pendant
#        2 h le 2026-08-26.
cd "$SRC"
tar czf - \
  --exclude='backend/prisma/migrations/20260506183552_init' \
  --exclude='backend/prisma/migrations/20260806101736_taxonomie_specimens_unique_indexes' \
  backend/src backend/prisma backend/scripts \
  backend/server.js backend/package.json backend/package-lock.json \
  backend/prisma.config.js backend/Dockerfile backend/entrypoint.sh \
  frontend/src frontend/dist frontend/Dockerfile.dist \
  | ssh -i "$KEY" "$NAS" "tar xzf - -C $DST/"

# 2 bis. VÉRIFIER AVANT DE REBUILDER — l'exclusion ci-dessus n'enlève pas ce
#    qui est DÉJÀ sur le NAS : `tar xzf` ajoute, il n'efface rien. Une
#    migration déposée par un transfert antérieur reste inerte tant qu'aucun
#    rebuild n'a lieu, puis explose au rebuild SUIVANT — potentiellement des
#    semaines plus tard, et pas forcément lancé par la même personne.
#    (Constaté le 2026-09-11 : `init` traînait depuis un transfert du 09-09.)
ssh -i "$KEY" "$NAS" \
  "ls $DST/backend/prisma/migrations | grep -E 'init|taxonomie_specimens'"
#    Attendu : AUCUNE sortie. Sinon, écarter le dossier fautif :
#    sudo mv $DST/backend/prisma/migrations/<dossier> \
#            $DST/backend/prisma/_migrations_differees/

# 2 ter. Même raison, autre fichier : `prisma.config.ts` traîne à la racine du
#    backend sur le NAS depuis une tentative abandonnée. Prisma ≥ 7 lit
#    `prisma.config.*` au démarrage de sa CLI — deux fichiers de configuration
#    côte à côte, c'est une ambiguïté qu'on ne veut pas découvrir pendant un
#    `migrate deploy`. Le transfert dépose le `.js` mais n'efface pas le `.ts`.
ssh -i "$KEY" "$NAS" "ls $DST/backend/prisma.config.* 2>/dev/null"
#    Attendu : prisma.config.js SEUL. Si le .ts est encore là :
#    ssh -i "$KEY" "$NAS" "mv $DST/backend/prisma.config.ts $DST/backend/prisma.config.ts.retire"

# 3. Rebuilder les containers
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker compose \
  -f $DST/docker-compose.prod.yml up -d --build 2>&1"

# 4. Appliquer les migrations — ne JAMAIS sauter cette étape après un
#    changement de schema.prisma, même si l'étape 3 s'est bien passée.
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_backend \
  npx prisma migrate deploy"

# 4 bis. MIGRATIONS DE DONNÉES — celles que Prisma ne connaît pas.
#    `migrate deploy` ne joue que les changements de SCHÉMA. Un changement de
#    MODÈLE qui réinterprète des colonnes existantes vit dans backend/scripts/
#    et doit être lancé à la main, une fois, après le déploiement du code.
#
#    Elles se lancent TOUTES à blanc d'abord : sans --apply, le script joue la
#    transaction en entier, vérifie son invariant, affiche le résultat réel et
#    annule. On lit, puis on signe.
#
#      migrate-nuit-piege.js   requis pour toute base écrite avant le
#                              2026-09-16 (commit 96295d5). Aligne les dates
#                              de méthode sur la date de collecte des
#                              spécimens. Sans lui, le code neuf affiche
#                              toutes les dates un jour trop tard.
#
#    À ne lancer qu'APRÈS une sauvegarde fraîche (cf. § Commandes utiles).
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_backend \
  node scripts/migrate-nuit-piege.js"            # simulation
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_backend \
  node scripts/migrate-nuit-piege.js --apply"    # après lecture du rapport

# 5. Vérifier
ssh -i "$KEY" "$NAS" "curl -s http://localhost:8080/api/health"
```

---

## Déploiement initial (première fois)

### 1. Transférer tous les fichiers

Voir `/transfer-nas` — section "Transfert complet".

### 2. Rendre init-postgis.sh exécutable

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18 \
  "chmod +x /volume1/docker/specimenmanager/db/init-postgis.sh"
```

### 3. Builder et démarrer les 3 containers

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18 \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker compose \
  -f /volume1/docker/specimenmanager/docker-compose.prod.yml up -d --build 2>&1"
```

Durée : 5–15 min. Attendu : `sm_postgres (healthy)`, `sm_backend (Up)`, `sm_nginx (Up)`

### 4. Appliquer les migrations Prisma

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18 \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_backend \
  npx prisma migrate deploy"
```

### 5. Créer le compte admin + données de référence

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18 \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_backend \
  node prisma/seed.js"
```

### 6. Importer la taxonomie (~3 600 espèces)

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18 \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_backend \
  node scripts/import-taxo.js"
```

### 7. Importer le shapefile Fokontany

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18 \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_backend \
  node scripts/import-fokontany.js /app/fokontany/Fokontany.shp"
```

### 8. Test de santé

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18 \
  "curl -s http://localhost:8080/api/health"
# {"status":"ok","app":"SpécimenManager API","version":"1.0.0"}
```

Application disponible sur : `http://192.168.64.18:8080`

---

## Commandes utiles au quotidien

```bash
KEY="$USERPROFILE/.ssh/nas_deploy"
NAS="Henintsoa_DEV@192.168.64.18"

# Logs en temps réel
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker compose \
  -f /volume1/docker/specimenmanager/docker-compose.prod.yml logs -f backend"

# Redémarrer le backend uniquement
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker compose \
  -f /volume1/docker/specimenmanager/docker-compose.prod.yml restart backend"

# Sauvegarde base de données
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_postgres \
  pg_dump -U smuser specimenmanager \
  > /volume1/docker/specimenmanager/backups/backup_\$(date +%Y%m%d).sql"
```

---

## Après configuration HTTPS (domaine Synology)

Config actuelle (2026-08-04) : `CLIENT_URL=https://sm.ipmnas.synology.me:8443`
— voir `configs.md` § 8 pour le détail (port 8443, pas 443 : occupé par DSM
lui-même pour ce nom d'hôte côté Portail des applications).

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18
nano /volume1/docker/specimenmanager/backend/.env.production
# Changer : CLIENT_URL=https://VOTRE_DOMAINE.synology.me[:PORT]

echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker compose \
  -f /volume1/docker/specimenmanager/docker-compose.prod.yml up -d backend
```

> ⚠️ **`up -d`, pas `restart`.** `restart` relance le container existant
> avec les variables d'environnement déjà figées à sa création — il ne relit
> jamais `.env.production`. Seul `up -d` détecte le changement et recrée le
> container. Piège constaté le 2026-08-04 : `CLIENT_URL` mis à jour dans le
> fichier, `restart` exécuté, mais le header CORS renvoyait encore l'ancienne
> valeur jusqu'à relancer avec `up -d`.
