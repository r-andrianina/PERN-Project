# /deploy-nas — Déployer SpécimenManager sur le NAS Synology

Guide pas à pas pour déployer ou mettre à jour l'application sur le NAS.
À exécuter **en SSH sur le NAS** après avoir transféré les fichiers (`/transfer-nas`).

## Connexion SSH

```powershell
# Depuis PowerShell (Windows)
ssh admin@ADRESSE_IP_DU_NAS
cd /volume1/docker/specimenmanager
```

## Déploiement initial (première fois)

### 1. Rendre init-postgis.sh exécutable

```bash
chmod +x db/init-postgis.sh
```

### 2. Builder et démarrer les 3 conteneurs

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Durée : 5–15 min (téléchargement images + compilation frontend React).

Vérifier que tout tourne :
```bash
docker compose -f docker-compose.prod.yml ps
```
Attendu : sm_postgres (healthy), sm_backend (Up), sm_nginx (Up)

### 3. Appliquer les migrations Prisma (schéma base de données)

```bash
docker exec sm_backend npx prisma migrate deploy
```

### 4. Créer le compte admin + données de référence

```bash
docker exec sm_backend node prisma/seed.js
```
Compte admin : andrianinar@pasteur.mg / Admin1234!
**Changer le mot de passe dès le premier login.**

### 5. Importer la taxonomie des spécimens (~3 600 espèces)

```bash
docker exec sm_backend node scripts/import-taxo.js
```

### 6. Importer le shapefile Fokontany (géolocalisation Madagascar)

```bash
docker exec sm_backend node scripts/import-fokontany.js \
  /app/fokontany/Fokontany.shp
```

### 7. Test de santé

```bash
curl http://localhost:8080/api/health
# Attendu : {"status":"ok","app":"SpécimenManager API","version":"1.0.0"}
```

Ouvrir dans le navigateur : `http://ADRESSE_IP_DU_NAS:8080`

---

## Mise à jour (après modification du code)

```bash
# 1. Transférer les nouveaux fichiers depuis Windows (voir /transfer-nas)

# 2. Sur le NAS :
cd /volume1/docker/specimenmanager
docker compose -f docker-compose.prod.yml up -d --build
docker exec sm_backend npx prisma migrate deploy
```

---

## Après configuration HTTPS (domaine Synology)

Mettre à jour `CLIENT_URL` dans `backend/.env.production` :
```bash
# Éditer le fichier
nano backend/.env.production
# Changer : CLIENT_URL=https://VOTRE_DOMAINE.synology.me

# Redémarrer le backend
docker compose -f docker-compose.prod.yml restart backend
```

---

## Commandes utiles au quotidien

```bash
# Logs en temps réel
docker compose -f docker-compose.prod.yml logs -f backend

# Redémarrer un service
docker compose -f docker-compose.prod.yml restart backend

# Arrêt complet
docker compose -f docker-compose.prod.yml down

# Sauvegarde base de données
docker exec sm_postgres pg_dump -U smuser specimenmanager \
  > /volume1/docker/specimenmanager/backups/backup_$(date +%Y%m%d).sql
```
