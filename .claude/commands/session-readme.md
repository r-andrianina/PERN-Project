# /session-readme — Rédiger le README.md du projet

## Objectif

Produire un README professionnel qui permet à un nouveau développeur de l'IPM de cloner et lancer le projet en < 10 minutes.

## Structure attendue

```markdown
# SpécimenManager — Institut Pasteur Madagascar

Logo + badges (stack)

## À propos
## Stack technique
## Prérequis
## Installation rapide (5 commandes)
## Configuration (.env)
## Commandes disponibles (npm run dev, seed, etc.)
## Architecture du projet (arbre de fichiers annoté)
## Module Dictionnaire (explication CDC)
## API — endpoints principaux (table)
## Conventions de code (hooks, services, tokens)
## Données géospatiales fokontany
## Déploiement
## Contribution
```

## Fichier à modifier

`/README.md` à la racine du projet (actuellement le README Vite par défaut).

## Informations clés à inclure

- **Stack** : PostgreSQL (PostGIS) + Express + React 19 + Node.js
- **Port 5435** (non standard) pour PostgreSQL
- **Compte admin par défaut** : `andrianinar@pasteur.mg` / `Admin1234!`
- **Import fokontany** : `node backend/scripts/import-fokontany.js` (fichier local requis)
- **Migrations Prisma** : `prisma migrate deploy` (pour déploiement) ou `prisma db push` (pour dev)
- **Design system** : CSS variables + dark mode via `.dark` sur `<html>`
- **Hooks** : `useFormSubmit`, `useApiQuery`, `useApiQueries` dans `frontend/src/hooks/`

## Badges à générer (shields.io)

- Node.js version, React 19, PostgreSQL, Prisma, Tailwind CSS, Zod
