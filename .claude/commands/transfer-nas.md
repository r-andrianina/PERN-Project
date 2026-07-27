# /transfer-nas — Transférer le projet vers le NAS Synology (Windows)

Transfère les fichiers sources modifiés vers le NAS via **tar pipe SSH**.
⚠️ Ne jamais utiliser `scp -r` sur Windows : crée des fichiers avec chemins Windows comme noms.

## Configuration (déjà en place)

- **IP NAS** : `192.168.64.18`
- **Utilisateur** : `Henintsoa_DEV`
- **Clé SSH** : `~/.ssh/nas_deploy` (authentification sans mot de passe)
- **Chemin NAS** : `/volume1/docker/specimenmanager`

## Mise à jour du code (cas courant)

### Étape 1 — Builder le frontend en local

```bash
cd C:/Users/Andrianina/Desktop/SpecimenManager/frontend
npm run build
```

### Étape 2 — Transférer via tar pipe (Git Bash)

```bash
KEY="$USERPROFILE/.ssh/nas_deploy"
NAS="Henintsoa_DEV@192.168.64.18"
DST="/volume1/docker/specimenmanager"
SRC="C:/Users/Andrianina/Desktop/SpecimenManager"

cd "$SRC"
tar czf - backend/src frontend/src frontend/dist \
  | ssh -i "$KEY" "$NAS" "tar xzf - -C $DST/"
```

### Étape 3 — Rebuilder et redémarrer sur le NAS

```bash
ssh -i "$KEY" "$NAS" \
  "echo 'MOT_DE_PASSE' | sudo -S /usr/local/bin/docker compose \
  -f $DST/docker-compose.prod.yml up -d --build"
```

### Étape 4 — Vérifier

```bash
ssh -i "$KEY" "$NAS" "curl -s http://localhost:8080/api/health"
# {"status":"ok","app":"SpécimenManager API","version":"1.0.0"}
```

---

## Transfert complet (première installation ou remise à zéro)

```bash
KEY="$USERPROFILE/.ssh/nas_deploy"
NAS="Henintsoa_DEV@192.168.64.18"
DST="/volume1/docker/specimenmanager"
SRC="C:/Users/Andrianina/Desktop/SpecimenManager"

cd "$SRC"

# Tout transférer sauf node_modules, .git, dist (sera copié séparément après build)
tar czf - \
  --exclude='*/node_modules' \
  --exclude='.git' \
  --exclude='frontend/dist' \
  --exclude='*.log' \
  . | ssh -i "$KEY" "$NAS" "tar xzf - -C $DST/"

# Puis copier le dist compilé
tar czf - frontend/dist | ssh -i "$KEY" "$NAS" "tar xzf - -C $DST/"
```

---

## Vérifier la structure après transfert

```bash
ssh -i "$USERPROFILE/.ssh/nas_deploy" Henintsoa_DEV@192.168.64.18 \
  "ls /volume1/docker/specimenmanager/backend/src/ && \
   ls /volume1/docker/specimenmanager/frontend/dist/assets/"
```

---

## Notes importantes

- `tar pipe` préserve parfaitement l'arborescence — aucun problème de chemin Windows
- Le frontend doit être **compilé en local** (`npm run build`) avant transfert
  car le container nginx copie `frontend/dist/` pré-compilé (pas de build in-Docker)
- Docker sur ce NAS nécessite `sudo` et le chemin complet `/usr/local/bin/docker`
- `scp -O` fonctionne pour des fichiers uniques mais **pas** pour des dossiers récursifs
