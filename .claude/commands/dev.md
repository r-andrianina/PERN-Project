# /dev — Démarrer les serveurs de développement

Affiche les commandes pour démarrer le projet en développement.

## Instructions

Dis à l'utilisateur de lancer **deux terminaux séparés** :

**Terminal 1 — Backend (port 3000)**
```bash
cd backend && npm run dev
```

**Terminal 2 — Frontend (port 5173)**
```bash
cd frontend && npm run dev
```

URLs :
- Frontend : http://localhost:5173
- API : http://localhost:3000/api/v1
- Health : http://localhost:3000/api/health

Compte par défaut : `andrianinar@pasteur.mg` / `Admin1234!`

> Si le port 3000 est déjà occupé, suggère `! tasklist | grep node` pour trouver le processus.
