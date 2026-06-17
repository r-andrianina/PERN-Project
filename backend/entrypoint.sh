#!/bin/sh
set -e

echo ">> prisma migrate deploy..."
npx prisma migrate deploy

echo ">> démarrage API..."
exec node server.js
