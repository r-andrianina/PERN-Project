# frontend/Dockerfile
# Étape 1 : compiler React avec Vite
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

# VITE_API_URL vide = URL relative /api/v1 (même domaine via Nginx)
# Peut être surchargée au moment du build : --build-arg VITE_API_URL=https://...
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Étape 2 : serveur Nginx léger qui sert les fichiers statiques compilés
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
