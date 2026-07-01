'use strict';
// Manuel utilisateur — Saisie d'un specimen dans SpécimenManager
// Generé avec PDFKit

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const OUT = path.join(__dirname, '..', '..', 'specimenmanager_manuel_saisie.pdf');

// ── Palette ──────────────────────────────────────────────────────
const C = {
  primary:    '#1D9E75',
  primaryDk:  '#166B50',
  primaryLt:  '#E8F8F2',
  accent:     '#F59E0B',
  danger:     '#EF4444',
  info:       '#3B82F6',
  purple:     '#8B5CF6',
  gray50:     '#F9FAFB',
  gray100:    '#F3F4F6',
  gray200:    '#E5E7EB',
  gray400:    '#9CA3AF',
  gray600:    '#4B5563',
  gray700:    '#374151',
  gray900:    '#111827',
  white:      '#FFFFFF',
};

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  info: {
    Title:    'Manuel de saisie des specimens — SpécimenManager',
    Author:   'Institut Pasteur de Madagascar',
    Subject:  'Guide utilisateur',
    Keywords: 'specimens, saisie, moustiques, tiques, puces, IPM',
  },
});

doc.pipe(fs.createWriteStream(OUT));

// ── Helpers ───────────────────────────────────────────────────────

const PW  = 595.28;
const PH  = 841.89;
const ML  = 45;
const MR  = 45;
const CW  = PW - ML - MR;

function newPage() {
  doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
}

function pageHeader(title) {
  // Bande verte fine en haut
  doc.rect(0, 0, PW, 32).fill(C.primary);
  doc.fontSize(9).fillColor(C.white).font('Helvetica')
    .text('SpécimenManager — Institut Pasteur de Madagascar', ML, 11, { width: CW * 0.7 });
  doc.font('Helvetica-Bold')
    .text(title, ML, 11, { width: CW, align: 'right' });
  return 48;
}

function pageFooter(num, total) {
  doc.rect(0, PH - 28, PW, 28).fill(C.gray100);
  doc.fontSize(8).fillColor(C.gray400).font('Helvetica')
    .text(`SpécimenManager © Institut Pasteur de Madagascar — Manuel de saisie`, ML, PH - 18, { width: CW * 0.75 })
    .text(`Page ${num} / ${total}`, ML, PH - 18, { width: CW, align: 'right' });
}

function sectionTitle(text, y, opts = {}) {
  const color = opts.color || C.primary;
  doc.rect(ML, y, 4, 18).fill(color);
  doc.fontSize(13).fillColor(color).font('Helvetica-Bold')
    .text(text, ML + 10, y + 1, { width: CW - 10 });
  return y + 26;
}

function subTitle(text, y) {
  doc.fontSize(10.5).fillColor(C.gray700).font('Helvetica-Bold')
    .text(text, ML, y, { width: CW });
  return y + 16;
}

function bodyText(text, y, opts = {}) {
  const indent = opts.indent || 0;
  doc.fontSize(9.5).fillColor(C.gray700).font('Helvetica')
    .text(text, ML + indent, y, { width: CW - indent, lineGap: 3 });
  return y + doc.heightOfString(text, { width: CW - indent, lineGap: 3 }) + 5;
}

function bullet(text, y, opts = {}) {
  const color  = opts.color  || C.primary;
  const indent = opts.indent || 0;
  // Point
  doc.circle(ML + indent + 4, y + 5, 3).fill(color);
  doc.fontSize(9.5).fillColor(C.gray700).font('Helvetica')
    .text(text, ML + indent + 13, y, { width: CW - indent - 13, lineGap: 2 });
  const h = doc.heightOfString(text, { width: CW - indent - 13, lineGap: 2 });
  return y + Math.max(h, 12) + 4;
}

function stepBox(num, title, desc, y, opts = {}) {
  const boxH  = opts.h || 54;
  const color = opts.color || C.primary;
  // Fond
  doc.roundedRect(ML, y, CW, boxH, 6).fill(opts.light ? C.primaryLt : C.gray50)
    .stroke(color);
  // Cercle numéro
  doc.circle(ML + 24, y + boxH / 2, 14).fill(color);
  doc.fontSize(11).fillColor(C.white).font('Helvetica-Bold')
    .text(String(num), ML + 24 - 4, y + boxH / 2 - 7, { width: 10, align: 'center' });
  // Titre
  doc.fontSize(10.5).fillColor(color).font('Helvetica-Bold')
    .text(title, ML + 46, y + 10, { width: CW - 56 });
  // Desc
  doc.fontSize(9).fillColor(C.gray600).font('Helvetica')
    .text(desc, ML + 46, y + 25, { width: CW - 56, lineGap: 1 });
  return y + boxH + 6;
}

function infoBox(text, y, opts = {}) {
  const color  = opts.color  || C.info;
  const bgHex  = opts.bg     || '#EFF6FF';
  const icon   = opts.icon   || 'i';
  const h = doc.heightOfString(text, { width: CW - 46, lineGap: 2 }) + 18;
  doc.roundedRect(ML, y, CW, h, 5).fill(bgHex);
  doc.rect(ML, y, 4, h).fill(color);
  doc.circle(ML + 16, y + h / 2, 8).fill(color);
  doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold')
    .text(icon, ML + 13, y + h / 2 - 5, { width: 6, align: 'center' });
  doc.fontSize(9).fillColor(C.gray700).font('Helvetica')
    .text(text, ML + 28, y + 9, { width: CW - 38, lineGap: 2 });
  return y + h + 8;
}

function fieldRow(label, value, y, required = false) {
  const lw = 160;
  // Label
  doc.fontSize(9).fillColor(C.gray600).font('Helvetica-Bold')
    .text(label + (required ? ' *' : ''), ML + 8, y, { width: lw });
  if (required) {
    doc.fontSize(9).fillColor(C.danger).font('Helvetica-Bold')
      .text('*', ML + 8 + doc.widthOfString(label), y);
  }
  // Valeur
  doc.fontSize(9).fillColor(C.gray700).font('Helvetica')
    .text(value, ML + lw + 12, y, { width: CW - lw - 20 });
  return y + 14;
}

function divider(y) {
  doc.rect(ML, y, CW, 1).fill(C.gray200);
  return y + 10;
}

function badge(text, x, y, color, bg) {
  const w = doc.widthOfString(text, { fontSize: 8 }) + 10;
  doc.roundedRect(x, y, w, 14, 3).fill(bg || C.primaryLt);
  doc.fontSize(8).fillColor(color || C.primary).font('Helvetica-Bold')
    .text(text, x + 5, y + 3, { width: w - 10 });
  return x + w + 6;
}

// ── PAGE 1 — COUVERTURE ───────────────────────────────────────────
{
  // Fond haut vert
  doc.rect(0, 0, PW, 320).fill(C.primary);
  // Motif décoratif
  for (let i = 0; i < 6; i++) {
    doc.circle(PW - 60 + i * 15, 60 + i * 18, 40 + i * 10)
       .fillOpacity(0.06).fill(C.white).fillOpacity(1);
  }

  // Logo/icone
  doc.roundedRect(ML, 60, 56, 56, 12).fill('rgba(255,255,255,0.2)');
  doc.fontSize(28).fillColor(C.white).font('Helvetica-Bold').text('SM', ML + 8, 73);

  // Titre principal
  doc.fontSize(28).fillColor(C.white).font('Helvetica-Bold')
    .text('Manuel de saisie', ML, 135, { width: CW });
  doc.fontSize(28).fillColor(C.white).font('Helvetica-Bold')
    .text('des specimens', ML, 163, { width: CW });

  // Sous-titre
  doc.fontSize(13).fillColor('rgba(255,255,255,0.85)').font('Helvetica')
    .text('Guide pas-a-pas pour l\'enregistrement des donnees entomologiques', ML, 200, { width: CW, lineGap: 3 });

  // Organismes
  doc.fontSize(10).fillColor('rgba(255,255,255,0.7)').font('Helvetica')
    .text('SpécimenManager — Institut Pasteur de Madagascar', ML, 240, { width: CW });

  // Date
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.fontSize(9).fillColor('rgba(255,255,255,0.6)').font('Helvetica')
    .text(today, ML, 262, { width: CW });

  // Bloc blanc info
  doc.rect(0, 320, PW, PH - 320).fill(C.white);

  // Ce que couvre ce manuel
  doc.fontSize(13).fillColor(C.gray900).font('Helvetica-Bold')
    .text('Ce manuel couvre', ML, 345, { width: CW });

  const items = [
    { t: 'Connexion',      d: 'Acceder a l\'application et comprendre les roles' },
    { t: 'Hierarchie',     d: 'Projet → Mission → Localite → Methode → Specimen' },
    { t: 'Projets',        d: 'Creer ou selectionner un projet de recherche' },
    { t: 'Missions',       d: 'Creer une mission de terrain liee au projet' },
    { t: 'Localites',      d: 'Enregistrer le site de collecte avec GPS' },
    { t: 'Methodes',       d: 'Definir la methode et le dispositif de piégeage' },
    { t: 'Specimens',      d: 'Saisir moustiques, tiques ou puces avec tous les champs' },
    { t: 'Import Excel',   d: 'Importer un lot de specimens depuis un fichier .xlsx' },
  ];

  let iy = 370;
  items.forEach((item, i) => {
    // Numero
    doc.circle(ML + 12, iy + 8, 10).fill(i % 2 === 0 ? C.primary : C.primaryDk);
    doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold')
      .text(String(i + 1), ML + 9, iy + 3, { width: 8, align: 'center' });
    // Texte
    doc.fontSize(10).fillColor(C.gray900).font('Helvetica-Bold')
      .text(item.t, ML + 28, iy, { width: 100, continued: false });
    doc.fontSize(9).fillColor(C.gray600).font('Helvetica')
      .text(item.d, ML + 28, iy + 13, { width: CW - 38 });
    // Ligne
    if (i < items.length - 1) doc.rect(ML + 28, iy + 29, CW - 28, 0.5).fill(C.gray200);
    iy += 33;
  });

  // Footer page 1
  doc.rect(0, PH - 28, PW, 28).fill(C.gray100);
  doc.fontSize(8).fillColor(C.gray400).font('Helvetica')
    .text('SpécimenManager © Institut Pasteur de Madagascar', ML, PH - 18, { width: CW * 0.75 })
    .text('Page 1 / 8', ML, PH - 18, { width: CW, align: 'right' });
}

// ── PAGE 2 — CONNEXION & ROLES ────────────────────────────────────
newPage();
{
  let y = pageHeader('Connexion et roles');

  y = sectionTitle('1.  Connexion a l\'application', y);
  y = bodyText("Ouvrez votre navigateur et rendez-vous sur l'adresse fournie par votre administrateur (ex : http://192.168.x.x:8080 en reseau local).", y);
  y += 4;

  // Champs de connexion illustres
  y = subTitle('Ecran de connexion', y);
  const formY = y;
  doc.roundedRect(ML, y, CW * 0.55, 90, 8).fill(C.gray50).stroke(C.gray200);
  doc.fontSize(8).fillColor(C.gray600).font('Helvetica-Bold').text('Adresse email', ML + 12, y + 10);
  doc.roundedRect(ML + 12, y + 22, CW * 0.55 - 24, 18, 4).fill(C.white).stroke(C.gray200);
  doc.fontSize(8.5).fillColor(C.gray700).font('Helvetica').text('nom.prenom@pasteur.mg', ML + 18, y + 28);
  doc.fontSize(8).fillColor(C.gray600).font('Helvetica-Bold').text('Mot de passe', ML + 12, y + 48);
  doc.roundedRect(ML + 12, y + 60, CW * 0.55 - 24, 18, 4).fill(C.white).stroke(C.gray200);
  doc.fontSize(8.5).fillColor(C.gray400).font('Helvetica').text('••••••••', ML + 18, y + 66);

  // Bouton connexion
  doc.roundedRect(ML + 12, y + 85, CW * 0.55 - 24, 20, 4).fill(C.primary);
  doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold').text('Se connecter', ML + 12, y + 90, { width: CW * 0.55 - 24, align: 'center' });
  y = formY + 116;

  y = infoBox("Votre compte doit etre active par un administrateur avant la premiere connexion. Si vous ne pouvez pas vous connecter, contactez votre admin.", y, { color: C.info, bg: '#EFF6FF', icon: 'i' });

  y = divider(y);

  y = sectionTitle('2.  Les roles utilisateurs', y);
  y = bodyText("Chaque utilisateur possede un role qui definit ce qu'il peut faire dans l'application.", y);
  y += 6;

  const roles = [
    { r: 'Admin',       c: '#DC2626', bg: '#FEF2F2', d: "Acces total : gestion des utilisateurs, referentiels et toutes les donnees." },
    { r: 'Superviseur', c: '#7C3AED', bg: '#F5F3FF', d: "Gestion des projets et des membres. Peut creer/modifier des projets et ajouter des utilisateurs." },
    { r: 'Chercheur',   c: '#0891B2', bg: '#ECFEFF', d: "Peut creer et modifier toutes les donnees scientifiques (projets, missions, specimens)." },
    { r: 'Technicien',  c: '#D97706', bg: '#FFFBEB', d: "Saisie des specimens, methodes de collecte et import Excel." },
    { r: 'Lecteur',     c: '#6B7280', bg: '#F9FAFB', d: "Consultation uniquement. Aucune modification possible." },
  ];

  roles.forEach(role => {
    const rh = 38;
    doc.roundedRect(ML, y, CW, rh, 5).fill(role.bg);
    doc.roundedRect(ML, y, 6, rh, 3).fill(role.c);
    doc.fontSize(9.5).fillColor(role.c).font('Helvetica-Bold').text(role.r, ML + 14, y + 5, { width: 80 });
    doc.fontSize(8.5).fillColor(C.gray600).font('Helvetica').text(role.d, ML + 100, y + 5, { width: CW - 110, lineGap: 2 });
    y += rh + 4;
  });

  y += 4;
  y = infoBox("Pour saisir des specimens, vous devez etre au moins Technicien ET avoir les permissions pour le(s) type(s) de specimen concerne(s) (moustique, tique, puce).", y, { color: C.accent, bg: '#FFFBEB', icon: '!' });

  pageFooter(2, 8);
}

// ── PAGE 3 — HIERARCHIE & PROJETS ────────────────────────────────
newPage();
{
  let y = pageHeader('Hierarchie des donnees');

  y = sectionTitle('3.  Comprendre la hierarchie des donnees', y);
  y = bodyText("Avant de saisir un specimen, il faut que toutes les entites parentes existent. La hierarchie est :", y);
  y += 8;

  // Diagramme hierarchie
  const levels = [
    { t: 'PROJET',   sub: 'Ex : Surveillance arboviroses 2026',   c: C.primary,  w: 300 },
    { t: 'MISSION',  sub: 'Ex : ORD-2026-001',                    c: C.info,     w: 260 },
    { t: 'LOCALITE', sub: 'Ex : Fokontany Antananarivo-Renivohitra', c: C.accent, w: 220 },
    { t: 'METHODE',  sub: 'Ex : CDC_1 (piegeage lumineux)',        c: C.purple,   w: 180 },
    { t: 'SPECIMEN', sub: 'Ex : Anopheles gambiae, F, Adulte',     c: C.danger,   w: 140 },
  ];

  let lx = ML + CW / 2;
  levels.forEach((lv, i) => {
    const bx = lx - lv.w / 2;
    doc.roundedRect(bx, y, lv.w, 28, 5).fill(lv.c);
    doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold')
      .text(lv.t, bx, y + 4, { width: lv.w, align: 'center' });
    doc.fontSize(7.5).fillColor('rgba(255,255,255,0.85)').font('Helvetica')
      .text(lv.sub, bx, y + 16, { width: lv.w, align: 'center' });
    if (i < levels.length - 1) {
      // Fleche
      const ax = lx;
      doc.moveTo(ax, y + 28).lineTo(ax, y + 38).stroke(C.gray400);
      doc.moveTo(ax - 5, y + 34).lineTo(ax, y + 40).lineTo(ax + 5, y + 34).stroke(C.gray400);
    }
    y += 42;
  });

  y += 4;
  y = infoBox("Regle importante : un specimen est toujours lie a une Methode de collecte, jamais directement a une localite ou une mission.", y, { color: C.danger, bg: '#FEF2F2', icon: '!' });

  y = divider(y);
  y = sectionTitle('4.  Creer ou selectionner un Projet', y, { color: C.primary });
  y = bodyText("Le projet est le contenant de plus haut niveau. Il regroupe plusieurs missions de terrain.", y);
  y += 6;

  y = stepBox(1, 'Aller dans la section Projets', 'Dans le menu de gauche, cliquez sur "Projets".', y);
  y = stepBox(2, 'Creer un nouveau projet', 'Cliquez sur "Nouveau projet" (visible pour Chercheur, Superviseur et Admin).', y);
  y = stepBox(3, 'Remplir les informations', 'Code, nom, porteur, dates de debut/fin et statut sont les champs principaux.', y);

  y += 4;
  // Champs d'un projet
  const projFields = [
    ['Code',      'Identifiant court unique (ex : SURV-ARB-2026)',       true],
    ['Nom',       'Nom complet du projet',                               true],
    ['Porteur',   'Organisme ou responsable scientifique',               false],
    ['Dates',     'Date de debut et de fin prevue',                      false],
    ['Statut',    'Actif / Termine / Suspendu',                         false],
    ['Description','Contexte et objectifs du projet',                    false],
  ];
  doc.roundedRect(ML, y, CW, projFields.length * 14 + 12, 5).fill(C.gray50).stroke(C.gray200);
  y += 8;
  projFields.forEach(([l, v, r]) => { y = fieldRow(l, v, y, r); });
  y += 6;

  pageFooter(3, 8);
}

// ── PAGE 4 — MISSIONS & LOCALITES ────────────────────────────────
newPage();
{
  let y = pageHeader('Missions et Localites');

  y = sectionTitle('5.  Creer une Mission', y, { color: C.info });
  y = bodyText("Une mission correspond a une sortie terrain avec un ordre de mission officiel.", y);
  y += 6;

  y = stepBox(1, 'Aller dans Missions', 'Menu gauche → "Missions", puis "Nouvelle mission".', y, { color: C.info });
  y = stepBox(2, 'Associer au projet', 'Selectionnez le projet parent dans la liste deroulante.', y, { color: C.info });
  y = stepBox(3, 'Remplir les informations de mission', 'Numero d\'ordre, dates, chef de mission, statut et agents de terrain.', y, { color: C.info });

  y += 4;
  const missFields = [
    ['Ordre de mission',  'Reference officielle (ex : ORD-2026-001)',     true],
    ['Projet',            'Selectionner le projet parent',                true],
    ['Chef de mission',   'Nom de l\'encadrant scientifique',             false],
    ['Date debut',        'Date de depart sur le terrain',                true],
    ['Date fin',          'Date de retour (facultative)',                  false],
    ['Statut',            'Planifiee / En cours / Terminee / Annulee',    false],
    ['Objet',             'Description des objectifs de la sortie',       false],
    ['Agents de terrain', 'Maximum 5 agents assignes',                    false],
  ];
  doc.roundedRect(ML, y, CW, missFields.length * 14 + 12, 5).fill('#EFF6FF').stroke(C.info);
  y += 8;
  missFields.forEach(([l, v, r]) => { y = fieldRow(l, v, y, r); });
  y += 10;

  y = divider(y);
  y = sectionTitle('6.  Creer une Localite', y, { color: C.accent });
  y = bodyText("La localite est le site geographique precis ou les specimens ont ete collectes.", y);
  y += 6;

  y = stepBox(1, 'Acceder au detail de la mission', 'Dans la liste des missions, cliquez sur la mission concernee.', y, { color: C.accent });
  y = stepBox(2, 'Ajouter une localite', 'Cliquez sur "Nouvelle localite" depuis le detail de la mission.', y, { color: C.accent });
  y = stepBox(3, 'Definir la position GPS', 'Cliquez sur la carte pour positionner le site ou entrez les coordonnees manuellement.', y, { color: C.accent });

  y += 4;
  const locFields = [
    ['Nom de la localite', 'Nom du site ou du village',                   true],
    ['Region',             'Region administrative',                        false],
    ['District',           'District administratif',                       false],
    ['Commune',            'Commune',                                      false],
    ['Fokontany',          'Fokontany (quartier)',                         false],
    ['Latitude',           'Coordonnee GPS (ex : -18.9137)',               false],
    ['Longitude',          'Coordonnee GPS (ex : 47.5361)',                false],
  ];
  doc.roundedRect(ML, y, CW, locFields.length * 14 + 12, 5).fill('#FFFBEB').stroke(C.accent);
  y += 8;
  locFields.forEach(([l, v, r]) => { y = fieldRow(l, v, y, r); });
  y += 6;

  y = infoBox("Astuce carte : cliquez directement sur la carte pour placer le marqueur. Les champs Region, District, Commune et Fokontany se remplissent automatiquement si la position est dans le shapefile Madagascar.", y, { color: C.accent, bg: '#FFFBEB', icon: '!' });

  pageFooter(4, 8);
}

// ── PAGE 5 — METHODES DE COLLECTE ────────────────────────────────
newPage();
{
  let y = pageHeader('Methode de collecte');

  y = sectionTitle('7.  Creer une Methode de collecte', y, { color: C.purple });
  y = bodyText("La methode decrit le type de piegeage utilise (CDC, BG-Sentinel, capture humaine...) et ses conditions d'utilisation.", y);
  y += 6;

  y = stepBox(1, 'Depuis Methodes ou depuis la Localite', 'Menu gauche → "Methodes" ou depuis le detail de la localite. Cliquez "Nouvelle methode".', y, { color: C.purple });
  y = stepBox(2, 'Selectionner le type de methode', 'Choisissez dans la liste des types disponibles (CDC-LT, BG-Sentinel, Aspiration, etc.).', y, { color: C.purple });
  y = stepBox(3, 'Definir le numero', 'Chaque dispositif dans une localite a un numero : CDC_1, CDC_2, BG_1, etc.', y, { color: C.purple });

  y += 4;
  const methFields = [
    ['Localite',             'Site parent auquel est rattachee la methode',    true],
    ['Type de methode',      'CDC-LT / BG-Sentinel / Aspirateur / Capture...',true],
    ['Numero',               'Numero du dispositif dans cette localite (1, 2...)', true],
    ['Type habitat',         'Peridomestique / Forestier / Rizicole...',       false],
    ['Type environnement',   'Urbain / Rural / Forestier...',                  false],
    ['Date de collecte',     'Date de pose/retrait du piege',                  false],
    ['Heure debut',          'Heure de mise en place (ex : 18:00)',            false],
    ['Heure fin',            'Heure de levee (ex : 06:00)',                    false],
    ['Position GPS',         'Coordonnees du dispositif (optionnel)',           false],
    ['Notes',                'Observations particulieres sur la collecte',      false],
  ];
  doc.roundedRect(ML, y, CW, methFields.length * 14 + 12, 5).fill('#FAF5FF').stroke(C.purple);
  y += 8;
  methFields.forEach(([l, v, r]) => { y = fieldRow(l, v, y, r); });
  y += 10;

  y = divider(y);
  y = sectionTitle('Types de methodes courants', y);
  y += 4;

  const types = [
    { code: 'CDC-LT',    desc: 'Piege lumineux CDC (CDC Light Trap) — attraction par lumiere UV' },
    { code: 'BG-SENT',   desc: 'Piege BG-Sentinel — attraction par CO2 et pheromons' },
    { code: 'HLC',       desc: 'Capture sur appat humain (Human Landing Catch)' },
    { code: 'ASPIR',     desc: 'Aspiration a l\'aide d\'un aspirateur de type Prokopack' },
    { code: 'REPO',      desc: 'Capture au repos dans les habitations' },
    { code: 'LARV',      desc: 'Collecte de larves dans les gites larvaires' },
  ];

  types.forEach(t => {
    let bx = ML;
    bx = badge(t.code, bx, y, C.purple, '#EDE9FE');
    doc.fontSize(9).fillColor(C.gray600).font('Helvetica').text(t.desc, bx, y + 2, { width: CW - (bx - ML) - 4 });
    y += 18;
  });

  pageFooter(5, 8);
}

// ── PAGE 6 — SAISIE SPECIMEN ──────────────────────────────────────
newPage();
{
  let y = pageHeader('Saisie d\'un specimen');

  y = sectionTitle('8.  Saisir un specimen', y, { color: C.danger });
  y = bodyText("Une fois la methode de collecte creee, vous pouvez saisir les specimens collectes.", y);
  y += 6;

  y = stepBox(1, 'Aller dans la section Specimens', 'Menu gauche → choisissez le type : Moustiques, Tiques ou Puces.', y, { color: C.danger });
  y = stepBox(2, 'Cliquer sur "Nouveau specimen"', 'Le bouton est visible uniquement si vous avez la permission pour ce type.', y, { color: C.danger });
  y = stepBox(3, 'Selectionner la methode parente', 'Choisissez la methode de collecte a laquelle ce specimen est associe.', y, { color: C.danger });
  y = stepBox(4, 'Remplir les champs biologiques', 'Taxonomie, nombre, sexe, stade et tous les champs specifiques au type.', y, { color: C.danger });
  y = stepBox(5, 'Assigner une position de plaque', 'Si le specimen est place dans une boite a tubes, selectionnez la position.', y, { color: C.danger });

  y += 4;
  y = sectionTitle('Champs communs a tous les specimens', y);
  y += 4;

  const commonFields = [
    ['Methode de collecte',  'Rattacher le specimen a une methode existante',   true],
    ['Taxonomie',            'Genre et espece (ex : Anopheles gambiae)',          true],
    ['Nombre',               'Nombre d\'individus dans ce lot (defaut : 1)',      true],
    ['Sexe',                 'Male / Femelle / Inconnu',                         true],
    ['Stade',                'Adulte / Larve L1-L4 / Nymphe / Oeuf',            false],
    ['ID terrain',           'Code de terrain (ex : MQ-2026-001)',               false],
    ['Date de collecte',     'Date effective de la collecte',                    false],
    ['Solution conservation','Ethanol 70% / Congelation / Sec...',              false],
    ['Notes',                'Observations libres sur le specimen',              false],
  ];
  doc.roundedRect(ML, y, CW, commonFields.length * 14 + 12, 5).fill('#FEF2F2').stroke(C.danger);
  y += 8;
  commonFields.forEach(([l, v, r]) => { y = fieldRow(l, v, y, r); });
  y += 8;

  y = infoBox("Champ Taxonomie : saisissez les premieres lettres du genre ou de l'espece — l'autocompletion propose les taxons disponibles dans le referentiel.", y, { color: C.primary, bg: C.primaryLt, icon: 'i' });

  pageFooter(6, 8);
}

// ── PAGE 7 — CHAMPS SPECIFIQUES & BOITE TUBES ────────────────────
newPage();
{
  let y = pageHeader('Champs specifiques et boite a tubes');

  y = sectionTitle('9.  Champs specifiques par type', y);
  y += 4;

  // Moustique
  doc.roundedRect(ML, y, CW, 14, 3).fill('#DCFCE7');
  doc.fontSize(9.5).fillColor('#166534').font('Helvetica-Bold').text('Moustiques uniquement', ML + 8, y + 3, { width: CW });
  y += 18;
  const moustFields = [
    ['Parite',        'Nullipare / Paucipare / Multipare (pour femelles)',    false],
    ['Repas de sang', 'A jeun / Gorgee / Semi-gorgee / Digere',              false],
    ['Position plaque','Position dans la boite a tubes (A1, B2...)',          false],
  ];
  doc.roundedRect(ML, y, CW, moustFields.length * 14 + 10, 4).fill(C.gray50).stroke(C.gray200);
  y += 6;
  moustFields.forEach(([l, v, r]) => { y = fieldRow(l, v, y, r); });
  y += 12;

  // Tique
  doc.roundedRect(ML, y, CW, 14, 3).fill('#FEF3C7');
  doc.fontSize(9.5).fillColor('#92400E').font('Helvetica-Bold').text('Tiques uniquement', ML + 8, y + 3, { width: CW });
  y += 18;
  const tiqueFields = [
    ['Gorgée',        'A jeun / Gorgee / Semi-gorgee',                       false],
    ['Hote',          'Animal hote sur lequel la tique a ete prelevee',      false],
    ['Position plaque','Position dans la boite a tubes',                      false],
  ];
  doc.roundedRect(ML, y, CW, tiqueFields.length * 14 + 10, 4).fill(C.gray50).stroke(C.gray200);
  y += 6;
  tiqueFields.forEach(([l, v, r]) => { y = fieldRow(l, v, y, r); });
  y += 12;

  // Puce
  doc.roundedRect(ML, y, CW, 14, 3).fill('#FCE7F3');
  doc.fontSize(9.5).fillColor('#831843').font('Helvetica-Bold').text('Puces uniquement', ML + 8, y + 3, { width: CW });
  y += 18;
  const puceFields = [
    ['Hote',          'Animal hote sur lequel la puce a ete prelevee',       false],
    ['Position plaque','Position dans la boite a tubes',                      false],
  ];
  doc.roundedRect(ML, y, CW, puceFields.length * 14 + 10, 4).fill(C.gray50).stroke(C.gray200);
  y += 6;
  puceFields.forEach(([l, v, r]) => { y = fieldRow(l, v, y, r); });
  y += 14;

  y = divider(y);
  y = sectionTitle('10.  Boite a tubes (PlaquePuits)', y);
  y = bodyText("La boite a tubes permet de localiser physiquement le specimen dans une plaque de 96 puits (8 lignes A-H x 12 colonnes 1-12).", y);
  y += 8;

  // Schema plaque simplifie
  const rows = ['A','B','C','D','E','F','G','H'];
  const cols = 12;
  const cw2 = 20, rh2 = 16;
  const startX = ML + 20;
  const startY = y;

  // En-tetes colonnes
  for (let c = 0; c < cols; c++) {
    doc.fontSize(6).fillColor(C.gray400).font('Helvetica-Bold')
      .text(String(c + 1), startX + c * cw2, startY - 10, { width: cw2, align: 'center' });
  }

  rows.forEach((row, r) => {
    // En-tete ligne
    doc.fontSize(7).fillColor(C.gray400).font('Helvetica-Bold')
      .text(row, startX - 12, startY + r * rh2 + 4);
    for (let c = 0; c < cols; c++) {
      const isEx = (r === 1 && c === 2); // B3 = exemple
      doc.roundedRect(startX + c * cw2 + 1, startY + r * rh2 + 1, cw2 - 2, rh2 - 2, 2)
        .fill(isEx ? C.danger : (r % 2 === 0 ? '#EFF6FF' : C.white))
        .stroke(isEx ? C.danger : C.gray200);
      if (isEx) {
        doc.fontSize(5.5).fillColor(C.white).font('Helvetica-Bold')
          .text('B3', startX + c * cw2 + 1, startY + r * rh2 + 5, { width: cw2 - 2, align: 'center' });
      }
    }
  });

  y = startY + rows.length * rh2 + 14;
  y = bodyText("La case rouge (B3) illustre un specimen selectionne. Cliquez sur une case libre pour l'assigner au specimen en cours de saisie.", y);
  y += 4;
  y = infoBox("Chaque position (A1 a H12) est unique par methode de collecte. Vous ne pouvez pas assigner deux specimens a la meme position.", y, { color: C.danger, bg: '#FEF2F2', icon: '!' });

  pageFooter(7, 8);
}

// ── PAGE 8 — IMPORT EXCEL ────────────────────────────────────────
newPage();
{
  let y = pageHeader('Import Excel et conseils');

  y = sectionTitle('11.  Import Excel (lot de specimens)', y);
  y = bodyText("Pour saisir un grand nombre de specimens rapidement, utilisez l'import par fichier Excel (.xlsx).", y);
  y += 6;

  y = stepBox(1, 'Telecharger le modele Excel', 'Allez dans "Import" (menu gauche) → cliquez "Telecharger le modele .xlsx".', y);
  y = stepBox(2, 'Remplir le fichier', 'Ouvrez le modele dans Excel. Respectez les colonnes et la premiere ligne d\'en-tete.', y);
  y = stepBox(3, 'Selectionner la methode cible', 'Dans l\'interface d\'import, choisissez la methode de collecte destinataire.', y);
  y = stepBox(4, 'Importer le fichier', 'Glissez-deposez ou cliquez pour selectionner le fichier .xlsx, puis confirmez.', y);

  y += 6;
  y = sectionTitle('Structure du fichier Excel', y);
  y += 4;

  // Tableau colonnes Excel
  const headers = ['Col', 'Champ',         'Exemple',                'Obligatoire'];
  const rows2   = [
    ['1',  'Genre',              'Anopheles',              'Oui'],
    ['2',  'Espece',             'gambiae',                'Oui'],
    ['3',  'Nombre',             '1',                      'Oui'],
    ['4',  'Sexe',               'F',                      'Oui'],
    ['5',  'Stade',              'Adulte',                 'Non'],
    ['6',  'Parite',             'Nullipare',              'Non'],
    ['7',  'Repas sang',         'A_jeun',                 'Non'],
    ['8',  'Date collecte',      '2026-06-15',             'Non'],
    ['9',  'ID terrain',         'MQ-2026-001',            'Non'],
    ['10', 'Notes',              'Piege CDC nord',         'Non'],
    ['11', 'Solution conserv.',  'Ethanol_70',             'Non'],
  ];

  const colW = [25, 100, 160, 70];
  const rowH = 14;
  const tx   = ML;

  // En-tete
  doc.roundedRect(tx, y, CW, rowH, 0).fill(C.primary);
  let cx = tx + 4;
  headers.forEach((h, i) => {
    doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold')
      .text(h, cx, y + 3, { width: colW[i], align: i === 3 ? 'center' : 'left' });
    cx += colW[i] + (i < 3 ? 8 : 0);
  });
  y += rowH;

  rows2.forEach((row, ri) => {
    doc.rect(tx, y, CW, rowH).fill(ri % 2 === 0 ? C.gray50 : C.white);
    cx = tx + 4;
    row.forEach((cell, ci) => {
      const isReq = ci === 3 && cell === 'Oui';
      doc.fontSize(8).fillColor(isReq ? C.danger : C.gray700)
        .font(ci === 0 || isReq ? 'Helvetica-Bold' : 'Helvetica')
        .text(cell, cx, y + 3, { width: colW[ci], align: ci === 3 ? 'center' : 'left' });
      cx += colW[ci] + (ci < 3 ? 8 : 0);
    });
    y += rowH;
  });
  doc.rect(tx, y - rows2.length * rowH - rowH, CW, (rows2.length + 1) * rowH).stroke(C.gray200);
  y += 10;

  y = infoBox("La premiere ligne du fichier (en-tetes) est ignoree par le systeme. Ne modifiez pas l'ordre des colonnes. Les valeurs de sexe acceptees sont : M, F, inconnu.", y, { color: C.info, bg: '#EFF6FF', icon: 'i' });

  y = divider(y);
  y = sectionTitle('12.  Conseils et bonnes pratiques', y);
  y += 4;

  const tips = [
    "Verifiez que la taxonomie utilisee (genre + espece) existe dans le referentiel avant d'importer.",
    "Si une ligne est invalide lors de l'import, les autres lignes valides sont quand meme importees.",
    "Utilisez l'explorateur (menu Recherche) pour verifier rapidement les specimens saisis.",
    "En cas d'erreur de saisie, utilisez le bouton de modification depuis le detail du specimen.",
    "L'export Excel depuis l'explorateur permet d'obtenir tous les specimens avec leur localisation complete.",
    "Signalez tout probleme a votre administrateur en mentionnant le message d'erreur exact affiche.",
  ];

  tips.forEach((tip, i) => {
    y = bullet(tip, y, { color: i % 2 === 0 ? C.primary : C.primaryDk });
  });

  y += 8;
  // Bloc contact
  doc.roundedRect(ML, y, CW, 44, 6).fill(C.primaryLt);
  doc.fontSize(9.5).fillColor(C.primaryDk).font('Helvetica-Bold')
    .text('Besoin d\'aide ?', ML + 12, y + 8, { width: CW - 24 });
  doc.fontSize(9).fillColor(C.gray700).font('Helvetica')
    .text("Contactez votre administrateur systeme ou le referent informatique de l'Institut Pasteur de Madagascar.", ML + 12, y + 22, { width: CW - 24, lineGap: 2 });

  pageFooter(8, 8);
}

doc.end();
console.log('Manuel genere :', OUT);
