// backend/scripts/import-taxo.js
// Import du dictionnaire taxonomique depuis Dico_Taxo.xlsx
//
// Usage (depuis la racine du projet) :
//   node backend/scripts/import-taxo.js [chemin_fichier]
//
// Par défaut : ./fichiers/Dico_Taxo.xlsx
// - Les entrées VAL sont importées comme nœuds de la hiérarchie (+ pays_type).
// - Les entrées SYN dont le "rattachement" pointe vers un nom VAL connu sont
//   importées comme synonymes de recherche (TaxonomieSynonyme) — pas comme
//   nœuds de l'arbre, un synonyme n'a pas de place propre dans la hiérarchie.
// Mapping : Diptera/Culicidae → moustique | Ixodida → tique | Siphonaptera → puce
//           tout le reste → autre (cf. detectType)

const path    = require('path');
const ExcelJS = require('exceljs');
const prisma  = require('../src/config/prisma');
const { detectType } = require('../src/utils/taxonomyType');

const FILE = process.argv[2]
  || path.join(__dirname, '../../fichiers/Dico_Taxo.xlsx');

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

// Niveaux où un nom doit être unique sur tout l'arbre (même type), pas
// seulement sous le même parent — même règle que le contrôleur CRUD
// (GLOBAL_UNIQUE_LEVELS dans taxonomieSpecimens.controller.js). Nécessaire
// car le fichier source laisse la colonne sous_famille vide sur certaines
// lignes pour un genre par ailleurs déjà classé ailleurs : sans ce garde-fou
// le genre est recréé comme doublon directement sous la famille plutôt que
// réutilisé sous sa sous-famille (incident constaté le 2026-08-05).
const GLOBAL_UNIQUE_LEVELS = ['ordre', 'famille', 'sous_famille', 'genre', 'sous_genre'];

// ── Cache (niveau:nom_lower:parentId-ou-type) → id ──────────
const cache = new Map();
function cacheKey(niveau, nom, parentId, type) {
  return GLOBAL_UNIQUE_LEVELS.includes(niveau)
    ? `${niveau}:${nom.toLowerCase()}:${type}`
    : `${niveau}:${nom.toLowerCase()}:${parentId ?? 'null'}`;
}

// ── Rattachements divergents ────────────────────────────────
// La règle d'unicité globale ci-dessus réutilise un nom déjà connu ailleurs
// dans l'arbre. C'est voulu, mais ça veut dire qu'une ligne réclamant le même
// nom sous un AUTRE parent voit son rattachement ignoré en silence. Le cas
// existait déjà (puce : Coptopsylla sous Coptopsyllidae ET Hystrichopsyllidae)
// et s'étend avec le type `autre` (Cimex sous Cimicidae ET Reduviidae). On ne
// change pas la règle — on cesse juste de taire ce qu'elle décide.
const parentRetenu    = new Map();   // clé de cache → parentId effectivement retenu
const divergences     = [];          // { niveau, nom, type, retenuId, demandeId }
function noterRattachement(key, { niveau, nom, type, parentId, id }) {
  const connu = parentRetenu.get(key);
  if (connu === undefined) { parentRetenu.set(key, parentId ?? null); return; }
  if (connu === (parentId ?? null)) return;
  if (divergences.some((d) => d.nom === nom && d.niveau === niveau && d.demandeId === (parentId ?? null))) return;
  divergences.push({ niveau, nom, type, retenuId: connu, demandeId: parentId ?? null, id });
}

// ── Table de correspondance binomiale pour résoudre "rattachement" ──
// clé : "type:genre:espece[:sousespece]" (minuscules) → id du nœud espèce/sous_espece
const binomial = new Map();
function binomialKey(type, genre, espece, sousEspece) {
  return sousEspece
    ? `${type}:${genre.toLowerCase()}:${espece.toLowerCase()}:${sousEspece.toLowerCase()}`
    : `${type}:${genre.toLowerCase()}:${espece.toLowerCase()}`;
}

// ── Trouver ou créer un nœud (VAL) ──────────────────────────
async function getOrCreate({ niveau, nom, parentId, type, auteur, annee, paysType }) {
  const global = GLOBAL_UNIQUE_LEVELS.includes(niveau);
  const key = cacheKey(niveau, nom, parentId, type);
  if (cache.has(key)) {
    const id = cache.get(key);
    if (global) noterRattachement(key, { niveau, nom, type, parentId, id });
    // Sur les feuilles déjà en base, on complète pays_type s'il était vide
    // (ex: relancé après ajout de la colonne) — jamais d'écrasement.
    if (paysType) {
      await prisma.taxonomieSpecimen.updateMany({ where: { id, paysType: null }, data: { paysType } });
    }
    return { id, created: false };
  }

  // Pour les niveaux globalement uniques, on cherche par nom (insensible à
  // la casse) sur tout le type — pas seulement sous ce parent précis — pour
  // ne jamais recréer un genre déjà connu ailleurs dans l'arbre.
  const existing = await prisma.taxonomieSpecimen.findFirst({
    where: global
      ? { niveau, nom: { equals: nom, mode: 'insensitive' }, type }
      : { niveau, nom, parentId: parentId ?? null },
    select: { id: true, paysType: true, parentId: true },
  });

  if (existing) {
    cache.set(key, existing.id);
    if (global) {
      // Le parent retenu est celui du nœud DÉJÀ en base, pas celui demandé :
      // c'est lui qui fera foi pour les lignes suivantes.
      parentRetenu.set(key, existing.parentId ?? null);
      noterRattachement(key, { niveau, nom, type, parentId, id: existing.id });
    }
    if (paysType && !existing.paysType) {
      await prisma.taxonomieSpecimen.update({ where: { id: existing.id }, data: { paysType } });
    }
    return { id: existing.id, created: false };
  }

  const entry = await prisma.taxonomieSpecimen.create({
    data: { niveau, nom, parentId: parentId ?? null, type, auteur, annee, paysType: paysType ?? null, actif: true },
    select: { id: true },
  });
  cache.set(key, entry.id);
  if (global) parentRetenu.set(key, parentId ?? null);
  return { id: entry.id, created: true };
}

// ── Script principal ────────────────────────────────────────
async function main() {
  console.log('📂 Fichier :', FILE);

  // Pré-charger le cache depuis la base
  console.log('⏳ Chargement des entrées existantes…');
  const existing = await prisma.taxonomieSpecimen.findMany({
    select: { id: true, niveau: true, nom: true, parentId: true, type: true },
  });
  existing.forEach((e) => {
    const key = cacheKey(e.niveau, e.nom, e.parentId, e.type);
    cache.set(key, e.id);
    // Sans ça, au second passage le premier nœud rencontré ferait foi comme
    // « parent retenu » au lieu du parent réel déjà en base, et le rapport de
    // divergence désignerait la mauvaise branche.
    if (GLOBAL_UNIQUE_LEVELS.includes(e.niveau)) parentRetenu.set(key, e.parentId ?? null);
  });
  console.log(`   ${existing.length} entrées déjà en base (cache pré-chargé)`);

  // Lire l'Excel — un seul passage, on classe VAL et SYN dans deux listes.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  console.log(`📊 Feuille : "${ws.name}" — ${ws.rowCount - 1} lignes de données`);

  const valRows = [];
  const synRows = [];

  // Une ligne non retenue est une ligne que l'utilisateur ne retrouvera pas
  // dans le dictionnaire. On la compte et on dit pourquoi — c'est le silence
  // sur ce compteur qui a caché l'absence des Culicoides pendant des mois.
  const ecartees = { statut: new Map(), ordreManquant: [], chaineVide: [] };

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const v = row.values;
    const statut = (v[10] || '').toString().trim();
    if (statut !== 'VAL' && statut !== 'SYN') {
      const cle = statut || '(vide)';
      ecartees.statut.set(cle, (ecartees.statut.get(cle) || 0) + 1);
      return;
    }

    const ordre   = clean(v[1]);
    const famille = clean(v[2]);
    if (!ordre) { ecartees.ordreManquant.push(n); return; }

    const type = detectType(ordre, famille);

    const chain = [
      { niveau: 'ordre',        nom: ordre },
      { niveau: 'famille',      nom: clean(v[2]) },
      { niveau: 'sous_famille', nom: clean(v[3]) },
      { niveau: 'genre',        nom: clean(v[4]) },
      { niveau: 'sous_genre',   nom: clean(v[5]) },
      { niveau: 'espece',       nom: clean(v[6]) },
      { niveau: 'sous_espece',  nom: clean(v[7]) },
    ].filter(x => x.nom !== null);
    if (chain.length === 0) { ecartees.chaineVide.push(n); return; }

    const record = {
      chain, type,
      auteur:       clean(v[8], 100),
      annee:        cleanYear(v[9]),
      paysType:     clean(v[12], 150),
      rattachement: clean(v[11], 300),
      genre:        clean(v[4]),
      espece:       clean(v[6]),
      sousEspece:   clean(v[7]),
      ligne: n,
    };
    (statut === 'VAL' ? valRows : synRows).push(record);
  });

  console.log(`\n🔍 Lignes retenues — VAL : ${valRows.length} | SYN : ${synRows.length}`);
  const byType = valRows.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
  Object.entries(byType).forEach(([t, c]) => console.log(`   ${t} : ${c}`));

  // ── Ce qui n'entrera PAS dans le dictionnaire ───────────
  const totalStatut  = [...ecartees.statut.values()].reduce((a, b) => a + b, 0);
  const totalEcarte  = totalStatut + ecartees.ordreManquant.length + ecartees.chaineVide.length;
  const lu           = valRows.length + synRows.length + totalEcarte;
  console.log(`\n🚫 Lignes écartées : ${totalEcarte} / ${lu} lues`);
  if (totalStatut > 0) {
    const detail = [...ecartees.statut.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, c]) => `${k}:${c}`)
      .join(', ');
    console.log(`   statut hors VAL/SYN (${totalStatut}) — ${detail}`);
  }
  if (ecartees.ordreManquant.length > 0) {
    console.log(`   ordre absent ou non déterminé (${ecartees.ordreManquant.length}) — lignes ${ecartees.ordreManquant.slice(0, 10).join(', ')}${ecartees.ordreManquant.length > 10 ? '…' : ''}`);
  }
  if (ecartees.chaineVide.length > 0) {
    console.log(`   aucun rang exploitable (${ecartees.chaineVide.length}) — lignes ${ecartees.chaineVide.slice(0, 10).join(', ')}${ecartees.chaineVide.length > 10 ? '…' : ''}`);
  }

  // ── Import VAL ──────────────────────────────────────────
  console.log('\n🚀 Import des noms valides…');
  let created = 0;
  let reused  = 0;

  for (let i = 0; i < valRows.length; i++) {
    if ((i + 1) % 500 === 0 || i === valRows.length - 1) {
      process.stdout.write(`\r   ${i + 1}/${valRows.length} lignes — créés: ${created}, existants: ${reused}  `);
    }

    const { chain, type, auteur, annee, paysType, genre, espece, sousEspece } = valRows[i];
    let parentId = null;
    let leafId   = null;

    for (let j = 0; j < chain.length; j++) {
      const { niveau, nom } = chain[j];
      const isLeaf = j === chain.length - 1;

      const { id, created: wasCreated } = await getOrCreate({
        niveau, nom, parentId, type,
        auteur:   isLeaf ? auteur   : null,
        annee:    isLeaf ? annee    : null,
        paysType: isLeaf ? paysType : null,
      });

      if (wasCreated) created++; else reused++;
      parentId = id;
      leafId   = id;
    }

    // Table de correspondance pour la résolution des synonymes — seules les
    // feuilles espece/sous_espece peuvent être ciblées par un "rattachement".
    const leafNiveau = chain[chain.length - 1].niveau;
    if ((leafNiveau === 'espece' || leafNiveau === 'sous_espece') && genre && espece) {
      binomial.set(binomialKey(type, genre, espece, null), leafId);
      if (sousEspece) binomial.set(binomialKey(type, genre, espece, sousEspece), leafId);
    }
  }
  console.log('\n');
  console.log(`✅ Import VAL terminé — créés: ${created}, existants: ${reused}`);

  // ── Import SYN (synonymes de recherche) ─────────────────
  console.log('\n🚀 Import des synonymes…');
  const existingSyn = await prisma.taxonomieSynonyme.findMany({ select: { nom: true, taxonomieId: true } });
  const synCache = new Set(existingSyn.map((s) => `${s.nom.toLowerCase()}:${s.taxonomieId}`));

  let synCreated        = 0;
  let synSkippedNoMatch = 0;
  let synSkippedNoName  = 0;
  const unresolved = [];

  for (const r of synRows) {
    if (!r.rattachement || !r.genre || !r.espece) { synSkippedNoName++; continue; }

    // rattachement = "Genre espece [sousespece]" — résout vers le nœud VAL.
    const parts = r.rattachement.split(/\s+/);
    if (parts.length < 2) { synSkippedNoMatch++; unresolved.push(r); continue; }
    const [rGenre, rEspece, rSousEspece] = parts;

    let targetId = rSousEspece ? binomial.get(binomialKey(r.type, rGenre, rEspece, rSousEspece)) : undefined;
    if (!targetId) targetId = binomial.get(binomialKey(r.type, rGenre, rEspece, null));
    if (!targetId) { synSkippedNoMatch++; unresolved.push(r); continue; }

    const synNom = r.sousEspece ? `${r.genre} ${r.espece} ${r.sousEspece}` : `${r.genre} ${r.espece}`;
    const key = `${synNom.toLowerCase()}:${targetId}`;
    if (synCache.has(key)) continue;

    await prisma.taxonomieSynonyme.create({
      data: { nom: synNom, auteur: r.auteur, annee: r.annee, taxonomieId: targetId },
    });
    synCache.add(key);
    synCreated++;
  }

  console.log(`✅ Synonymes créés : ${synCreated}`);
  console.log(`   Ignorés (rattachement introuvable dans les noms valides) : ${synSkippedNoMatch}`);
  console.log(`   Ignorés (rattachement ou nom d'origine incomplet) : ${synSkippedNoName}`);
  if (unresolved.length > 0) {
    console.log(`\n⚠️  Exemples de rattachements non résolus (${Math.min(5, unresolved.length)}/${unresolved.length}) :`);
    unresolved.slice(0, 5).forEach((r) =>
      console.log(`   ligne ${r.ligne} : "${r.genre} ${r.espece}" (${r.type}) → rattachement "${r.rattachement}"`)
    );
  }

  // ── Noms réclamés sous deux parents différents ──────────
  if (divergences.length > 0) {
    const ids = [...new Set(divergences.flatMap((d) => [d.retenuId, d.demandeId]).filter((x) => x !== null))];
    const noeuds = await prisma.taxonomieSpecimen.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true } });
    const nomDe = new Map(noeuds.map((x) => [x.id, x.nom]));
    const label = (id) => (id === null ? 'racine' : nomDe.get(id) || `#${id}`);
    console.log(`\n⚠️  Noms réclamés sous plusieurs parents : ${divergences.length}`);
    console.log('   La règle d\'unicité globale a gardé le premier rattachement ; le second est ignoré.');
    divergences.slice(0, 20).forEach((d) =>
      console.log(`   ${d.type.padEnd(10)} ${d.niveau.padEnd(13)} ${d.nom} — retenu sous ${label(d.retenuId)}, aussi déclaré sous ${label(d.demandeId)}`)
    );
    if (divergences.length > 20) console.log(`   … et ${divergences.length - 20} autres`);
  }

  // Bilan par type dans la base
  const counts = await prisma.taxonomieSpecimen.groupBy({
    by: ['niveau', 'type'], _count: true, orderBy: [{ type: 'asc' }, { niveau: 'asc' }],
  });
  console.log('\n📈 État final de la base (taxonomie_specimens) :');
  counts.filter((x) => x.type).forEach((x) => console.log(`   ${(x.type || '?').padEnd(12)} ${x.niveau.padEnd(14)} ${x._count}`));
  const synTotal = await prisma.taxonomieSynonyme.count();
  console.log(`\n📈 Synonymes en base : ${synTotal}`);
}

main()
  .catch((err) => { console.error('\n❌ Erreur :', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
