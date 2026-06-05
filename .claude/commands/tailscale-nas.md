# /tailscale-nas — Accès admin distant via Tailscale VPN

Tailscale permet d'accéder au NAS Synology en SSH depuis n'importe où dans le
monde, sans ouvrir de ports sur le routeur. Une fois configuré, toutes les
commandes `/deploy-nas` et `/transfer-nas` fonctionnent à distance.

## Étape 1 — Créer un compte Tailscale (gratuit)

Aller sur https://tailscale.com → Get started free
Se connecter avec Google ou Microsoft.

## Étape 2 — Installer Tailscale sur le NAS Synology

### Via Package Center (recommandé)

1. DSM → Package Center → Paramètres → Sources des packages → Ajouter :
   ```
   https://packages.synocommunity.com
   ```
2. Package Center → Communauté → rechercher **Tailscale** → Installer
3. Ouvrir l'application Tailscale → cliquer **Authentifier**
4. Copier l'URL affichée → l'ouvrir dans un navigateur → se connecter

### Via SSH (si Package Center ne trouve pas Tailscale)

```bash
# Se connecter en SSH sur le NAS (réseau local)
ssh admin@ADRESSE_IP_LOCALE_NAS

# Télécharger et installer Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Démarrer et authentifier
tailscale up
# Copier l'URL affichée dans votre navigateur et se connecter
```

## Étape 3 — Installer Tailscale sur le PC Windows

1. Télécharger sur https://tailscale.com/download/windows
2. Installer → se connecter avec le même compte Tailscale
3. Icône dans la barre de notification → **Connect**

## Étape 4 — Trouver l'IP Tailscale du NAS

```powershell
# Option A : dashboard web
# https://login.tailscale.com/admin/machines
# → colonne "IP" du NAS (format 100.X.X.X)

# Option B : depuis PowerShell après connexion Tailscale
ping nom-du-nas   # Tailscale résout automatiquement le nom
```

## Étape 5 — Se connecter en SSH via Tailscale

```powershell
# Remplacer 100.X.X.X par l'IP Tailscale de votre NAS
ssh admin@100.X.X.X

# Transférer les fichiers (WSL2)
rsync -avz --exclude='node_modules' --exclude='*/node_modules' \
            --exclude='frontend/dist' --exclude='.git' \
            /mnt/c/Users/Andrianina/Desktop/SpecimenManager/ \
            admin@100.X.X.X:/volume1/docker/specimenmanager/
```

## Résumé des adresses à utiliser

| Situation | Adresse à utiliser |
|---|---|
| Sur le réseau local (bureau IPM) | `192.168.64.18` (IP locale) |
| Depuis l'extérieur (Tailscale actif) | `100.X.X.X` (IP Tailscale) |
| Utilisateurs (app en production) | `https://VOTRE_NAS.synology.me` |

## Dépannage

**Tailscale ne se connecte pas sur le NAS :**
```bash
sudo tailscale status
sudo tailscale up --reset
```

**SSH refusé via Tailscale :**
Vérifier que SSH est activé dans DSM → Panneau de configuration →
Terminal et SNMP → Activer le service SSH.

**Ping OK mais SSH bloqué :**
Le pare-feu DSM bloque peut-être les connexions Tailscale.
DSM → Panneau de configuration → Sécurité → Pare-feu → Modifier les règles →
Autoriser le port 22 depuis toutes les sources ou depuis `100.64.0.0/10`
(plage d'adresses Tailscale).
