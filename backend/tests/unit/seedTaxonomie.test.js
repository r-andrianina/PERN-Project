// Règle d'unicité des noms taxonomiques : un nom de rang supérieur doit être
// unique sur TOUT l'arbre, pas seulement sous son parent.
//
// Quatre endroits l'appliquent — les deux contrôleurs CRUD, scripts/import-taxo.js
// et prisma/seed.js. Le seed s'en écartait, ce qui a produit en production des
// genres présents deux fois (« Aedes » sous Culicinae ET sous Culicidae) et
// éclaté 318 moustiques entre les deux branches.
//
// Ce test compare les quatre définitions par lecture de source : c'est le seul
// moyen de les confronter, aucune n'étant exportée.
const fs   = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '../..');
const SOURCES = {
  'controllers/taxonomieSpecimens': 'src/controllers/taxonomieSpecimens.controller.js',
  'controllers/taxonomieHotes':     'src/controllers/taxonomieHotes.controller.js',
  'scripts/import-taxo':            'scripts/import-taxo.js',
  'prisma/seed':                    'prisma/seed.js',
};

const extraireNiveaux = (fichier) => {
  const src = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
  const m = /GLOBAL_UNIQUE_LEVELS\s*=\s*\[([^\]]+)\]/.exec(src);
  if (!m) return null;
  return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
};

describe('taxonomie — règle d\'unicité partagée', () => {
  it('les quatre sources déclarent la règle', () => {
    const absentes = Object.entries(SOURCES)
      .filter(([, f]) => extraireNiveaux(f) === null)
      .map(([nom]) => nom);
    expect(absentes).toEqual([]);
  });

  it('les quatre listes de niveaux sont identiques', () => {
    const listes = Object.entries(SOURCES).map(([nom, f]) => [nom, extraireNiveaux(f)]);
    const reference = listes[0][1];
    for (const [nom, niveaux] of listes) {
      expect(niveaux, `divergence dans ${nom}`).toEqual(reference);
    }
  });

  it('la règle couvre bien les rangs supérieurs, pas les espèces', () => {
    const niveaux = extraireNiveaux(SOURCES['prisma/seed']);
    expect(niveaux).toEqual(['ordre', 'famille', 'sous_famille', 'genre', 'sous_genre']);
    expect(niveaux).not.toContain('espece');      // un épithète se répète
    expect(niveaux).not.toContain('sous_espece'); // légitimement d'un genre à l'autre
  });

  it('le seed cherche un rang supérieur SANS filtrer sur le parent', () => {
    // C'est précisément ce filtre qui recréait un genre déjà présent ailleurs.
    const src = fs.readFileSync(path.join(RACINE, 'prisma/seed.js'), 'utf8');
    const bloc = src.slice(src.indexOf('const rechercheNoeud'), src.indexOf('async function main'));
    expect(bloc).toMatch(/GLOBAL_UNIQUE_LEVELS\.includes\(niveau\)/);
    expect(bloc).toMatch(/mode:\s*'insensitive'/);
  });
});
