// Adresse de la base de TEST, dérivée de celle de développement.
//
// Les identifiants ne sont jamais écrits en dur ici : on relit `backend/.env`
// et on remplace uniquement le NOM de la base. Le fichier reste donc valable
// quel que soit le mot de passe local, et rien de sensible n'entre dans le
// dépôt.
//
// Pourquoi une base séparée (2026-09-15) : la base de développement porte de
// vraies données de travail (des centaines de spécimens, la taxonomie
// complète). Des tests qui créent puis suppriment missions, localités et
// spécimens n'ont rien à y faire — une erreur de nettoyage y détruirait du
// travail réel.

const path   = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const NOM_BASE_TEST = 'specimenmanager_test';

/**
 * Remplace le nom de base dans une URL PostgreSQL, en conservant hôte, port,
 * identifiants et paramètres (`?schema=public`).
 */
function remplacerNomBase(url, nom) {
  const u = new URL(url);
  u.pathname = `/${nom}`;
  return u.toString();
}

const urlDev = process.env.DATABASE_URL;
if (!urlDev) {
  throw new Error(
    'DATABASE_URL introuvable — les tests d\'intégration lisent backend/.env '
    + 'pour en dériver la base de test.',
  );
}

// Garde-fou : si la base de dev s'appelait déjà comme la base de test, les
// tests effaceraient des données réelles au lieu des leurs.
if (new URL(urlDev).pathname === `/${NOM_BASE_TEST}`) {
  throw new Error(
    `DATABASE_URL pointe déjà sur « ${NOM_BASE_TEST} ». Les tests refusent de `
    + 'tourner dans ce cas : ils ne pourraient plus distinguer leur base de la vôtre.',
  );
}

module.exports = {
  NOM_BASE_TEST,
  urlDev,
  urlTest:        remplacerNomBase(urlDev, NOM_BASE_TEST),
  // Base de maintenance, pour émettre le CREATE DATABASE : on ne peut pas se
  // connecter à une base qui n'existe pas encore.
  urlMaintenance: remplacerNomBase(urlDev, 'postgres'),
  remplacerNomBase,
};
