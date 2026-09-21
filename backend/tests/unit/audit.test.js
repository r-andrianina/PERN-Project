// Construction des entrées d'audit.
//
// Ces règles portent la traçabilité des connexions ajoutée le 2026-09-14, après
// une enquête où il a fallu établir qui avait lancé un import depuis un compte
// dont le titulaire démentait l'avoir fait. L'IP et le user-agent ont permis de
// trancher pour l'import ; ils manquaient totalement pour l'authentification.
const fs = require('fs');
const path = require('path');
const { buildAuditData, ACTIONS } = require('../../src/utils/audit');

const req = (over = {}) => ({
  ip: '172.23.0.1',
  method: 'POST',
  originalUrl: '/api/v1/auth/login',
  headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/153' },
  ...over,
});

describe('buildAuditData — auteur de l\'entrée', () => {
  it('prend userId quand req.user n\'existe pas encore (cas de la connexion)', () => {
    // Au moment où login() journalise, aucun token n'a été vérifié : sans
    // l'override, l'entrée serait anonyme et « qui s'est connecté ? » resterait
    // sans réponse — ce qui viderait la traçabilité de son objet.
    const d = buildAuditData({
      req: req(), action: ACTIONS.LOGIN, entity: 'Auth', entityId: 7, userId: 7,
    });
    expect(d.userId).toBe(7);
  });

  it('retombe sur req.user.id quand aucun userId n\'est passé', () => {
    // Garde de non-régression : tous les appels existants comptent dessus.
    const d = buildAuditData({
      req: req({ user: { id: 42 } }), action: ACTIONS.UPDATE, entity: 'Mission', entityId: 3,
    });
    expect(d.userId).toBe(42);
  });

  it('donne la priorité à userId sur req.user.id', () => {
    const d = buildAuditData({
      req: req({ user: { id: 42 } }), action: ACTIONS.LOGIN, entity: 'Auth', entityId: 7, userId: 7,
    });
    expect(d.userId).toBe(7);
  });

  it('accepte une entrée sans auteur identifiable', () => {
    // Tentative sur un email inconnu : il n'existe aucun utilisateur à citer.
    const d = buildAuditData({ req: req(), action: ACTIONS.LOGIN_FAILED, entity: 'Auth', entityId: 0 });
    expect(d.userId).toBeNull();
  });
});

describe('buildAuditData — métadonnées d\'enquête', () => {
  it('capture l\'IP et le user-agent', () => {
    // Ce sont EXACTEMENT les deux champs qui ont permis de distinguer un appel
    // direct à l'API (127.0.0.1, user-agent vide) d'une action faite depuis un
    // navigateur. Sans eux, l'entrée dit « qui » mais jamais « d'où ».
    const d = buildAuditData({ req: req(), action: ACTIONS.LOGIN, entity: 'Auth', entityId: 7 });
    expect(d.metadata.ip).toBe('172.23.0.1');
    expect(d.metadata.userAgent).toContain('Chrome/153');
    expect(d.metadata.path).toBe('/api/v1/auth/login');
  });

  it('ne pose ni ip ni user-agent en dur quand la requête n\'en fournit pas', () => {
    const d = buildAuditData({
      req: { headers: {} }, action: ACTIONS.LOGIN_FAILED, entity: 'Auth', entityId: 0,
    });
    expect(d.metadata.ip).toBeNull();
    expect(d.metadata.userAgent).toBeNull();
  });
});

describe('ACTIONS reste aligné sur l\'énumération Prisma', () => {
  // Une action absente de l'enum PostgreSQL fait échouer l'INSERT à l'exécution,
  // et `logAudit` avale ses erreurs : la perte serait SILENCIEUSE. Ce test est
  // le seul endroit qui relie les deux déclarations.
  it('chaque valeur de ACTIONS existe dans enum AuditAction', () => {
    const schema = fs.readFileSync(
      path.join(__dirname, '../../prisma/schema.prisma'), 'utf8',
    );
    const bloc = schema.match(/enum AuditAction \{([^}]*)\}/);
    expect(bloc).not.toBeNull();

    const valeursPrisma = bloc[1]
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter(Boolean);

    for (const action of Object.values(ACTIONS)) {
      expect(valeursPrisma).toContain(action);
    }
  });

  it('expose LOGIN et LOGIN_FAILED', () => {
    expect(ACTIONS.LOGIN).toBe('LOGIN');
    expect(ACTIONS.LOGIN_FAILED).toBe('LOGIN_FAILED');
  });
});
