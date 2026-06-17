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

# Ajouter un bloc par nouvelle migration. Exemple :
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
mkdir -p $D/20260616000000_add_numero_methode
cat > $D/20260616000000_add_numero_methode/migration.sql << 'SQL'
ALTER TABLE "methodes_collecte" ADD COLUMN "numero" INTEGER NOT NULL DEFAULT 1;
SQL
echo "Migration 20260616000000 OK"
'@
Invoke-NasScript -Content $m1 -Name "m1.sh"

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
