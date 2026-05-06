// backend/src/config/prisma.js
// Instance unique de Prisma Client — à importer dans tous les controllers

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

// Vérification connexion au démarrage
prisma.$connect()
  .then(() => console.log('✅ Prisma connecté à PostgreSQL'))
  .catch((err) => console.error('❌ Erreur Prisma :', err.message));

module.exports = prisma;