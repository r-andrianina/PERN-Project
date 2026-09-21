#!/usr/bin/env node
// Migration de données « une méthode = une nuit-piège ».
//
// Contexte — cf. commit 96295d5. La date du fichier IPM (DATE_OF_COLLECTION)
// est le matin où le piège a été RELEVÉ, mais l'import l'écrivait dans
// `datePose` et déduisait le relevé à J+1. Le code lit désormais la date de
// collecte dans `dateReleve` ; toute base écrite avant ce changement porte
// donc des méthodes datées d'un jour de trop.
//
//   modèle retenu :  dateReleve = matin de collecte = specimen.dateCollecte
//                    datePose   = dateReleve − 1
//
// Ce script ne touche JAMAIS à `dateCollecte` : c'est la donnée de terrain,
// la seule qui n'ait jamais été fausse. Ce sont les dates de la MÉTHODE qui
// viennent s'aligner sur elle.
//
// Un second défaut est corrigé au passage : la saisie manuelle laissait une
// méthode couvrir plusieurs nuits, ce qui fait compter UNE nuit-piège là où
// il y en avait cinq et surestime d'autant toute densité « captures / piège /
// nuit ». Ces méthodes sont découpées, une par nuit.
//
// ── Emploi ────────────────────────────────────────────────────────────────
//   node scripts/migrate-nuit-piege.js                 diagnostic seul
//   node scripts/migrate-nuit-piege.js --apply         applique
//   node scripts/migrate-nuit-piege.js --apply --decaler-vides
//
// Sans `--apply`, RIEN n'est écrit : le script affiche ce qu'il ferait. C'est
// le mode par défaut parce qu'un script de migration de données se lance une
// fois sur une base de production et qu'on veut lire avant de signer.
//
// ── Ré-exécution ──────────────────────────────────────────────────────────
// Le script est idempotent sur les méthodes QUI PORTENT DES SPÉCIMENS : une
// méthode déjà conforme (`dateReleve` == date de collecte de ses spécimens)
// est reconnue et laissée telle quelle. Le relancer ne décale donc rien deux
// fois.
//
// Il ne peut PAS l'être sur les méthodes sans aucun spécimen — une nuit à
// capture nulle. Rien dans la ligne ne dit si son décalage a déjà eu lieu :
// `datePose` seule est indiscernable d'un `datePose` déjà corrigé. Ces
// méthodes sont donc signalées et laissées de côté, sauf `--decaler-vides`,
// qui les décale d'un jour EN AVEUGLE — à n'utiliser qu'une fois, sur une
// base dont on sait qu'elle n'a jamais été migrée.

const prisma = require('../src/config/prisma');

const TABLES = ['moustique', 'tique', 'puce'];

const APPLIQUER     = process.argv.includes('--apply');
const DECALER_VIDES = process.argv.includes('--decaler-vides');

/** Jour civil d'une date, en UTC — seule forme comparable entre `@db.Date`
 *  (dateCollecte) et `timestamp` (datePose/dateReleve). */
const jour = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** La veille, en UTC. Passer par setUTCDate gère les fins de mois et les
 *  années bissextiles ; une soustraction de 86 400 000 ms ne l'aurait pas
 *  fait de façon fiable sur un timestamp non-UTC. */
const veille = (d) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - 1);
  return x;
};

/** Les nuits distinctes d'une méthode, tous types de spécimens confondus. */
async function nuitsDeLaMethode(tx, methodeId) {
  const nuits = new Map(); // jour -> { date, parTable: { moustique: n, ... } }
  for (const table of TABLES) {
    const lignes = await tx[table].groupBy({
      by:    ['dateCollecte'],
      where: { methodeId, dateCollecte: { not: null } },
      _count: { _all: true },
    });
    for (const l of lignes) {
      const cle = jour(l.dateCollecte);
      if (!nuits.has(cle)) nuits.set(cle, { date: l.dateCollecte, parTable: {} });
      nuits.get(cle).parTable[table] = l._count._all;
    }
  }
  // Ordre chronologique : la nuit la plus ancienne garde la méthode d'origine,
  // les suivantes reçoivent un clone. Arbitraire mais stable, donc rejouable.
  return [...nuits.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([cle, v]) => ({ cle, ...v }));
}

async function migrer() {
  const rapport = {
    conformes: 0, decalees: 0, creees: 0, deplaces: 0,
    vides: [], sansDateCollecte: [], journal: [],
  };

  await prisma.$transaction(async (tx) => {
    const methodes = await tx.methodeCollecte.findMany({ orderBy: { id: 'asc' } });

    for (const mc of methodes) {
      const nuits = await nuitsDeLaMethode(tx, mc.id);

      // ── Méthode sans spécimen daté ──
      if (nuits.length === 0) {
        const aDesSpecimens = (await Promise.all(
          TABLES.map((t) => tx[t].count({ where: { methodeId: mc.id } })),
        )).some((n) => n > 0);

        // Des spécimens mais aucune date de collecte : on ne peut rien
        // déduire, et deviner serait pire que ne rien faire.
        if (aDesSpecimens) { rapport.sansDateCollecte.push(mc.id); continue; }

        if (mc.datePose === null) continue;       // rien à décaler
        if (!DECALER_VIDES) { rapport.vides.push(mc.id); continue; }

        await tx.methodeCollecte.update({
          where: { id: mc.id },
          data:  { dateReleve: mc.datePose, datePose: veille(mc.datePose) },
        });
        rapport.decalees++;
        rapport.journal.push(`  méthode ${mc.id} (vide) : relevé ${jour(mc.datePose)}`);
        continue;
      }

      for (const [i, n] of nuits.entries()) {
        // ── La première nuit reste sur la méthode d'origine ──
        if (i === 0) {
          if (jour(mc.dateReleve) === n.cle && jour(mc.datePose) === jour(veille(n.date))) {
            rapport.conformes++;                  // déjà migrée : on passe
            continue;
          }
          await tx.methodeCollecte.update({
            where: { id: mc.id },
            data:  { dateReleve: n.date, datePose: veille(n.date) },
          });
          rapport.decalees++;
          rapport.journal.push(
            `  méthode ${mc.id} : pose ${jour(mc.datePose)}→${jour(veille(n.date))}, `
            + `relevé ${jour(mc.dateReleve)}→${n.cle}`,
          );
          continue;
        }

        // ── Nuits suivantes : une méthode par nuit ──
        // Le clone reprend tout de la méthode source (piège, coordonnées,
        // localité) sauf son identité et ses horodatages techniques.
        const { id: _id, createdAt: _c, updatedAt: _u, ...copie } = mc;
        const neuve = await tx.methodeCollecte.create({
          data: { ...copie, dateReleve: n.date, datePose: veille(n.date) },
        });
        rapport.creees++;

        let deplaces = 0;
        for (const table of TABLES) {
          const r = await tx[table].updateMany({
            where: { methodeId: mc.id, dateCollecte: n.date },
            data:  { methodeId: neuve.id },
          });
          deplaces += r.count;
        }
        rapport.deplaces += deplaces;
        rapport.journal.push(
          `  méthode ${neuve.id} (détachée de ${mc.id}) : relevé ${n.cle}, ${deplaces} spécimen(s)`,
        );
      }
    }

    // ── Invariant, vérifié AVANT le commit ──
    // C'est le filet du script : si l'une des règles du modèle n'est pas
    // tenue, on lève et la transaction est annulée en entier. Mieux vaut ne
    // rien migrer qu'à moitié.
    const restes = [];
    for (const table of TABLES) {
      const mauvais = await tx.$queryRawUnsafe(`
        SELECT count(*)::int AS n FROM ${table}s s
        JOIN methodes_collecte mc ON mc.id = s.methode_id
        WHERE s.date_collecte IS NOT NULL
          AND mc.date_releve IS NOT NULL
          AND s.date_collecte <> mc.date_releve::date`);
      if (mauvais[0].n > 0) restes.push(`${mauvais[0].n} ${table}(s) dont la date de collecte ≠ relevé de la méthode`);
    }
    const poseIncoherente = await tx.$queryRawUnsafe(`
      SELECT count(*)::int AS n FROM methodes_collecte
      WHERE date_releve IS NOT NULL AND date_pose IS NOT NULL
        AND date_pose <> date_releve - interval '1 day'`);
    if (poseIncoherente[0].n > 0) restes.push(`${poseIncoherente[0].n} méthode(s) dont la pose ≠ relevé − 1`);

    if (restes.length > 0) {
      throw new Error(`invariant non tenu, rien n'est écrit :\n    - ${restes.join('\n    - ')}`);
    }

    // Sortie par exception en simulation : c'est la seule façon d'annuler la
    // transaction APRÈS l'avoir entièrement jouée, donc de rapporter un
    // résultat réel — invariant compris — et non une estimation.
    if (!APPLIQUER) {
      const simulation = new Error('simulation');
      simulation.__simulation = true;
      simulation.rapport = rapport;
      throw simulation;
    }
  }, { timeout: 120_000 });

  return rapport;
}

function afficher(rapport, simule) {
  const t = rapport.journal.length;
  console.log(`\n${simule ? '── SIMULATION (rien n\'a été écrit) ──' : '── MIGRATION APPLIQUÉE ──'}\n`);
  if (t > 0) {
    console.log(rapport.journal.slice(0, 40).join('\n'));
    if (t > 40) console.log(`  … et ${t - 40} autres`);
    console.log();
  }
  console.log(`  méthodes déjà conformes  : ${rapport.conformes}`);
  console.log(`  méthodes décalées        : ${rapport.decalees}`);
  console.log(`  méthodes créées (nuits)  : ${rapport.creees}`);
  console.log(`  spécimens rerattachés    : ${rapport.deplaces}`);
  console.log('  spécimens redatés        : 0  (jamais : dateCollecte est la donnée de terrain)');

  if (rapport.vides.length > 0) {
    console.log(
      `\n  ⚠ ${rapport.vides.length} méthode(s) sans spécimen, laissée(s) de côté : `
      + `${rapport.vides.slice(0, 15).join(', ')}${rapport.vides.length > 15 ? '…' : ''}`
      + '\n    Leur décalage ne peut pas être déduit ni rejoué sans risque.'
      + '\n    Relancer avec --decaler-vides SI cette base n\'a jamais été migrée.',
    );
  }
  if (rapport.sansDateCollecte.length > 0) {
    console.log(
      `\n  ⚠ ${rapport.sansDateCollecte.length} méthode(s) portant des spécimens SANS date de collecte, `
      + `ignorée(s) : ${rapport.sansDateCollecte.join(', ')}`
      + '\n    À arbitrer à la main : rien dans la base ne dit quelle nuit elles couvrent.',
    );
  }
  if (simule) console.log('\n  Relancer avec --apply pour écrire.');
  console.log();
}

(async () => {
  try {
    const rapport = await migrer();
    afficher(rapport, false);
  } catch (err) {
    // Le mode simulation sort par une exception : c'est la seule façon
    // d'annuler la transaction après l'avoir entièrement jouée, donc de
    // montrer un résultat RÉEL plutôt qu'une estimation.
    if (err && err.__simulation) {
      afficher(err.rapport, true);
    } else {
      console.error(`\n  ✖ ${err.message}\n`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
})();
