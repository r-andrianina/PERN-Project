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

EXPOSE 3000

CMD ["node", "server.js"]
