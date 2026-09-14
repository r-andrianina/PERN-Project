#!/bin/sh
# Sauvegarde quotidienne de la base PostgreSQL SpecimenManager.
#
# A planifier via cron (/etc/crontab, compte root) -- voir la section
# "Planification" en bas de ce fichier.
#
# Durci le 2026-09-14. La version precedente ne verifiait RIEN : elle a produit
# 34 archives vides (20 octets) entre le 2026-08-12 et le 2026-09-14 en
# affichant "Backup cree" a chaque fois. Deux causes empilees, corrigees ici :
#   1. `docker exec` etait appele sans sudo. Lance par root a 02h00 ca passait,
#      lance par un compte non-root (tache DSM de minuit) Docker refusait.
#   2. Le code de retour d'un pipeline est celui de la DERNIERE commande, donc
#      celui de `gzip` -- qui compresse tres bien zero octet et renvoie 0.
#      L'echec de pg_dump etait donc invisible.
#
# Ecrit en ASCII pur : le journal est relu par-dessus SSH, ou les accents
# UTF-8 s'affichaient en mojibake ("Backup crAcAc").

set -u
# /bin/sh est bash sur ce NAS (verifie le 2026-09-14) : pipefail est disponible
# et fait remonter l'echec de pg_dump au lieu de celui de gzip.
set -o pipefail

BACKUP_DIR=/volume1/docker/specimenmanager/backups
CONTAINER=sm_postgres
DB_USER=smuser
DB_NAME=specimenmanager
DOCKER=/usr/local/bin/docker
RETENTION_DAYS=30
# Un dump valide pese ~23 Mo compresse. Le plancher ne cherche pas a etre
# precis, seulement a rejeter le vide et le tronque grossier.
MIN_SIZE=1000000

log()  { echo "[$(date)] $*"; }
fail() {
  log "ECHEC : $*"
  log "Aucune purge effectuee : l'historique existant est conserve."
  exit 1
}

# Le socket Docker n'est lisible que par root. On n'eleve que si necessaire,
# et `sudo -n` echoue franchement plutot que d'attendre un mot de passe que
# personne ne tapera dans une tache planifiee.
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo -n"; fi

mkdir -p "$BACKUP_DIR" || fail "dossier $BACKUP_DIR inaccessible"

FILENAME="backup_$(date +%Y%m%d_%H%M).sql.gz"
DEST="$BACKUP_DIR/$FILENAME"
# Ecriture sous un nom temporaire : une sauvegarde ratee ne doit jamais laisser
# derriere elle un fichier au nom plausible qu'on croirait restaurable.
TMP="$BACKUP_DIR/.tmp_$FILENAME"
trap 'rm -f "$TMP"' EXIT

$SUDO $DOCKER exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$TMP" \
  || fail "pg_dump a echoue (conteneur $CONTAINER injoignable, ou droits Docker insuffisants pour l'utilisateur $(id -un))"

SIZE=$(wc -c < "$TMP")
[ "$SIZE" -ge "$MIN_SIZE" ] \
  || fail "archive de $SIZE octets, minimum attendu $MIN_SIZE -- dump vide ou tronque"

# Marqueur que pg_dump n'ecrit qu'apres avoir tout exporte : c'est le seul
# controle qui distingue un dump complet d'un dump coupe en cours de route.
gzip -dc "$TMP" | tail -5 | grep -q "PostgreSQL database dump complete" \
  || fail "marqueur de fin absent -- dump incomplet"

mv "$TMP" "$DEST" || fail "impossible de renommer $TMP en $DEST"
trap - EXIT

log "Backup OK : $FILENAME ($(du -h "$DEST" | cut -f1))"

# Purge seulement apres un succes. La version precedente purgeait meme quand le
# dump avait echoue : une serie d'echecs erodait l'historique sans rien produire
# en echange.
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
log "Purge : archives de plus de $RETENTION_DAYS jours supprimees"

# ---------------------------------------------------------------------------
# Planification
#   /etc/crontab, compte root, tous les jours a 02h00 :
#     0  2  *  *  *  root  sh /volume1/docker/specimenmanager/scripts/backup-db.sh \
#       >> /volume1/docker/specimenmanager/backups/backup.log 2>&1
#
#   NE PAS doubler cette tache dans le Planificateur DSM : c'est ce doublon,
#   lance sous un compte non-root, qui produisait une archive vide chaque nuit.
# ---------------------------------------------------------------------------
