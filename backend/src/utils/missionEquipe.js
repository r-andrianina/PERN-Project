// backend/src/utils/missionEquipe.js
// Chef de mission + agents de terrain, pour les colonnes d'export.
//
// Partagé entre l'export de recherche et l'export moustiques : deux copies
// auraient divergé, comme l'ont fait les quatre implémentations du libellé
// taxonomique.
//
// Chargé en UNE requête pour toutes les missions d'un export, et non via
// l'include des spécimens : les agents sont rattachés à la mission, donc les
// inclure ligne à ligne dupliquerait la même liste des centaines de fois.

const prisma = require('../config/prisma');

/**
 * @param {number[]} missionIds  ids de mission (doublons et null tolérés)
 * @returns {Promise<Map<number, { chef: string, agents: string }>>}
 */
async function chargerEquipes(missionIds) {
  const ids = [...new Set((missionIds || []).filter(Boolean))];
  const equipes = new Map();
  if (!ids.length) return equipes;

  const missions = await prisma.mission.findMany({
    where:  { id: { in: ids } },
    select: {
      id: true,
      chefMission: { select: { nom: true } },
      agents: { select: { personnel: { select: { nom: true } } } },
    },
  });

  for (const m of missions) {
    equipes.set(m.id, {
      chef:   m.chefMission?.nom ?? '',
      agents: m.agents.map((a) => a.personnel?.nom).filter(Boolean).sort((x, y) => x.localeCompare(y, 'fr')).join(', '),
    });
  }
  return equipes;
}

module.exports = { chargerEquipes };
