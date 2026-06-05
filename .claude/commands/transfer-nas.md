# /transfer-nas — Transférer le projet vers le NAS Synology (Windows)

Affiche les commandes PowerShell pour copier les fichiers du projet vers le NAS,
en excluant les dossiers lourds (node_modules, .git, dist).

## Prérequis

- WinSCP installé (https://winscp.net) **ou** WSL2 disponible avec `rsync`
- SSH activé sur le NAS (port 22)
- Dossier `/volume1/docker/specimenmanager` créé sur le NAS

## Étape 1 — Créer le dossier de destination sur le NAS

Ouvrir PowerShell et se connecter en SSH :

```powershell
ssh admin@ADRESSE_IP_DU_NAS
mkdir -p /volume1/docker/specimenmanager/backups
exit
```

## Étape 2 — Transférer les fichiers

### Option A — WSL2 avec rsync (recommandé)

```bash
rsync -avz \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='frontend/dist' \
  --exclude='.git' \
  --exclude='*.log' \
  /mnt/c/Users/Andrianina/Desktop/SpecimenManager/ \
  admin@ADRESSE_IP_DU_NAS:/volume1/docker/specimenmanager/
```

### Option B — WinSCP en ligne de commande

```powershell
# Remplacer MOT_DE_PASSE par le mot de passe admin du NAS
& "C:\Program Files (x86)\WinSCP\WinSCP.com" /command `
  "open sftp://admin:MOT_DE_PASSE@ADRESSE_IP_DU_NAS" `
  "synchronize remote -delete -criteria=time -filemask=""| node_modules/; */node_modules/; .git/; frontend\dist/; *.log"" C:\Users\Andrianina\Desktop\SpecimenManager /volume1/docker/specimenmanager" `
  "exit"
```

### Option C — Robocopy (sans WinSCP, réseau local seulement)

```powershell
# Monter le partage réseau Synology
net use Z: \\ADRESSE_IP_DU_NAS\docker /user:admin MOT_DE_PASSE

robocopy C:\Users\Andrianina\Desktop\SpecimenManager Z:\specimenmanager `
  /MIR /XD node_modules .git dist /XF *.log /NFL /NDL
```

## Étape 3 — Vérifier le transfert

```powershell
ssh admin@ADRESSE_IP_DU_NAS "ls /volume1/docker/specimenmanager/"
# Attendu : backend/ frontend/ nginx/ db/ fokontany/ docker-compose.prod.yml .env
```

## Notes importantes

- Le fichier `.env` (racine) et `backend/.env.production` **seront** transférés
  car ils ne sont pas dans `.gitignore` pour rsync — c'est voulu.
- Le dossier `fokontany/` est exclu du git mais doit être transféré manuellement
  (shapefile ~33 MB). Il est inclus dans le rsync ci-dessus.
- Après chaque mise à jour du code, relancer le `rsync` puis sur le NAS :
  `docker compose -f docker-compose.prod.yml up -d --build`
