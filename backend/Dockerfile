# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# openssl est requis par le client Prisma
RUN apk add --no-cache openssl

# Installer les dépendances en premier (couche cachée par Docker)
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le code source
COPY . .

# Générer le Prisma Client (compilation JS, ne touche pas la base)
RUN npx prisma generate

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["/entrypoint.sh"]
