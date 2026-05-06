// backend/scripts/smoke-test.js
// Test end-to-end du flux complet après refonte Dictionnaire.
// Usage: node scripts/smoke-test.js  (suppose un serveur démarré sur :3000)

const BASE = 'http://localhost:3000/api/v1';
let token = null;

const colors = { reset:'\x1b[0m', g:'\x1b[32m', r:'\x1b[31m', y:'\x1b[33m', c:'\x1b[36m' };
const ok   = (m) => console.log(`${colors.g}✓${colors.reset} ${m}`);
const fail = (m) => console.log(`${colors.r}✗${colors.reset} ${m}`);
const info = (m) => console.log(`${colors.c}ℹ${colors.reset} ${m}`);

let passed = 0, failed = 0;

async function call(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token && !opts.noAuth) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, body: json };
}

async function expect(label, fn) {
  try {
    await fn();
    ok(label);
    passed++;
  } catch (err) {
    fail(`${label} — ${err.message}`);
    failed++;
  }
}

(async () => {
  console.log('\n═══ Smoke test — SpécimenManager ═══\n');

  // 1. Health
  await expect('GET /api/health', async () => {
    const r = await fetch('http://localhost:3000/api/health');
    if (r.status !== 200) throw new Error('status ' + r.status);
  });

  // 2. Login
  await expect('POST /auth/login (admin)', async () => {
    const r = await call('POST', '/auth/login', {
      email: 'andrianinar@pasteur.mg',
      password: 'Admin1234!',
    }, { noAuth: true });
    if (r.status !== 200) throw new Error(`status ${r.status} — ${JSON.stringify(r.body)}`);
    if (!r.body.token)    throw new Error('pas de token');
    token = r.body.token;
  });

  // 3. Dictionnaire — taxonomies
  let taxoMoustiqueId = null;
  await expect('GET /dictionnaire/taxonomie-specimens/tree?type=moustique', async () => {
    const r = await call('GET', '/dictionnaire/taxonomie-specimens/tree?type=moustique');
    if (r.status !== 200) throw new Error('status ' + r.status);
    if (!r.body.tree?.length) throw new Error('arbre vide');
    info(`  → ${r.body.tree.length} ordre(s) racine`);
  });

  await expect('GET espece moustique (référentiel)', async () => {
    const r = await call('GET', '/dictionnaire/taxonomie-specimens?type=moustique&niveau=espece&actif=true');
    if (r.status !== 200) throw new Error('status ' + r.status);
    if (!r.body.items?.length) throw new Error('aucune espèce');
    taxoMoustiqueId = r.body.items[0].id;
    info(`  → ${r.body.items.length} espèces, exemple: ${r.body.items[0].nom} (id=${taxoMoustiqueId})`);
  });

  let taxoHoteId = null;
  await expect('GET espece hote', async () => {
    const r = await call('GET', '/dictionnaire/taxonomie-hotes?niveau=espece&actif=true');
    if (r.status !== 200) throw new Error('status ' + r.status);
    if (!r.body.items?.length) throw new Error('aucune espèce hôte');
    taxoHoteId = r.body.items[0].id;
    info(`  → ${r.body.items.length} espèces, exemple: ${r.body.items[0].nom} (id=${taxoHoteId})`);
  });

  let typeMethodeId = null;
  await expect('GET types-methode', async () => {
    const r = await call('GET', '/dictionnaire/types-methode?actif=true');
    if (r.status !== 200) throw new Error('status ' + r.status);
    if (!r.body.items?.length) throw new Error('aucun type');
    typeMethodeId = r.body.items[0].id;
    info(`  → ${r.body.items.length} types, exemple: ${r.body.items[0].code} (id=${typeMethodeId})`);
  });

  await expect('GET solutions-conservation', async () => {
    const r = await call('GET', '/dictionnaire/solutions-conservation?actif=true');
    if (r.status !== 200) throw new Error('status ' + r.status);
    if (!r.body.items?.length) throw new Error('aucune solution');
    info(`  → ${r.body.items.length} solutions`);
  });

  await expect('GET types-environnement', async () => {
    const r = await call('GET', '/dictionnaire/types-environnement?actif=true');
    if (r.status !== 200) throw new Error('status ' + r.status);
    if (!r.body.items?.length) throw new Error('aucun environnement');
    info(`  → ${r.body.items.length} environnements`);
  });

  await expect('GET types-habitat', async () => {
    const r = await call('GET', '/dictionnaire/types-habitat?actif=true');
    if (r.status !== 200) throw new Error('status ' + r.status);
    if (!r.body.items?.length) throw new Error('aucun habitat');
    info(`  → ${r.body.items.length} habitats`);
  });

  // 4. Création d'un projet
  const projetCode = `TEST-${Date.now().toString().slice(-6)}`;
  let projetId = null;
  await expect('POST /projets', async () => {
    const r = await call('POST', '/projets', {
      code: projetCode,
      nom: 'Smoke test ' + projetCode,
      description: 'Test automatisé',
    });
    if (r.status !== 201) throw new Error(`status ${r.status} — ${JSON.stringify(r.body)}`);
    projetId = r.body.projet.id;
    info(`  → projet id=${projetId}`);
  });

  // 5. Création mission
  const ordreMission = `OM-${Date.now()}`;
  let missionId = null;
  await expect('POST /missions', async () => {
    const r = await call('POST', '/missions', {
      ordreMission,
      projetId,
      dateDebut: '2026-05-01',
    });
    if (r.status !== 201) throw new Error(`status ${r.status} — ${JSON.stringify(r.body)}`);
    missionId = r.body.mission.id;
    info(`  → mission id=${missionId}`);
  });

  // 6. Création localité
  let localiteId = null;
  await expect('POST /localites', async () => {
    const r = await call('POST', '/localites', {
      missionId,
      nom: 'Antananarivo (test)',
      region: 'Analamanga',
      latitude: -18.91,
      longitude: 47.52,
    });
    if (r.status !== 201) throw new Error(`status ${r.status} — ${JSON.stringify(r.body)}`);
    localiteId = r.body.localite.id;
    info(`  → localité id=${localiteId}`);
  });

  // 7. Création méthode (FK)
  let methodeId = null;
  await expect('POST /methodes (avec FK type)', async () => {
    const r = await call('POST', '/methodes', {
      localiteId,
      typeMethodeId,
      latitude: -18.91,
      longitude: 47.52,
      dateCollecte: '2026-05-02',
    });
    if (r.status !== 201) throw new Error(`status ${r.status} — ${JSON.stringify(r.body)}`);
    methodeId = r.body.methode.id;
    info(`  → méthode id=${methodeId}, type: ${r.body.methode.typeMethode?.nom}`);
  });

  // 8. Création hôte (FK)
  let hoteId = null;
  await expect('POST /hotes (avec FK taxonomie)', async () => {
    const r = await call('POST', '/hotes', {
      methodeId,
      taxonomieHoteId: taxoHoteId,
      especeLocale: 'Voalavo',
      sexe: 'M',
    });
    if (r.status !== 201) throw new Error(`status ${r.status} — ${JSON.stringify(r.body)}`);
    hoteId = r.body.hote.id;
    info(`  → hôte id=${hoteId}, taxo: ${r.body.hote.taxonomieHote?.nom}`);
  });

  // 9. Création moustique avec FK taxonomie
  let moustiqueId = null;
  await expect('POST /moustiques (FK taxonomie obligatoire)', async () => {
    const r = await call('POST', '/moustiques', {
      methodeId,
      taxonomieId: taxoMoustiqueId,
      nombre: 5,
      sexe: 'F',
      stade: 'Adulte',
    });
    if (r.status !== 201) throw new Error(`status ${r.status} — ${JSON.stringify(r.body)}`);
    moustiqueId = r.body.moustique.id;
    const t = r.body.moustique.taxonomie;
    info(`  → moustique id=${moustiqueId}, taxo: ${t?.parent?.nom} ${t?.nom}`);
  });

  // 10. Vérifier qu'on ne peut PAS créer un moustique sans taxonomie
  await expect('POST /moustiques sans taxonomieId → 400', async () => {
    const r = await call('POST', '/moustiques', {
      methodeId,
      nombre: 1,
    });
    if (r.status !== 400) throw new Error(`devrait renvoyer 400, a renvoyé ${r.status}`);
  });

  // 11. Créer un type de méthode + le désactiver (test audit)
  let nouveauTypeId = null;
  await expect('POST /dictionnaire/types-methode', async () => {
    const r = await call('POST', '/dictionnaire/types-methode', {
      code: 'TEST-' + Date.now().toString().slice(-5),
      nom: 'Type test smoke',
    });
    if (r.status !== 201) throw new Error(`status ${r.status} — ${JSON.stringify(r.body)}`);
    nouveauTypeId = r.body.item.id;
  });

  await expect('PATCH /dictionnaire/types-methode/:id/desactiver', async () => {
    const r = await call('PATCH', `/dictionnaire/types-methode/${nouveauTypeId}/desactiver`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (r.body.item.actif !== false) throw new Error('actif devrait être false');
  });

  await expect('PATCH /dictionnaire/types-methode/:id/activer', async () => {
    const r = await call('PATCH', `/dictionnaire/types-methode/${nouveauTypeId}/activer`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (r.body.item.actif !== true) throw new Error('actif devrait être true');
  });

  // 12. Vérifier l'audit log
  await expect('GET /dictionnaire/audit-logs (admin)', async () => {
    const r = await call('GET', '/dictionnaire/audit-logs?entity=TypeMethodeCollecte');
    if (r.status !== 200) throw new Error('status ' + r.status);
    if (!r.body.items?.length) throw new Error('aucune entrée audit');
    const actions = r.body.items.map((i) => i.action);
    if (!actions.includes('CREATE'))     throw new Error('CREATE manquant');
    if (!actions.includes('DEACTIVATE')) throw new Error('DEACTIVATE manquant');
    if (!actions.includes('ACTIVATE'))   throw new Error('ACTIVATE manquant');
    info(`  → ${r.body.items.length} entrées (CREATE, DEACTIVATE, ACTIVATE bien tracées)`);
  });

  // 13. Hiérarchie : tenter de créer un genre sans parent → 400
  await expect('POST taxo genre sans parent → 400', async () => {
    const r = await call('POST', '/dictionnaire/taxonomie-specimens', {
      niveau: 'genre',
      nom:    'Faux',
    });
    if (r.status !== 400) throw new Error(`devrait renvoyer 400, a renvoyé ${r.status}`);
  });

  // 14. Suppression (cleanup) — on ne peut pas tout supprimer mais on retire le projet vide
  await expect('DELETE /moustiques/:id', async () => {
    const r = await call('DELETE', `/moustiques/${moustiqueId}`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });
  await expect('DELETE /hotes/:id', async () => {
    const r = await call('DELETE', `/hotes/${hoteId}`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });
  await expect('DELETE /methodes/:id', async () => {
    const r = await call('DELETE', `/methodes/${methodeId}`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });
  await expect('DELETE /localites/:id', async () => {
    const r = await call('DELETE', `/localites/${localiteId}`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });
  await expect('DELETE /missions/:id', async () => {
    const r = await call('DELETE', `/missions/${missionId}`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });
  await expect('DELETE /projets/:id', async () => {
    const r = await call('DELETE', `/projets/${projetId}`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });
  await expect('DELETE /dictionnaire/types-methode/:id (cleanup)', async () => {
    const r = await call('DELETE', `/dictionnaire/types-methode/${nouveauTypeId}`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });

  console.log(`\n═══ Résultats : ${colors.g}${passed} OK${colors.reset}, ${failed > 0 ? colors.r : colors.g}${failed} échec(s)${colors.reset} ═══\n`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Crash:', err);
  process.exit(2);
});
