'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '..', '..', 'specimenmanager_conception.pdf');

const C = {
  navy:      '#0D2137',
  blue:      '#1565C0',
  lightBlue: '#1E88E5',
  cyan:      '#039BE5',
  green:     '#2E7D32',
  amber:     '#F57F17',
  red:       '#C62828',
  gray:      '#546E7A',
  lightGray: '#ECEFF1',
  white:     '#FFFFFF',
  black:     '#212121',
};

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 55, bottom: 55, left: 55, right: 55 },
  info: {
    Title: 'SpécimenManager — Conception Technique',
    Author: 'Institut Pasteur Madagascar',
    Subject: 'Architecture & Design Document',
    Creator: 'Claude Code — Anthropic',
  },
});

doc.pipe(fs.createWriteStream(OUTPUT));

const PW = 595.28;
const PH = 841.89;
const ML = 55, MR = 55;
const CW = PW - ML - MR;   // content width = 485

let pageNum = 0;

// ─── page management ────────────────────────────────────────────────────────

function newPage(isCover) {
  if (pageNum > 0) doc.addPage();
  pageNum++;
  if (!isCover) {
    _pageHeader();
    _pageFooter();
    doc.y = 80;
  }
}

function _pageHeader() {
  const y = 18;
  doc.save().rect(ML, y, CW, 18).fill(C.navy).restore();
  doc.fontSize(7).fillColor(C.white).font('Helvetica')
     .text('SpécimenManager — Institut Pasteur Madagascar', ML + 6, y + 5, { continued: true, width: CW - 12 })
     .text('specimenmanager_conception.pdf', { align: 'right' });
}

function _pageFooter() {
  const y = PH - 38;
  doc.save().moveTo(ML, y).lineTo(PW - MR, y).strokeColor(C.lightGray).lineWidth(0.5).stroke().restore();
  doc.fontSize(7).fillColor(C.gray).font('Helvetica')
     .text(`Page ${pageNum}`, ML, y + 6, { continued: true, width: CW })
     .text('© 2026 Institut Pasteur Madagascar — Confidentiel / Confidential', { align: 'right' });
}

function checkSpace(needed) {
  if (doc.y + needed > PH - 70) newPage();
}

// ─── typography helpers ──────────────────────────────────────────────────────

function h1(text, sub) {
  checkSpace(60);
  doc.moveDown(0.4);
  const sy = doc.y;
  const bh = sub ? 48 : 32;
  doc.save().rect(ML, sy, CW, bh).fill(C.navy).restore();
  doc.fontSize(15).fillColor(C.white).font('Helvetica-Bold').text(text, ML + 10, sy + 8, { width: CW - 20 });
  if (sub) doc.fontSize(8).fillColor('#90CAF9').font('Helvetica').text(sub, ML + 10, sy + 28, { width: CW - 20 });
  doc.y = sy + bh + 8;
}

function h2(text) {
  checkSpace(40);
  doc.moveDown(0.6);
  const sy = doc.y;
  doc.save().rect(ML, sy, 4, 16).fill(C.lightBlue).restore();
  doc.fontSize(11).fillColor(C.blue).font('Helvetica-Bold').text(text, ML + 10, sy + 2, { width: CW - 10 });
  doc.y = sy + 22;
}

function h3(text) {
  doc.moveDown(0.4);
  doc.fontSize(9.5).fillColor(C.cyan).font('Helvetica-Bold').text(text, ML, doc.y, { width: CW });
  doc.moveDown(0.15);
}

function p(text) {
  doc.fontSize(9).fillColor(C.black).font('Helvetica').text(text, ML, doc.y, { width: CW });
  doc.moveDown(0.25);
}

function bullets(items, color) {
  items.forEach(item => {
    const sy = doc.y;
    doc.save().circle(ML + 7, sy + 4.5, 2.5).fill(color || C.lightBlue).restore();
    doc.fontSize(9).fillColor(C.black).font('Helvetica').text(item, ML + 18, sy, { width: CW - 18 });
    doc.moveDown(0.2);
  });
}

function divider() {
  doc.moveDown(0.3);
  doc.save().moveTo(ML, doc.y).lineTo(PW - MR, doc.y).strokeColor(C.lightGray).lineWidth(0.5).stroke().restore();
  doc.moveDown(0.4);
}

// ─── table helper ────────────────────────────────────────────────────────────

function table(headers, rows, widths) {
  const w = widths || headers.map(() => CW / headers.length);
  checkSpace(20 + rows.length * 18);

  // header row
  const hy = doc.y;
  doc.save().rect(ML, hy, CW, 18).fill(C.navy).restore();
  let cx = ML;
  headers.forEach((h, i) => {
    doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold').text(h, cx + 4, hy + 5, { width: w[i] - 8 });
    cx += w[i];
  });
  doc.y = hy + 18;

  rows.forEach((row, ri) => {
    checkSpace(16);
    const ry = doc.y;
    doc.save().rect(ML, ry, CW, 16).fill(ri % 2 === 0 ? C.white : C.lightGray).restore();
    cx = ML;
    row.forEach((cell, ci) => {
      doc.fontSize(8).fillColor(C.black).font('Helvetica').text(String(cell), cx + 4, ry + 4, { width: w[ci] - 8 });
      cx += w[ci];
    });
    doc.y = ry + 16;
  });
  doc.moveDown(0.4);
}

// ─── colored box ─────────────────────────────────────────────────────────────

function colorBox(title, lines, bg) {
  const lineH = 14;
  const bh = 24 + lines.length * lineH;
  checkSpace(bh + 6);
  const sy = doc.y;
  doc.save().roundedRect(ML, sy, CW, bh, 5).fill(bg || C.lightGray).restore();
  doc.fontSize(8).fillColor(C.navy).font('Helvetica-Bold').text(title, ML + 10, sy + 8, { width: CW - 20 });
  lines.forEach((line, i) => {
    doc.fontSize(8.5).fillColor(C.black).font('Helvetica').text(line, ML + 10, sy + 22 + i * lineH, { width: CW - 20 });
  });
  doc.y = sy + bh + 8;
}

// ─── layered diagram box ──────────────────────────────────────────────────────

function layerBox(label, sub, color) {
  const sy = doc.y;
  doc.save().roundedRect(ML, sy, CW, 32, 5).fill(color).restore();
  doc.fontSize(9.5).fillColor(C.white).font('Helvetica-Bold').text(label, ML + 10, sy + 6, { width: CW - 20 });
  doc.fontSize(8).fillColor('#ECEFF1').font('Helvetica').text(sub, ML + 10, sy + 19, { width: CW - 20 });
  doc.y = sy + 32;
}

function arrow() {
  const sy = doc.y;
  const mx = PW / 2;
  doc.save().moveTo(mx, sy).lineTo(mx, sy + 10).strokeColor(C.gray).lineWidth(1.2).stroke().restore();
  doc.save().polygon([mx - 4, sy + 6], [mx + 4, sy + 6], [mx, sy + 11]).fill(C.gray).restore();
  doc.y = sy + 12;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════════════════════════════════════════════
newPage(true);
_pageFooter();

// Background
doc.save().rect(0, 0, PW, PH * 0.42).fill(C.navy).restore();
doc.save().rect(0, PH * 0.42, PW, PH * 0.58).fill(C.white).restore();

// Decorative circle
doc.save().fillOpacity(0.06).circle(PW - 60, 80, 180).fill(C.cyan).restore();
doc.fillOpacity(1);

// Logo placeholder
doc.save().roundedRect(ML, 45, 56, 56, 8).fill('#FFFFFF18').restore();
doc.fontSize(8).fillColor('#FFFFFF99').font('Helvetica-Bold').text('IPM', ML + 20, 65);
doc.fontSize(6.5).fillColor('#FFFFFF66').font('Helvetica').text('Institut Pasteur\nMadagascar', ML + 8, 78);

// Title
doc.fontSize(28).fillColor(C.white).font('Helvetica-Bold').text('SpécimenManager', ML, 130, { align: 'center', width: CW });
doc.fontSize(12).fillColor('#90CAF9').font('Helvetica').text('Document de Conception Technique Complète', ML, 166, { align: 'center', width: CW });
doc.fontSize(10).fillColor('#90CAF9').text('Complete Technical Architecture & Design Document', ML, 183, { align: 'center', width: CW });

// Divider
doc.save().moveTo(130, 202).lineTo(PW - 130, 202).strokeColor('#FFFFFF33').lineWidth(1).stroke().restore();

// Version badge
doc.fontSize(8.5).fillColor(C.white);
const bx1 = PW / 2 - 95, bx2 = PW / 2 + 8;
doc.save().roundedRect(bx1, 210, 88, 18, 4).fill('#FFFFFF22').restore();
doc.text('v1.0  •  Juin 2026', bx1 + 8, 215);
doc.save().roundedRect(bx2, 210, 87, 18, 4).fill('#FFFFFF22').restore();
doc.text('Bilingue FR / EN', bx2 + 8, 215);

// Info card
const cardY = PH * 0.42 + 10;
doc.save().roundedRect(ML, cardY, CW, 106, 8).fill(C.lightGray).restore();

const col1 = ML + 18, col2 = ML + CW / 2 + 10;
doc.fontSize(7).fillColor(C.gray).font('Helvetica').text('PROJET / PROJECT', col1, cardY + 12);
doc.fontSize(10).fillColor(C.black).font('Helvetica-Bold').text('SpécimenManager', col1, cardY + 22);

doc.fontSize(7).fillColor(C.gray).font('Helvetica').text('DATE', col2, cardY + 12);
doc.fontSize(10).fillColor(C.black).font('Helvetica-Bold').text('28 Juin 2026', col2, cardY + 22);

doc.fontSize(7).fillColor(C.gray).font('Helvetica').text('CLIENT', col1, cardY + 40);
doc.fontSize(10).fillColor(C.black).font('Helvetica-Bold').text('Institut Pasteur Madagascar (IPM)', col1, cardY + 50);

doc.fontSize(7).fillColor(C.gray).font('Helvetica').text('VERSION', col2, cardY + 40);
doc.fontSize(10).fillColor(C.black).font('Helvetica-Bold').text('1.0 — Architecture initiale + évolutions', col2, cardY + 50);

doc.fontSize(7).fillColor(C.gray).font('Helvetica').text('STACK', col1, cardY + 68);
doc.fontSize(9.5).fillColor(C.black).font('Helvetica-Bold').text('PERN — PostgreSQL · Express · React · Node.js', col1, cardY + 78);

// Confidential banner
const warnY = cardY + 122;
doc.save().rect(ML, warnY, CW, 22).fill('#FFF8E1').restore();
doc.save().rect(ML, warnY, 4, 22).fill(C.amber).restore();
doc.fontSize(8).fillColor(C.amber).font('Helvetica-Bold')
   .text('CONFIDENTIEL — Usage interne IPM uniquement / CONFIDENTIAL — Internal use only', ML + 12, warnY + 7, { width: CW - 20 });

// TOC
const tocY = warnY + 38;
doc.fontSize(12).fillColor(C.navy).font('Helvetica-Bold').text('Table des Matières / Table of Contents', ML, tocY, { align: 'center', width: CW });

const toc = [
  ['1.', 'Architecture Globale / Global Architecture'],
  ['2.', 'Stack Technique Recommandée / Technical Stack'],
  ['3.', 'Modélisation des Données / Data Modeling'],
  ['4.', 'Architecture de l\'API / API Architecture'],
  ['5.', 'Sécurité & Authentification / Security & Auth'],
  ['6.', 'Scalabilité & Déploiement / Scalability & Deployment'],
  ['',   'Synthèse & Roadmap / Summary & Roadmap'],
];

let ty = tocY + 22;
toc.forEach(([num, title], i) => {
  const bg = i % 2 === 0 ? C.white : C.lightGray;
  doc.save().rect(ML, ty, CW, 22).fill(bg).restore();
  doc.fontSize(9).fillColor(C.blue).font('Helvetica-Bold').text(num, ML + 8, ty + 6, { width: 20 });
  doc.fontSize(9).fillColor(C.black).font('Helvetica').text(title, ML + 28, ty + 6, { width: CW - 36 });
  ty += 22;
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — ARCHITECTURE GLOBALE
// ═══════════════════════════════════════════════════════════════════════════════
newPage();

h1('1. Architecture Globale', '1. Global Architecture');

h2('1.1 Vue d\'ensemble / Overview');
p('SpécimenManager adopte une architecture en couches (Layered Architecture) avec le pattern MVC, déployée en mode client-serveur. Cette approche garantit une séparation claire des responsabilités, une maintenabilité optimale et une courbe d\'apprentissage réduite pour les futurs développeurs.');
p('SpécimenManager adopts a layered architecture with MVC pattern in a client-server deployment. This ensures clear separation of concerns, optimal maintainability, and a reduced learning curve for future developers.');

divider();

h2('1.2 Architecture en couches / Layered Architecture Diagram');

layerBox('NAVIGATEUR / BROWSER', 'Chrome · Firefox · Safari  |  Port 5173 (dev) / 80 ou 443 (prod)', C.lightBlue);
arrow();
layerBox('FRONTEND — React 19 + Vite', 'Zustand · React Router v7 · TanStack Query · Tailwind CSS v3 · Leaflet · Axios', C.blue);
arrow();
layerBox('API REST — Express.js  (Port 3000)', 'JWT Middleware · CORS · Helmet · Routes /api/v1/ · Controllers · Services · asyncHandler', C.navy);
arrow();
layerBox('ORM — Prisma 5', 'Schema validation · Migrations versionnées · Query builder · Prisma Client singleton', C.green);
arrow();
layerBox('POSTGRESQL 15 + PostGIS  (Port 5435)', 'Docker container · Données entomologiques IPM · Extension géospatiale PostGIS', C.gray);

doc.moveDown(0.3);
p('Flux unidirectionnel : Browser → React → REST API → Prisma → PostgreSQL');
p('Unidirectional data flow: Browser → React → REST API → Prisma → PostgreSQL');

divider();

h2('1.3 Hiérarchie métier / Business Data Hierarchy');
p('La chaîne de containment stricte du domaine métier :');
p('The strict domain containment chain:');

checkSpace(50);
const chainItems = ['Projet', 'Mission', 'Localite', 'MethodeCollecte', 'Specimen'];
const chainColors = [C.navy, C.blue, C.lightBlue, C.cyan, C.green];
const cw5 = (CW - 32) / 5;
const chainY = doc.y + 4;
chainItems.forEach((s, i) => {
  const cx = ML + i * (cw5 + 8);
  doc.save().roundedRect(cx, chainY, cw5, 28, 4).fill(chainColors[i]).restore();
  doc.fontSize(8.5).fillColor(C.white).font('Helvetica-Bold').text(s, cx + 4, chainY + 9, { width: cw5 - 8, align: 'center' });
  if (i < chainItems.length - 1) {
    const ax = cx + cw5 + 2;
    const ay = chainY + 14;
    doc.save().moveTo(ax, ay).lineTo(ax + 5, ay).strokeColor(C.gray).lineWidth(1.5).stroke().restore();
    doc.save().polygon([ax + 3, ay - 3], [ax + 3, ay + 3], [ax + 7, ay]).fill(C.gray).restore();
  }
});
doc.y = chainY + 38;
p('Les specimens (Moustique, Tique, Puce) sont toujours relies a une MethodeCollecte — jamais directement a une Localite ou Mission.');
p('Specimens (Mosquito, Tick, Flea) are always linked to a MethodeCollecte — never directly to a Localite or Mission.');

divider();

h2('1.4 Patterns architecturaux retenus / Retained Architectural Patterns');
table(
  ['Pattern', 'Justification FR', 'Justification EN'],
  [
    ['MVC (backend)', 'Separation Controller / Service / Model', 'Separation of Controller/Service/Model'],
    ['RESTful API', 'Contrat HTTP clair, sans etat', 'Clear stateless HTTP contract'],
    ['Repository (Prisma)', 'Abstraction de la persistence', 'Persistence abstraction layer'],
    ['Singleton (Prisma client)', 'Evite les connexions multiples', 'Prevents connection pool exhaustion'],
    ['Protected Routes (React)', 'Garde applicative cote client', 'Client-side application guard'],
    ['Observer (TanStack Query)', 'Cache et invalidation automatique', 'Automatic cache & invalidation'],
    ['SSE (Server-Sent Events)', 'Notifications temps reel push', 'Real-time server push notifications'],
    ['Audit Trail', 'Tracabilite de toutes les mutations', 'Full traceability of all mutations'],
  ],
  [120, 185, 180]
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — STACK TECHNIQUE
// ═══════════════════════════════════════════════════════════════════════════════
newPage();

h1('2. Stack Technique Recommandee', '2. Recommended Technical Stack');

h2('2.1 Stack Actuelle / Current Stack');
table(
  ['Couche', 'Technologie', 'Version', 'Role / Purpose'],
  [
    ['Frontend', 'React', '19', 'UI framework — composants reactifs'],
    ['Frontend', 'Vite', '5.x', 'Bundler ultra-rapide / Ultra-fast bundler'],
    ['Frontend', 'Tailwind CSS', 'v3', 'Utility-first CSS — design system'],
    ['Frontend', 'React Router', 'v7', 'Routing SPA + layouts imbriques'],
    ['Frontend', 'TanStack Query', 'v5', 'Server-state, cache, invalidation auto'],
    ['Frontend', 'Zustand', '4.x', 'Global state leger / Light global state'],
    ['Frontend', 'Leaflet', '1.9', 'Cartes GPS interactives'],
    ['Frontend', 'Axios', '1.x', 'Client HTTP + intercepteurs JWT'],
    ['Backend', 'Node.js', '22 LTS', 'Runtime serveur / Server runtime'],
    ['Backend', 'Express.js', '4.x', 'Framework HTTP REST'],
    ['Backend', 'Prisma ORM', '5.x', 'ORM + migrations + type safety'],
    ['Backend', 'ExcelJS', '4.x', 'Import/Export Excel specimens'],
    ['Backend', 'jsonwebtoken', '9.x', 'Authentification JWT sans etat'],
    ['Base de donnees', 'PostgreSQL', '15', 'SGBDR principal / Primary RDBMS'],
    ['Base de donnees', 'PostGIS', '3.x', 'Extension geospatiale / Geospatial'],
    ['Infrastructure', 'Docker', '24.x', 'Conteneurisation / Containerization'],
    ['Infrastructure', 'Nginx', '1.25', 'Reverse proxy + SSL termination'],
  ],
  [90, 105, 60, 230]
);

divider();

h2('2.2 Evolutions Recommandees / Recommended Future Evolutions');
p('Ces evolutions couvrent les besoins futurs : mobile terrain, scalabilite, robustesse production.');
table(
  ['Besoin / Need', 'Technologie suggeree', 'Priorite'],
  [
    ['App mobile terrain offline', 'React Native + Expo + WatermelonDB (SQLite)', 'HAUTE'],
    ['Sync offline vers serveur', 'Queue de mutations + retry automatique', 'HAUTE'],
    ['Tests unitaires backend', 'Jest + Supertest', 'HAUTE'],
    ['Tests composants frontend', 'Vitest + Testing Library', 'MOYENNE'],
    ['Monitoring & erreurs', 'Sentry + Prometheus + Grafana', 'MOYENNE'],
    ['CI/CD pipeline', 'GitHub Actions — build, test, deploy', 'MOYENNE'],
    ['Cache API', 'Redis (sessions, rate-limit, invalidation)', 'MOYENNE'],
    ['Stockage photos specimens', 'MinIO (auto-heberge, S3-compatible)', 'OPTIONNELLE'],
    ['Analyse statistique', 'Python FastAPI micro-service + Pandas', 'OPTIONNELLE'],
    ['WebSocket bi-directionnel', 'Socket.io (remplace SSE)', 'OPTIONNELLE'],
  ],
  [185, 195, 105]
);

divider();

h2('2.3 Outils de developpement / Development Tooling');
table(
  ['Outil / Tool', 'Usage'],
  [
    ['ESLint + Prettier', 'Linting et formatage uniforme / Uniform linting & formatting'],
    ['Prisma Studio', 'Navigateur visuel BDD localhost:5555 / Visual DB browser'],
    ['Prisma Migrate', 'Versioning et application des migrations SQL'],
    ['Docker Compose', 'Orchestration locale PostgreSQL / Local DB orchestration'],
    ['Git + GitHub', 'Versionning + revues de code / Source versioning + reviews'],
    ['Claude Code', 'Assistance developpement et documentation / Dev AI assistance'],
  ],
  [165, 320]
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — MODELISATION DES DONNEES
// ═══════════════════════════════════════════════════════════════════════════════
newPage();

h1('3. Modelisation des Donnees', '3. Data Modeling');

h2('3.1 Entites principales / Main Entities');
p('Le schema Prisma definit toutes les entites ci-dessous avec id autoincrement, timestamps createdAt/updatedAt, et relation vers l\'utilisateur createur.');
table(
  ['Entite / Entity', 'Table SQL', 'Description'],
  [
    ['User', 'users', 'Utilisateurs avec roles hierarchiques / Users with hierarchical roles'],
    ['AuditLog', 'audit_logs', 'Journal de toutes les actions / Audit trail for all actions'],
    ['Projet', 'projets', 'Projet de recherche de haut niveau / Top-level research project'],
    ['Mission', 'missions', 'Campagne terrain d\'un projet / Field campaign within a project'],
    ['Localite', 'localites', 'Site geographique GPS + PostGIS / GPS geographic site'],
    ['MethodeCollecte', 'methodes_collecte', 'Methode et dispositif de collecte / Collection method'],
    ['Hote', 'hotes', 'Animal hote (tiques/puces) / Host animal (ticks/fleas)'],
    ['Moustique', 'moustiques', 'Specimen Culicidae'],
    ['Tique', 'tiques', 'Specimen Ixodidae / Argasidae'],
    ['Puce', 'puces', 'Specimen Siphonaptera'],
  ],
  [110, 130, 245]
);

divider();

h2('3.2 Systeme de roles / Role Hierarchy');
p('La hierarchie de roles est encodee numeriquement. requireMinRole() permet des verifications ascendantes.');
table(
  ['Role', 'Niveau / Level', 'Droits FR', 'Droits EN'],
  [
    ['lecteur', '1', 'Lecture seule', 'Read-only access'],
    ['terrain', '2', 'Saisie specimens + consultation', 'Specimen entry + read'],
    ['chercheur', '3', 'CRUD complet + import/export Excel', 'Full CRUD + Excel import/export'],
    ['admin', '4', 'Gestion utilisateurs + activation', 'User management + activation'],
  ],
  [90, 80, 160, 155]
);
p('Les nouveaux comptes sont crees avec actif: false — activation requise par un admin.');
p('New accounts are created with actif: false — activation required by an admin.');

divider();

h2('3.3 Schema relationnel / Relational Schema');
p('PK = Cle primaire  |  FK = Cle etrangere  |  Toutes les entites ont id, createdAt, updatedAt');

checkSpace(220);
const eW = (CW - 10) / 3;
const eH = 82;
const eGap = 5;
const row1Y = doc.y + 4;

const drawEnt = (name, fields, x, y, color) => {
  doc.save().roundedRect(x, y, eW, eH, 4).fill(color).restore();
  doc.save().rect(x, y, eW, 20).fill('#00000022').restore();
  doc.fontSize(8.5).fillColor(C.white).font('Helvetica-Bold').text(name, x + 6, y + 6, { width: eW - 12 });
  fields.forEach((f, i) => {
    const fc = f.startsWith('PK') ? '#FFD54F' : f.startsWith('FK') ? '#80DEEA' : '#ECEFF1';
    doc.fontSize(7.5).fillColor(fc).font('Helvetica').text(f, x + 6, y + 24 + i * 12, { width: eW - 12 });
  });
};

drawEnt('User', ['PK id', 'login, email', 'role', 'actif: Boolean', 'passwordHash'], ML, row1Y, C.navy);
drawEnt('Projet', ['PK id', 'nom, description', 'dateDebut / dateFin', 'FK createdById', '(→ User)'], ML + eW + eGap, row1Y, C.blue);
drawEnt('AuditLog', ['PK id', 'action, entity', 'entityId', 'oldValue / newValue', 'FK userId (→ User)'], ML + (eW + eGap) * 2, row1Y, C.gray);

const row2Y = row1Y + eH + 10;
drawEnt('Mission', ['PK id', 'nom, statut', 'dateDebut / dateFin', 'FK projetId', '(→ Projet)'], ML, row2Y, C.lightBlue);
drawEnt('Localite', ['PK id', 'nom, commune, region', 'latitude, longitude', 'geom (PostGIS)', 'FK missionId (→ Mission)'], ML + eW + eGap, row2Y, C.cyan);
drawEnt('Hote', ['PK id', 'nomCommun', 'nomScientifique', 'typeAnimal', 'FK methodeId'], ML + (eW + eGap) * 2, row2Y, C.amber);

const row3Y = row2Y + eH + 10;
drawEnt('MethodeCollecte', ['PK id', 'type (PIEGES|ASPIR)', 'dispositif', 'dateDebut / dateFin', 'FK localiteId'], ML, row3Y, C.green);
drawEnt('Moustique', ['PK id', 'genre / espece', 'sexe / stade', 'positionPlaque (A1-H12)', 'FK methodeId'], ML + eW + eGap, row3Y, C.navy);
drawEnt('Tique / Puce', ['PK id', 'genre / espece / stade', 'positionPlaque', 'FK methodeId', 'FK hoteId (optionnel)'], ML + (eW + eGap) * 2, row3Y, C.red);

doc.y = row3Y + eH + 12;
p('Legende : Jaune = Cle primaire (PK)  |  Cyan = Cle etrangere (FK)  |  Blanc = Attribut standard');

divider();

h2('3.4 Conventions de nommage / Naming Conventions');
table(
  ['Element', 'Convention', 'Exemple'],
  [
    ['Modeles Prisma', 'PascalCase', 'Moustique, MethodeCollecte'],
    ['Tables SQL', 'snake_case (@@map)', 'moustiques, methodes_collecte'],
    ['Colonnes', 'camelCase Prisma / snake_case SQL', 'createdAt → created_at'],
    ['Cles primaires', 'Int autoincrement', 'id Int @id @default(autoincrement())'],
    ['Timestamps', 'createdAt / updatedAt', '@default(now()) / @updatedAt'],
    ['Relations', 'Relation nommee + @relation', 'methode MethodeCollecte @relation(...)'],
  ],
  [140, 175, 170]
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — ARCHITECTURE API
// ═══════════════════════════════════════════════════════════════════════════════
newPage();

h1('4. Architecture de l\'API', '4. API Architecture');

h2('4.1 Principes generaux / General Principles');
bullets([
  'Prefixe global : /api/v1/ — versioning dans l\'URL pour compatibilite future',
  'Toutes les reponses sont en JSON avec enveloppe standard { data, meta, error }',
  'Authentification par Bearer token JWT dans l\'en-tete Authorization',
  'Global prefix: /api/v1/ — URL versioning for forward compatibility',
  'All responses are JSON with standard envelope { data, meta, error }',
  'Authentication via Bearer JWT token in the Authorization header',
]);

divider();

h2('4.2 Endpoints par ressource / Endpoints by Resource');
table(
  ['Methode', 'Endpoint', 'Description', 'Role min.'],
  [
    ['GET', '/api/health', 'Health check public', 'public'],
    ['POST', '/api/v1/auth/login', 'Connexion — retourne JWT', 'public'],
    ['POST', '/api/v1/auth/register', 'Creation compte (actif:false)', 'public'],
    ['GET', '/api/v1/auth/me', 'Profil utilisateur courant', 'lecteur'],
    ['GET', '/api/v1/projets', 'Liste des projets', 'lecteur'],
    ['POST', '/api/v1/projets', 'Creer un projet', 'chercheur'],
    ['GET', '/api/v1/projets/:id', 'Detail projet + statistiques', 'lecteur'],
    ['PUT', '/api/v1/projets/:id', 'Modifier un projet', 'chercheur'],
    ['DELETE', '/api/v1/projets/:id', 'Supprimer un projet', 'admin'],
    ['GET', '/api/v1/missions', 'Liste missions (filtrables)', 'lecteur'],
    ['POST', '/api/v1/missions', 'Creer une mission', 'chercheur'],
    ['GET', '/api/v1/missions/:id', 'Detail mission + stats', 'lecteur'],
    ['GET', '/api/v1/localites', 'Localites avec coords GPS', 'lecteur'],
    ['POST', '/api/v1/localites', 'Creer une localite', 'terrain'],
    ['GET', '/api/v1/methodes', 'Methodes de collecte', 'lecteur'],
    ['POST', '/api/v1/specimens/moustiques', 'Creer un moustique', 'terrain'],
    ['GET', '/api/v1/specimens/moustiques', 'Lister moustiques (filtres)', 'lecteur'],
    ['POST', '/api/v1/specimens/moustiques/import', 'Import Excel moustiques', 'chercheur'],
    ['GET', '/api/v1/specimens/moustiques/export', 'Export Excel moustiques', 'chercheur'],
    ['POST', '/api/v1/specimens/tiques', 'Creer une tique', 'terrain'],
    ['POST', '/api/v1/specimens/puces', 'Creer une puce', 'terrain'],
    ['GET', '/api/v1/search', 'Recherche globale multi-entite', 'lecteur'],
    ['GET', '/api/v1/stats', 'Statistiques tableau de bord', 'lecteur'],
    ['GET', '/api/v1/notifications', 'Stream SSE notifications', 'lecteur'],
    ['GET', '/api/v1/audit', 'Journal d\'audit (pagine)', 'admin'],
    ['GET', '/api/v1/users', 'Liste utilisateurs', 'admin'],
    ['PUT', '/api/v1/users/:id/activate', 'Activer un compte', 'admin'],
    ['PUT', '/api/v1/users/:id/role', 'Changer le role', 'admin'],
  ],
  [55, 200, 165, 65]
);

divider();

h2('4.3 Format de reponse standard / Standard Response Format');
colorBox('Succes / Success', [
  '{ "data": { ... }, "meta": { "total": 42, "page": 1, "limit": 20 } }',
], '#E8F5E9');
colorBox('Erreur / Error', [
  '{ "error": { "code": "UNAUTHORIZED", "message": "Token invalide ou expire" } }',
], '#FFEBEE');

divider();

h2('4.4 Chaine de middlewares Express / Express Middleware Chain');
table(
  ['Middleware', 'Role FR', 'Role EN'],
  [
    ['cors()', 'Autorise CLIENT_URL (.env)', 'Allows CLIENT_URL from .env'],
    ['helmet()', 'En-tetes de securite HTTP', 'HTTP security headers (11 headers)'],
    ['express.json()', 'Parse le corps JSON', 'Parses JSON request body'],
    ['auth.middleware.js', 'Verifie le JWT Bearer', 'Verifies JWT Bearer token'],
    ['requireRole(...)', 'Verifie le role exact', 'Checks exact role match'],
    ['requireMinRole(...)', 'Verifie le role minimum', 'Checks minimum role level'],
    ['asyncHandler()', 'Capture les erreurs async', 'Catches async errors transparently'],
    ['errorHandler (global)', 'Formate toutes les erreurs', 'Formats all error responses as JSON'],
    ['SSE middleware', 'Maintient connexions ouvertes', 'Keeps SSE connections alive with heartbeat'],
  ],
  [130, 185, 170]
);

divider();

h2('4.5 Import/Export Excel');
bullets([
  'POST /import — Lecture positionnelle des colonnes (col 1 = genre, col 2 = espece...) — la ligne d\'en-tete est ignoree',
  'GET /export — Generation en memoire du fichier .xlsx via ExcelJS, retourne avec Content-Disposition: attachment',
  'POST /import — Positional column parsing (col 1 = genus, col 2 = species...) — header row is skipped',
  'GET /export — In-memory .xlsx generation via ExcelJS, returned as Content-Disposition: attachment',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — SECURITE & AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════
newPage();

h1('5. Securite & Authentification', '5. Security & Authentication');

h2('5.1 Strategie d\'authentification / Authentication Strategy');
p('L\'application utilise l\'authentification sans etat (Stateless) basee sur JSON Web Tokens (JWT). Il n\'y a pas de session cote serveur. Le token est genere a la connexion, signe avec JWT_SECRET, et presente a chaque requete protegee.');
table(
  ['Parametre', 'Valeur / Value', 'Note'],
  [
    ['Algorithme', 'HS256', 'HMAC SHA-256'],
    ['Expiration', '7 jours / 7 days', 'Configurable dans auth.controller.js'],
    ['Transport', 'Authorization: Bearer <token>', 'Header HTTP standard'],
    ['Stockage client', 'localStorage (Zustand persist)', 'Migrer vers httpOnly cookie en prod'],
    ['Secret', 'JWT_SECRET (variable .env)', 'Jamais committe dans Git / Never in Git'],
    ['Evolution suggeree', 'Refresh token + rotation', 'Access token 15 min + refresh httpOnly'],
  ],
  [140, 175, 170]
);

divider();

h2('5.2 Flux d\'authentification / Authentication Flow');
const steps = [
  '1.  Client  POST /api/v1/auth/login  {login, password}',
  '2.  Serveur  bcrypt.compare(password, hash)  →  jwt.sign(payload, JWT_SECRET)  →  { token, user }',
  '3.  Client  stocke token dans Zustand (localStorage)  →  Axios intercepteur ajoute Bearer header',
  '4.  Serveur  auth.middleware.js  extrait header  →  jwt.verify()  →  req.user = payload',
  '5.  Guard  requireMinRole(role)  compare req.user.role au niveau minimum requis',
  '6.  Sur 401  →  Axios intercepteur  →  logout()  →  redirect /login automatique',
];
steps.forEach((s, i) => {
  const sy = doc.y;
  const bg = i % 2 === 0 ? C.lightGray : C.white;
  doc.save().rect(ML, sy, CW, 18).fill(bg).restore();
  doc.save().rect(ML, sy, 24, 18).fill(C.navy).restore();
  doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold').text(String(i + 1), ML + 8, sy + 5);
  doc.fontSize(8.5).fillColor(C.black).font('Helvetica').text(s.substring(3), ML + 28, sy + 5, { width: CW - 32 });
  doc.y = sy + 18;
});
doc.moveDown(0.4);

divider();

h2('5.3 Matrice de controle d\'acces RBAC / RBAC Access Control Matrix');
table(
  ['Action', 'lecteur', 'terrain', 'chercheur', 'admin'],
  [
    ['Consulter donnees', 'oui', 'oui', 'oui', 'oui'],
    ['Creer specimen', 'non', 'oui', 'oui', 'oui'],
    ['Modifier specimen', 'non', 'non', 'oui', 'oui'],
    ['Import Excel', 'non', 'non', 'oui', 'oui'],
    ['Export Excel', 'non', 'non', 'oui', 'oui'],
    ['Supprimer donnees', 'non', 'non', 'non', 'oui'],
    ['Gerer utilisateurs', 'non', 'non', 'non', 'oui'],
    ['Voir audit log', 'non', 'non', 'non', 'oui'],
    ['Activer comptes', 'non', 'non', 'non', 'oui'],
  ],
  [160, 65, 65, 80, 65]
);

divider();

h2('5.4 Mesures de securite implementees / Implemented Security Measures');
bullets([
  'Helmet.js — 11 en-tetes de securite HTTP (X-Frame-Options, CSP, HSTS, X-Content-Type-Options...)',
  'CORS configure sur CLIENT_URL uniquement — bloque toutes les origines non autorisees',
  'Mots de passe haches avec bcrypt (cost factor recommande >= 12)',
  'Audit trail automatique — toutes les mutations dans audit_logs avec old/new values (JSON)',
  'Variables sensibles dans .env — jamais committees dans le depot Git',
  'Helmet.js — 11 HTTP security headers blocking clickjacking, XSS, MIME sniffing...',
  'CORS locked to CLIENT_URL — blocks all unauthorized origins',
  'Passwords hashed with bcrypt (recommended cost factor >= 12)',
  'Automatic audit trail — all mutations recorded with old/new values in audit_logs',
]);

divider();

h2('5.5 Ameliorations recommandees / Recommended Security Improvements');
table(
  ['Amelioration', 'Description', 'Priorite'],
  [
    ['Refresh Token + Rotation', 'Access token 15 min + refresh token httpOnly cookie', 'HAUTE'],
    ['Rate Limiting', 'express-rate-limit sur /auth/login (anti-brute force)', 'HAUTE'],
    ['HTTPS obligatoire', 'TLS via Nginx + Let\'s Encrypt ou certificat IPM', 'HAUTE'],
    ['httpOnly Cookie', 'Migrer localStorage vers cookie httpOnly (anti-XSS)', 'MOYENNE'],
    ['Validation entrees (Zod)', 'Schema Zod sur tous les body de requetes', 'MOYENNE'],
    ['Alertes audit temps reel', 'Notifier admin sur actions sensibles en SSE', 'OPTIONNELLE'],
    ['MFA (2FA)', 'TOTP (Google Authenticator) pour les admins', 'OPTIONNELLE'],
  ],
  [165, 215, 105]
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — SCALABILITE & DEPLOIEMENT
// ═══════════════════════════════════════════════════════════════════════════════
newPage();

h1('6. Scalabilite & Deploiement', '6. Scalability & Deployment');

h2('6.1 Architecture de deploiement actuelle / Current Deployment Architecture');
colorBox('Deploiement NAS Synology — Production Actuelle / Current Production NAS', [
  'NAS Synology  →  Docker Compose  →  Nginx (80/443)  →  Backend Node.js (:3000)',
  'PostgreSQL 15 + PostGIS  →  Docker volume persistant / persistent Docker volume',
  'Acces interne IPM : reseau local LAN  |  Acces externe : Tailscale VPN (en cours / pending)',
  'SSL/TLS : Let\'s Encrypt via Nginx  |  Proxy : /api/* → backend, /* → React dist (statique)',
], '#E3F2FD');

divider();

h2('6.2 Configuration Docker Compose');
table(
  ['Service', 'Image', 'Port', 'Role'],
  [
    ['postgres', 'postgres:15-alpine', '5435:5432', 'Base de donnees principale'],
    ['backend', 'node:22-alpine (custom)', '3000:3000', 'API REST Express.js'],
    ['frontend', 'nginx:alpine + build Vite', '80:80 / 443:443', 'Serveur statique + reverse proxy'],
  ],
  [80, 165, 110, 130]
);
p('Le fichier docker-compose.prod.yml orchestre les 3 services avec healthchecks et restart: unless-stopped.');

divider();

h2('6.3 Procedure de deploiement / Deployment Procedure');
const dsteps = [
  'git pull origin master  →  recuperer les dernieres modifications',
  'cd frontend && npm run build  →  generer le bundle Vite dans dist/',
  'docker-compose -f docker-compose.prod.yml build  →  reconstruire les images',
  'npx prisma migrate deploy  →  appliquer les migrations de BDD en production',
  'docker-compose -f docker-compose.prod.yml up -d  →  redemarrer les conteneurs',
  'curl https://sm.ipmnas.synology.me/api/health  →  verifier {"status":"ok"}',
];
dsteps.forEach((s, i) => {
  checkSpace(22);
  const sy = doc.y;
  doc.save().roundedRect(ML, sy, CW, 20, 3).fill(i % 2 === 0 ? C.lightGray : C.white).restore();
  doc.save().roundedRect(ML, sy, 22, 20, 3).fill(C.navy).restore();
  doc.fontSize(8.5).fillColor(C.white).font('Helvetica-Bold').text(String(i + 1), ML + 7, sy + 5);
  doc.fontSize(8.5).fillColor(C.black).font('Helvetica').text(s, ML + 28, sy + 5, { width: CW - 32 });
  doc.y = sy + 20;
});
doc.moveDown(0.4);

divider();

h2('6.4 Plan de Migration Cloud — Vision Future / Cloud Migration Roadmap');
p('Roadmap de migration vers une infrastructure cloud professionnelle pour la haute disponibilite et l\'ouverture a d\'autres institutions.');
table(
  ['Phase', 'Horizon', 'Description', 'Infrastructure suggeree'],
  [
    ['Phase 1\nActuelle', 'Maintenant', 'NAS Synology + Docker Compose + Tailscale VPN', 'NAS Synology DS923+'],
    ['Phase 2\nCloud Hybride', '6-12 mois', 'VPS dedie + CI/CD automatise + monitoring + HTTPS', 'OVH VPS Comfort (EU)'],
    ['Phase 3\nCloud Natif', '12-24 mois', 'Kubernetes (K3s) + PostgreSQL manage + CDN + WAF', 'OVH Managed Kubernetes'],
    ['Phase 4\nMulti-institution', '24+ mois', 'Multi-tenant SaaS + API Gateway + IAM federe', 'AWS / Azure + WAF'],
  ],
  [68, 72, 195, 150]
);
p('Recommandation : OVH Cloud (souverainete des donnees europeenne) pour les donnees de recherche medicale.');
p('Recommendation: OVH Cloud (EU data sovereignty) for sensitive medical research data hosting.');

divider();

h2('6.5 Application Mobile Terrain — Architecture Future / Field Mobile App');
p('Pour la saisie terrain en conditions difficiles (hors connexion, GPS, photos specimens) :');
table(
  ['Composant', 'Technologie', 'Justification'],
  [
    ['App framework', 'React Native + Expo', 'Partage de code avec le frontend React existant'],
    ['Navigation', 'Expo Router', 'File-based routing, coherent avec React Router v7'],
    ['Stockage offline', 'WatermelonDB + SQLite', 'Base locale haute performance pour sync differee'],
    ['Synchronisation', 'Queue de mutations + retry', 'Envoi automatique quand connexion disponible'],
    ['GPS terrain', 'expo-location', 'Capture coordonnees GPS automatiquement'],
    ['Photos specimens', 'expo-camera', 'Documentation photographique des specimens'],
    ['Authentification', 'JWT existant reutilise', 'Meme backend — zero duplication de code'],
    ['Build & OTA', 'EAS Build + EAS Update', 'Mises a jour sans passer par les stores'],
  ],
  [125, 145, 215]
);

divider();

h2('6.6 Fonctionnalites Suggerees / Suggested Future Features');
table(
  ['Fonctionnalite', 'Description', 'Valeur'],
  [
    ['Analyse statistique', 'Graphiques abondance, tendances, heatmaps GPS', 'TRES HAUTE'],
    ['Module photos', 'Photos specimens avec metadonnees EXIF + MinIO', 'TRES HAUTE'],
    ['Export PDF rapports', 'Rapports de mission en PDF (mission + specimens)', 'TRES HAUTE'],
    ['Dashboard analytics', 'BI interne — tendances, alertes epidemio', 'HAUTE'],
    ['Cartographie avancee', 'Couches SIG + zones Fokontany interactives', 'HAUTE'],
    ['Validation taxonomique', 'Integration GBIF / iNaturalist (externe)', 'HAUTE'],
    ['Multi-institution', 'Isolation par tenant (schema PostgreSQL)', 'MOYEN TERME'],
    ['API publique', 'API ouverte rate-limitee pour partenaires', 'LONG TERME'],
  ],
  [145, 230, 110]
);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE FINALE — SYNTHESE
// ═══════════════════════════════════════════════════════════════════════════════
newPage();

h1('Synthese & Points Cles', 'Summary & Key Takeaways');

h2('Forces de l\'architecture actuelle / Current Architecture Strengths');
bullets([
  'Stack PERN eprouvee, bien documentee, large communaute de developpeurs',
  'Prisma ORM : migrations versionnees, type safety end-to-end TypeScript',
  'Hierarchie de roles graduee (4 niveaux) adaptee au contexte institutionnel',
  'Audit trail automatique sur toutes les mutations — traçabilite complete',
  'Architecture entierement conteneurisee : reproductible et portable',
  'PostGIS integre : pret pour analyses geospatiales avancees (fokontany, zones)',
  'TanStack Query : cache intelligent, revalidation automatique, UX optimale',
], C.green);

divider();

h2('Points d\'attention prioritaires / Priority Action Items');
bullets([
  'SECURITE : Migrer le JWT de localStorage vers httpOnly cookie (protection XSS)',
  'SECURITE : Implementer rate-limiting sur /auth/login (protection brute force)',
  'QUALITE : Ajouter suite de tests Jest + Supertest avant toute montee en charge',
  'DEVOPS : Mettre en place CI/CD GitHub Actions pour deployments automatises',
  'MOBILE : Initier le PoC React Native + Expo pour la saisie terrain offline',
  'ANALYTICS : Implementer le module statistiques pour valoriser les donnees collectees',
  'INFRA : Activer HTTPS Let\'s Encrypt via Nginx en production NAS',
], C.red);

divider();

h2('Roadmap recommandee 12 mois / Recommended 12-Month Roadmap');
table(
  ['Trimestre', 'Priorites / Priorities'],
  [
    ['T3 2026\nJul–Sep', 'Rate limiting + httpOnly cookie  |  Tests Jest/Supertest  |  CI/CD GitHub Actions  |  HTTPS'],
    ['T4 2026\nOct–Dec', 'Module photos specimens (MinIO)  |  Export PDF rapports  |  Dashboard analytics complet'],
    ['T1 2027\nJan–Mar', 'PoC app mobile React Native + Expo  |  Sync offline  |  Migration vers VPS OVH Cloud'],
    ['T2 2027\nAvr–Jun', 'App mobile production  |  Validation taxonomique GBIF  |  Multi-institution (beta)'],
  ],
  [90, 395]
);

divider();

h2('Contact & Informations projet / Project Information');
colorBox('Institut Pasteur Madagascar — SpécimenManager v1.0', [
  'Responsable technique  :  Henintsoa',
  'Institution            :  Institut Pasteur Madagascar (IPM)',
  'Document genere le     :  28 Juin 2026 — Claude Code (Anthropic Sonnet 4.6)',
  'Depot Git              :  github.com/IPM / specimenmanager  (branche master)',
], '#E3F2FD');

doc.moveDown(0.6);
doc.fontSize(8).fillColor(C.gray).font('Helvetica')
   .text('Ce document est confidentiel et destine a un usage interne a l\'Institut Pasteur Madagascar.', ML, doc.y, { align: 'center', width: CW })
   .moveDown(0.2)
   .text('Toute reproduction ou diffusion externe requiert l\'autorisation explicite de la direction.', { align: 'center', width: CW })
   .moveDown(0.4)
   .text('This document is confidential and intended for internal use at Institut Pasteur Madagascar only.', { align: 'center', width: CW })
   .moveDown(0.2)
   .text('Any reproduction or external distribution requires explicit management authorization.', { align: 'center', width: CW });

doc.end();
console.log('PDF genere : ' + OUTPUT);
