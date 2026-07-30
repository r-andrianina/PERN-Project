// backend/src/utils/specimenRefs.js
// Intégrité des relations POLYMORPHES vers les spécimens (B6).
//
// ManipulationLabo et PoolMembre ciblent un spécimen via le couple
// (specimenType, specimenId) — ce n'est pas une clé étrangère Prisma, donc rien
// n'empêche au niveau base de supprimer un spécimen encore référencé, ce qui
// laisserait des manipulations / appartenances de pool orphelines.
//
// Ces helpers servent de garde applicative : on refuse (409) la suppression
// d'un spécimen tant qu'il est référencé, plutôt que de détruire des données
// scientifiques (résultats PCR, séquences…) en cascade.

const prisma = require('../config/prisma');

// Compte les références (manipulations labo + appartenances à un pool) d'UN spécimen.
async function countSpecimenRefs(specimenType, specimenId) {
  const [manipulations, poolMembres] = await Promise.all([
    prisma.manipulationLabo.count({ where: { specimenType, specimenId } }),
    prisma.poolMembre.count({ where: { specimenType, specimenId } }),
  ]);
  return { manipulations, poolMembres, total: manipulations + poolMembres };
}

// Message lisible listant les références qui bloquent la suppression.
function refsReason(refs) {
  const parts = [];
  if (refs.manipulations > 0) parts.push(`${refs.manipulations} manipulation(s) de laboratoire`);
  if (refs.poolMembres  > 0) parts.push(`${refs.poolMembres} appartenance(s) à un pool`);
  return parts.join(' et ');
}

// Parmi une liste d'ids d'un type donné, renvoie l'ensemble de ceux encore
// référencés (labo ou pool). Utilisé par la suppression en masse pour épargner
// les spécimens référencés au lieu de bloquer tout le lot.
async function findReferencedSpecimenIds(specimenType, ids) {
  if (!ids.length) return new Set();
  const [manips, membres] = await Promise.all([
    prisma.manipulationLabo.findMany({
      where: { specimenType, specimenId: { in: ids } }, select: { specimenId: true },
    }),
    prisma.poolMembre.findMany({
      where: { specimenType, specimenId: { in: ids } }, select: { specimenId: true },
    }),
  ]);
  const set = new Set();
  for (const m of manips)  if (m.specimenId != null) set.add(m.specimenId);
  for (const m of membres) set.add(m.specimenId);
  return set;
}

module.exports = { countSpecimenRefs, refsReason, findReferencedSpecimenIds };
