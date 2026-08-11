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

# 2. Transférer via tar pipe — backend/prisma est INDISPENSABLE ici : c'est
#    là que vivent schema.prisma et les migrations. L'oublier fait tourner
#    le rebuild suivant sur un schéma obsolète sans qu'aucune erreur ne le
#    signale (constaté le 2026-07-27 : 7 migrations manquantes, silencieux).
cd "$SRC"
tar czf - backend/src backend/prisma frontend/src frontend/dist \
  | ssh -i "$KEY" "$NAS" "tar xzf - -C $DST/"

# 3. Rebuilder les containers
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker compose \
  -f $DST/docker-compose.prod.yml up -d --build 2>&1"

# 4. Appliquer les migrations — ne JAMAIS sauter cette étape après un
#    changement de schema.prisma, même si l'étape 3 s'est bien passée.
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker exec sm_backend \
  npx prisma migrate deploy"

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
