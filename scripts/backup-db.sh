#!/bin/sh
# Sauvegarde quotidienne de la base PostgreSQL
# À planifier via DSM > Panneau de configuration > Planificateur de tâches
# Fréquence recommandée : tous les jours à 02h00

BACKUP_DIR=/volume1/docker/specimenmanager/backups
CONTAINER=sm_postgres
DB_USER=smuser
DB_NAME=specimenmanager
DOCKER=/usr/local/bin/docker

mkdir -p "$BACKUP_DIR"

FILENAME="backup_$(date +%Y%m%d_%H%M).sql.gz"

$DOCKER exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$BACKUP_DIR/$FILENAME"

echo "[$(date)] Backup créé : $FILENAME ($(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1))"

# Supprimer les sauvegardes de plus de 30 jours
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete
echo "[$(date)] Nettoyage : sauvegardes > 30 jours supprimées"
