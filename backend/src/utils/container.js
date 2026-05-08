// backend/src/utils/container.js
// Helpers pour la gestion des containers (plaques 96 puits / boîtes 81 tubes).
//
// Code automatique : <P|B>_AAAAMM_n  où :
//   - P/B selon le type
//   - AAAAMM = année et mois du début de la mission
//   - n = compteur incrémental propre à la mission

const prisma = require('../config/prisma');

// Capacités fixes par type
const CAPACITY = {
  PLAQUE: 96, // 8 lignes A-H × 12 colonnes 1-12
  BOITE:  81, // 9 lignes 1-9 × 9 colonnes 1-9
};

// Génère toutes les positions possibles pour un container donné
function allPositions(type) {
  if (type === 'PLAQUE') {
    const out = [];
    for (const r of 'ABCDEFGH') {
      for (let c = 1; c <= 12; c++) out.push(`${r}${c}`);
    }
    return out;
  }
  if (type === 'BOITE') {
    const out = [];
    for (let r = 1; r <= 9; r++) {
      for (let c = 1; c <= 9; c++) out.push(`${r}-${c}`);
    }
    return out;
  }
  return [];
}

function isValidPosition(type, position) {
  if (!position) return false;
  if (type === 'PLAQUE') return /^[A-H](?:[1-9]|1[0-2])$/.test(position);
  if (type === 'BOITE')  return /^[1-9]-[1-9]$/.test(position);
  return false;
}

// Génère le code container P/B_AAAAMM_n
async function generateContainerCode(type, missionId) {
  const mission = await prisma.mission.findUnique({ where: { id: parseInt(missionId) } });
  if (!mission) throw new Error('Mission introuvable');
  const d = mission.dateDebut ? new Date(mission.dateDebut) : new Date(mission.createdAt);
  const yearMonth = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const prefix    = type === 'PLAQUE' ? 'P' : 'B';

  // Compteur propre à la mission, peu importe le mois (1a)
  const re = new RegExp(`^${prefix}_${yearMonth}_(\\d+)$`);
  const existing = await prisma.container.findMany({
    where: { missionId: parseInt(missionId), type, code: { startsWith: `${prefix}_${yearMonth}_` } },
    select: { code: true },
  });
  const max = existing
    .map((c) => { const m = c.code.match(re); return m ? parseInt(m[1]) : 0; })
    .reduce((a, b) => Math.max(a, b), 0);

  return `${prefix}_${yearMonth}_${max + 1}`;
}

// Renvoie les positions occupées d'un container avec le détail des spécimens
async function getOccupiedPositions(containerId) {
  const id = parseInt(containerId);
  const select = {
    id: true, idTerrain: true, position: true, nombre: true, sexe: true, stade: true,
    taxonomie: { include: { parent: true } },
  };
  const [m, t, p] = await Promise.all([
    prisma.moustique.findMany({ where: { containerId: id, position: { not: null } }, select }),
    prisma.tique.findMany    ({ where: { containerId: id, position: { not: null } }, select }),
    prisma.puce.findMany     ({ where: { containerId: id, position: { not: null } }, select }),
  ]);

  // Indexer par position (peut contenir plusieurs spécimens si BOITE)
  const map = new Map();
  const push = (type, items) => items.forEach((s) => {
    if (!map.has(s.position)) map.set(s.position, []);
    map.get(s.position).push({ type, ...s });
  });
  push('moustique', m);
  push('tique', t);
  push('puce', p);

  return map;
}

// Renvoie les N prochaines positions libres dans l'ordre A1, A2, ..., H12 (plaque)
async function nextAvailablePositions(containerId, count) {
  const container = await prisma.container.findUnique({ where: { id: parseInt(containerId) } });
  if (!container) throw new Error('Container introuvable');
  const occupied = await getOccupiedPositions(containerId);
  const all = allPositions(container.type);
  const free = all.filter((p) => !occupied.has(p));
  if (free.length < count) {
    throw new Error(`Plus que ${free.length} positions libres dans ce container, ${count} demandées`);
  }
  return free.slice(0, count);
}

// Vérifie qu'on peut placer un spécimen sur une position selon le type de container
async function validatePlacement(containerId, position, { allowMultiple = false } = {}) {
  if (!containerId) return null; // pas de container = pas de validation (champ optionnel)
  const container = await prisma.container.findUnique({ where: { id: parseInt(containerId) } });
  if (!container) return 'Container introuvable';
  if (!position)  return 'Position obligatoire si container choisi';
  if (!isValidPosition(container.type, position)) {
    return container.type === 'PLAQUE'
      ? 'Position plaque invalide (attendu: A1 à H12)'
      : 'Position boîte invalide (attendu: 1-1 à 9-9)';
  }
  // Plaque = 1 spécimen / puit strict
  if (container.type === 'PLAQUE') {
    const occupied = await getOccupiedPositions(containerId);
    if (occupied.has(position)) {
      return `La position ${position} est déjà occupée (plaque = 1 spécimen / puit)`;
    }
  }
  // Boîte = OK plusieurs spécimens, à moins qu'on demande exclusivité
  if (container.type === 'BOITE' && !allowMultiple) {
    // par défaut on autorise le partage de tube
  }
  return null;
}

module.exports = {
  CAPACITY,
  allPositions,
  isValidPosition,
  generateContainerCode,
  getOccupiedPositions,
  nextAvailablePositions,
  validatePlacement,
};
