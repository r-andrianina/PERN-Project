// backend/scripts/import-taxo.js
// Import du dictionnaire taxonomique depuis Dico_Taxo.xlsx
//
// Usage (depuis la racine du projet) :
//   node backend/scripts/import-taxo.js [chemin_fichier]
//
// Par défaut : ./fichiers/Dico_Taxo.xlsx
// Seules les entrées VAL sont importées.
// Mapping : Diptera/Culicidae → moustique | Ixodida → tique | Siphonaptera → puce

const path    = require('path');
const ExcelJS = require('exceljs');
const prisma  = require('../src/config/prisma');

const FILE = process.argv[2]
  || path.join(__dirname, '../../fichiers/Dico_Taxo.xlsx');

// ── Mapping type ────────────────────────────────────────────
function detectType(ordre, famille) {
  if (ordre === 'Diptera' && famille === 'Culicidae') return 'moustique';
  if (ordre === 'Ixodida')                            return 'tique';
  if (ordre === 'Siphonaptera')                       return 'puce';
  return null;
}

// ── Nettoyage cellule ───────────────────────────────────────
function clean(v, maxLen = 150) {
  if (v === null || v === undefined) return null;
  const s = v.toString().trim();
  if (s === '' || s === 'sp' || s === 'N/A' || s === 'n/a') return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function cleanYear(v) {
  if (!v) return null;
  const n = parseInt(v.toString());
  return (isNaN(n) || n < 1700 || n > 2100) ? null : n;
}

// ── Cache (niveau:nom_lower:parentId) → id ──────────────────
const cache = new Map();

function cacheKey(niveau, nom, parentId) {
  return `${niveau}:${nom.toLowerCase()}:${parentId ?? 'null'}`;
}

// ── Trouver ou créer un nœud ────────────────────────────────
async function getOrCreate({ niveau, nom, parentId, type, auteur, annee }) {
  const key = cacheKey(niveau, nom, parentId);
  if (cache.has(key)) return { id: cache.get(key), created: false };

  // Chercher en base (au cas où le cache est incomplet après redémarrage partiel)
  const existing = await prisma.taxonomieSpecimen.findFirst({
    where: { niveau, nom, parentId: parentId ?? null },
    select: { id: true },
  });

  if (existing) {
    cache.set(key, existing.id);
    return { id: existing.id, created: false };
  }

  const entry = await prisma.taxonomieSpecimen.create({
    data: { niveau, nom, parentId: parentId ?? null, type, auteur, annee, actif: true },
    select: { id: true },
  });
  cache.set(key, entry.id);
  return { id: entry.id, created: true };
}

// ── Script principal ────────────────────────────────────────
async function main() {
  console.log('📂 Fichier :', FILE);

  // Pré-charger le cache depuis la base
  console.log('⏳ Chargement des entrées existantes…');
  const existing = await prisma.taxonomieSpecimen.findMany({
    select: { id: true, niveau: true, nom: true, parentId: true },
  });
  existing.forEach(e => cache.set(cacheKey(e.niveau, e.nom, e.parentId), e.id));
  console.log(`   ${existing.length} entrées déjà en base (cache pré-chargé)`);

  // Lire l'Excel
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  console.log(`📊 Feuille : "${ws.name}" — ${ws.rowCount - 1} lignes de données`);

  // Parser les lignes VAL
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const v = row.values;
    if ((v[10] || '').toString().trim() !== 'VAL') return;

    const ordre   = clean(v[1]);
    const famille = clean(v[2]);
    if (!ordre) return;

    const type = detectType(ordre, famille);
    if (!type) return;

    // Construire la chaîne hiérarchique (niveaux non-vides dans l'ordre)
    const chain = [
      { niveau: 'ordre',       nom: ordre },
      { niveau: 'famille',     nom: clean(v[2]) },
      { niveau: 'sous_famille',nom: clean(v[3]) },
      { niveau: 'genre',       nom: clean(v[4]) },
      { niveau: 'sous_genre',  nom: clean(v[5]) },
      { niveau: 'espece',      nom: clean(v[6]) },
      { niveau: 'sous_espece', nom: clean(v[7]) },
    ].filter(x => x.nom !== null);

    if (chain.length === 0) return;

    rows.push({
      chain,
      type,
      auteur: clean(v[8], 100),
      annee:  cleanYear(v[9]),
    });
  });

  console.log(`\n🔍 Lignes VAL retenues : ${rows.length}`);
  const byType = rows.reduce((acc, r) => { acc[r.type] = (acc[r.type]||0)+1; return acc; }, {});
  Object.entries(byType).forEach(([t, c]) => console.log(`   ${t} : ${c}`));

  // Importer
  console.log('\n🚀 Import en cours…');
  let created = 0;
  let reused  = 0;

  for (let i = 0; i < rows.length; i++) {
    if ((i + 1) % 500 === 0 || i === rows.length - 1) {
      process.stdout.write(`\r   ${i + 1}/${rows.length} lignes — créés: ${created}, existants: ${reused}  `);
    }

    const { chain, type, auteur, annee } = rows[i];
    let parentId = null;

    for (let j = 0; j < chain.length; j++) {
      const { niveau, nom } = chain[j];
      const isLeaf = j === chain.length - 1;

      const { id, created: wasCreated } = await getOrCreate({
        niveau,
        nom,
        parentId,
        type,                          // propagé sur tous les niveaux
        auteur: isLeaf ? auteur : null,
        annee:  isLeaf ? annee  : null,
      });

      if (wasCreated) created++; else reused++;
      parentId = id;
    }
  }

  console.log('\n');
  console.log('✅ Import terminé');
  console.log(`   Nœuds créés   : ${created}`);
  console.log(`   Nœuds réutilisés : ${reused}`);

  // Bilan par type dans la base
  const counts = await prisma.taxonomieSpecimen.groupBy({
    by: ['niveau', 'type'],
    _count: true,
    orderBy: [{ type: 'asc' }, { niveau: 'asc' }],
  });
  console.log('\n📈 État final de la base :');
  counts
    .filter(x => x.type)
    .forEach(x => console.log(`   ${(x.type||'?').padEnd(12)} ${x.niveau.padEnd(14)} ${x._count}`));
}

main()
  .catch(err => { console.error('\n❌ Erreur :', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
