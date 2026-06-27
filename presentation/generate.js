const PptxGenJS = require('pptxgenjs');

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_WIDE'; // 16:9

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  green:       '1D9E75',
  greenDark:   '157A5A',
  greenLight:  'E8F7F2',
  amber:       'F59E0B',
  red:         'EF4444',
  white:       'FFFFFF',
  offWhite:    'FAFAFA',
  gray100:     'F3F4F6',
  gray200:     'E5E7EB',
  gray400:     '9CA3AF',
  gray600:     '4B5563',
  gray800:     '1F2937',
  dark:        '111827',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function addBg(slide, color = C.offWhite) {
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color } });
}

function addAccentBar(slide, color = C.green) {
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: '100%', fill: { color } });
}

function addTitle(slide, text, opts = {}) {
  slide.addText(text, {
    x: 0.5, y: opts.y ?? 0.35, w: opts.w ?? 11.5, h: opts.h ?? 0.7,
    fontSize: opts.size ?? 26, bold: true,
    color: opts.color ?? C.dark,
    fontFace: 'Calibri',
    ...opts,
  });
}

function addSubtitle(slide, text, opts = {}) {
  slide.addText(text, {
    x: 0.5, y: opts.y ?? 1.0, w: opts.w ?? 11.5, h: opts.h ?? 0.4,
    fontSize: opts.size ?? 14,
    color: opts.color ?? C.gray600,
    fontFace: 'Calibri',
    ...opts,
  });
}

function addBullets(slide, items, opts = {}) {
  const rows = items.map(t => ({
    text: t,
    options: { bullet: { type: 'bullet', indent: 10 }, fontSize: opts.fontSize ?? 15, color: opts.color ?? C.gray800, fontFace: 'Calibri', paraSpaceAfter: 6 },
  }));
  slide.addText(rows, {
    x: opts.x ?? 0.55, y: opts.y ?? 1.45, w: opts.w ?? 11, h: opts.h ?? 4.5,
    valign: 'top',
  });
}

function addBox(slide, x, y, w, h, fillColor, text, textColor = C.white, fontSize = 13) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: fillColor },
    line: { color: fillColor },
    rectRadius: 0.1,
  });
  slide.addText(text, {
    x, y, w, h,
    fontSize, bold: true, color: textColor,
    align: 'center', valign: 'middle',
    fontFace: 'Calibri',
    wrap: true,
  });
}

function addSpeakerNotes(slide, text) {
  slide.addNotes(text);
}

function addDivider(slide, y) {
  slide.addShape(pres.ShapeType.line, {
    x: 0.5, y, w: 11.5, h: 0,
    line: { color: C.gray200, width: 1 },
  });
}

function addFooter(slide, num) {
  slide.addText(`SpécimenManager  ·  Institut Pasteur Madagascar  ·  ${num}/10`, {
    x: 0, y: 7.1, w: '100%', h: 0.3,
    fontSize: 9, color: C.gray400, align: 'center', fontFace: 'Calibri',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Titre / Accroche
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  // Fond sombre
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.dark } });
  // Bande verte gauche large
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 4.5, h: '100%', fill: { color: C.green } });

  // Texte gauche (sur vert)
  s.addText('SpécimenManager', {
    x: 0.3, y: 1.6, w: 3.9, h: 0.8,
    fontSize: 30, bold: true, color: C.white, fontFace: 'Calibri',
  });
  s.addText('La traçabilité entomologique\nau service de la recherche', {
    x: 0.3, y: 2.5, w: 3.9, h: 1.2,
    fontSize: 16, color: 'D1FAE5', fontFace: 'Calibri', lineSpacingMultiple: 1.3,
  });
  s.addText('Institut Pasteur Madagascar', {
    x: 0.3, y: 4.0, w: 3.9, h: 0.5,
    fontSize: 13, bold: true, color: 'A7F3D0', fontFace: 'Calibri',
  });

  // Contenu droite (sur fond sombre)
  s.addText('Moustiques · Tiques · Puces', {
    x: 5.0, y: 2.2, w: 6.5, h: 0.6,
    fontSize: 22, bold: true, color: C.green, fontFace: 'Calibri',
  });
  s.addText('Collecte terrain → Saisie numérique → Analyse\nSans perte. Sans erreur. Sans délai.', {
    x: 5.0, y: 3.0, w: 6.5, h: 1.2,
    fontSize: 15, color: C.gray400, fontFace: 'Calibri', lineSpacingMultiple: 1.5,
  });

  // Icônes textuels (émojis entomologie)
  s.addText('🦟   🕷️   🦟', {
    x: 5.0, y: 5.0, w: 6.5, h: 0.6,
    fontSize: 28, align: 'center',
  });

  addSpeakerNotes(s, "Bonjour à tous. Je vais vous présenter SpécimenManager, une application développée spécifiquement pour Institut Pasteur Madagascar. Son objectif : ne plus perdre une seule donnée entre le moment où un entomologiste attrape un spécimen sur le terrain et le moment où le chercheur analyse ses résultats au laboratoire. Dix minutes, et vous aurez une vision complète.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Le problème
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.red);
  addFooter(s, 2);

  addTitle(s, 'Avant : un processus fragmenté et risqué');
  addDivider(s, 1.1);

  // Étapes en rouge/orange
  const steps = [
    { x: 0.55, label: '📄 Papier terrain', sub: 'Fiche manuscrite' },
    { x: 3.10, label: '📊 Excel local', sub: 'Retranscription manuelle' },
    { x: 5.65, label: '📧 Email', sub: 'Fichiers épars' },
    { x: 8.20, label: '❓ Base floue', sub: 'Quelle version ?' },
  ];

  steps.forEach((st, i) => {
    const boxColor = i === 3 ? C.red : 'DC2626';
    addBox(s, st.x, 1.5, 2.3, 1.0, boxColor, st.label + '\n' + st.sub, C.white, 12);
    if (i < steps.length - 1) {
      s.addShape(pres.ShapeType.line, {
        x: st.x + 2.35, y: 2.0, w: 0.7, h: 0,
        line: { color: C.red, width: 2 },
      });
      s.addText('→', { x: st.x + 2.35, y: 1.85, w: 0.7, h: 0.3, fontSize: 16, color: C.red, align: 'center' });
    }
  });

  // Problèmes listés
  const problems = [
    '⚠️  Erreurs de retranscription — un chiffre mal recopié invalide un spécimen',
    '⚠️  Aucune traçabilité — impossible de savoir qui a modifié quoi, quand',
    '⚠️  Pas de standard commun — chaque agent a son propre format Excel',
    '⚠️  Données perdues entre terrain et laboratoire — des semaines de collecte en jeu',
    '⚠️  Zéro contrôle qualité — les valeurs (statut sanguin, méthode, stade…) ne sont pas vérifiées',
  ];

  addBullets(s, problems, { y: 2.8, fontSize: 14, color: C.gray800 });

  addSpeakerNotes(s, "Le quotidien avant cette application : le terrain remplit des fiches papier. Quelqu'un retranscrit manuellement en Excel. Des fichiers circulent par email. Les chercheurs ne savent pas quelle version est la bonne. Un spécimen mal codé peut invalider des semaines de travail. Et personne ne sait qui a modifié quoi. C'est exactement ce problème que SpécimenManager résout.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — La solution
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.green);
  addFooter(s, 3);

  addTitle(s, 'SpécimenManager : une seule source de vérité');
  addDivider(s, 1.1);

  // Hiérarchie arbre
  const hier = [
    { label: '📁  Projet', color: C.greenDark },
    { label: '🗺️  Mission', color: C.green },
    { label: '📍  Localité', color: '0D9488' },
    { label: '🔬  Méthode de collecte', color: C.amber },
    { label: '🦟  Spécimen (Moustique / Tique / Puce)', color: C.red },
  ];

  hier.forEach((h, i) => {
    const indent = i * 0.4;
    addBox(s, 0.55 + indent, 1.4 + i * 0.9, 5.5 - indent * 0.5, 0.7, h.color, h.label, C.white, 13);
    if (i < hier.length - 1) {
      s.addShape(pres.ShapeType.line, {
        x: 0.9 + indent, y: 2.1 + i * 0.9, w: 0, h: 0.2,
        line: { color: C.gray400, width: 1, dashType: 'dash' },
      });
    }
  });

  // Rôles à droite
  s.addText('Rôles & accès', {
    x: 6.8, y: 1.3, w: 4.7, h: 0.5,
    fontSize: 14, bold: true, color: C.dark, fontFace: 'Calibri',
  });

  const roles = [
    { label: 'Admin', color: C.red, desc: 'Accès total + gestion utilisateurs' },
    { label: 'Chercheur', color: C.green, desc: 'Saisie, export, analyse' },
    { label: 'Terrain', color: C.amber, desc: 'Saisie spécimens uniquement' },
    { label: 'Lecteur', color: C.gray400, desc: 'Consultation uniquement' },
  ];

  roles.forEach((r, i) => {
    addBox(s, 6.8, 1.9 + i * 1.0, 1.5, 0.7, r.color, r.label, C.white, 12);
    s.addText(r.desc, {
      x: 8.45, y: 1.9 + i * 1.0, w: 3.05, h: 0.7,
      fontSize: 11, color: C.gray600, valign: 'middle', fontFace: 'Calibri',
    });
  });

  s.addText('✅  Conforme aux protocoles de collecte officiels d\'IPM', {
    x: 0.55, y: 6.5, w: 11, h: 0.4,
    fontSize: 13, bold: true, color: C.green, fontFace: 'Calibri',
  });

  addSpeakerNotes(s, "La réponse à ce chaos : une seule application, accessible depuis n'importe quel navigateur sur le réseau IPM. Tout est structuré autour d'une hiérarchie métier réelle — la même que vous utilisez sur le terrain. Et chaque utilisateur n'accède qu'à ce que son rôle lui autorise : un agent de terrain ne voit pas les paramètres d'administration.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.green);
  addFooter(s, 4);

  addTitle(s, 'Tableau de bord — Vue d\'ensemble instantanée');
  addDivider(s, 1.1);

  // Cartes de stats simulées
  const statCards = [
    { label: 'Projets', value: '12', color: C.green },
    { label: 'Missions', value: '47', color: '0EA5E9' },
    { label: 'Spécimens total', value: '1 842', color: C.gray800 },
    { label: 'Moustiques', value: '1 204', color: C.green },
  ];

  statCards.forEach((c, i) => {
    const x = 0.55 + i * 2.9;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.4, w: 2.6, h: 1.3,
      fill: { color: C.white },
      line: { color: C.gray200, width: 1 },
      rectRadius: 0.12,
      shadow: { type: 'outer', color: '00000015', blur: 8, offset: 2, angle: 90 },
    });
    s.addText(c.value, { x, y: 1.55, w: 2.6, h: 0.55, fontSize: 24, bold: true, color: c.color, align: 'center', fontFace: 'Calibri' });
    s.addText(c.label, { x, y: 2.1, w: 2.6, h: 0.4, fontSize: 11, color: C.gray600, align: 'center', fontFace: 'Calibri' });
  });

  // Représentation graphique simplifiée (barres)
  s.addText('📈  Collectes par mois (6 derniers mois)', {
    x: 0.55, y: 3.0, w: 7.5, h: 0.4, fontSize: 13, bold: true, color: C.dark, fontFace: 'Calibri',
  });

  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'];
  const vals =   [180,  210,  165,  290,  245,  180 ];
  const maxVal = Math.max(...vals);

  months.forEach((m, i) => {
    const barH = (vals[i] / maxVal) * 2.2;
    const x = 0.55 + i * 1.2;
    const y = 5.4 - barH;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 0.9, h: barH, fill: { color: C.green }, line: { color: C.green }, rectRadius: 0.05 });
    s.addText(m, { x, y: 5.5, w: 0.9, h: 0.3, fontSize: 10, color: C.gray400, align: 'center', fontFace: 'Calibri' });
    s.addText(String(vals[i]), { x, y: y - 0.35, w: 0.9, h: 0.3, fontSize: 10, color: C.green, bold: true, align: 'center', fontFace: 'Calibri' });
  });

  // Donut simplifié
  s.addText('🥧  Répartition par type', {
    x: 8.2, y: 3.0, w: 3.5, h: 0.4, fontSize: 13, bold: true, color: C.dark, fontFace: 'Calibri',
  });
  const types = [
    { label: 'Moustique  65%', color: C.green },
    { label: 'Tique         22%', color: C.amber },
    { label: 'Puce           13%', color: C.red },
  ];
  types.forEach((t, i) => {
    s.addShape(pres.ShapeType.ellipse, { x: 8.25, y: 3.55 + i * 0.65, w: 0.25, h: 0.25, fill: { color: t.color }, line: { color: t.color } });
    s.addText(t.label, { x: 8.6, y: 3.5 + i * 0.65, w: 3.0, h: 0.35, fontSize: 12, color: C.gray800, fontFace: 'Calibri' });
  });

  addSpeakerNotes(s, "Dès la connexion, le chercheur ou le responsable de projet voit immédiatement l'état de la collecte. Combien de spécimens ce mois-ci ? Quelle espèce domine ? Quelle mission est en cours ? Tout ça en un coup d'œil, sans ouvrir un seul fichier Excel. Les graphiques sont dynamiques et se mettent à jour en temps réel.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Saisie terrain & carte
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.green);
  addFooter(s, 5);

  addTitle(s, 'Saisie terrain — Rigoureuse & géolocalisée');
  addDivider(s, 1.1);

  // Colonne gauche — formulaire structuré
  s.addText('Formulaire structuré IPM', {
    x: 0.55, y: 1.3, w: 5.5, h: 0.4, fontSize: 14, bold: true, color: C.dark, fontFace: 'Calibri',
  });

  const fields = [
    { label: 'Statut sanguin', value: 'G / Gr / SGr / N / NC', highlight: true },
    { label: 'Stade', value: 'E / L / N / A (adulte)' },
    { label: 'Parité', value: 'Nulle → NP · Paucie/Multi → P' },
    { label: 'Trap_ID', value: 'HLC, ZP-DP, DN, MHT, OVITRAP…' },
    { label: 'GPS', value: '📍 Clic sur carte = coordonnées', highlight: true },
    { label: 'Position plaque', value: 'Sélecteur visuel (H12 bloqué)', highlight: true },
  ];

  fields.forEach((f, i) => {
    const bg = f.highlight ? C.greenLight : C.white;
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.55, y: 1.8 + i * 0.72, w: 5.5, h: 0.62,
      fill: { color: bg }, line: { color: C.gray200, width: 1 }, rectRadius: 0.07,
    });
    s.addText(f.label, { x: 0.75, y: 1.85 + i * 0.72, w: 2.2, h: 0.52, fontSize: 11, bold: true, color: C.gray800, valign: 'middle', fontFace: 'Calibri' });
    s.addText(f.value, { x: 2.95, y: 1.85 + i * 0.72, w: 2.9, h: 0.52, fontSize: 11, color: C.green, valign: 'middle', fontFace: 'Calibri' });
  });

  // Colonne droite — carte
  s.addText('Carte interactive des collectes', {
    x: 6.5, y: 1.3, w: 5.0, h: 0.4, fontSize: 14, bold: true, color: C.dark, fontFace: 'Calibri',
  });

  // Simulation carte (fond vert clair + marqueurs)
  s.addShape(pres.ShapeType.roundRect, {
    x: 6.5, y: 1.8, w: 5.0, h: 3.8,
    fill: { color: 'D1FAE5' }, line: { color: C.green, width: 1.5 }, rectRadius: 0.12,
  });
  s.addText('🗺️\nCarte Leaflet\nMarqueurs géolocalisés\npar type de spécimen', {
    x: 6.5, y: 2.2, w: 5.0, h: 3.0,
    fontSize: 14, color: C.greenDark, align: 'center', valign: 'middle',
    fontFace: 'Calibri', lineSpacingMultiple: 1.5,
  });

  // Légende carte
  const mapLegend = [
    { color: C.green, label: 'Moustique' },
    { color: C.amber, label: 'Tique' },
    { color: C.red,   label: 'Puce' },
  ];
  mapLegend.forEach((l, i) => {
    s.addShape(pres.ShapeType.ellipse, { x: 6.6 + i * 1.6, y: 5.75, w: 0.22, h: 0.22, fill: { color: l.color }, line: { color: l.color } });
    s.addText(l.label, { x: 6.9 + i * 1.6, y: 5.72, w: 1.3, h: 0.28, fontSize: 10, color: C.gray600, fontFace: 'Calibri' });
  });

  // Note H12
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.55, y: 6.35, w: 5.5, h: 0.45,
    fill: { color: 'FEF3C7' }, line: { color: C.amber, width: 1 }, rectRadius: 0.07,
  });
  s.addText('⚠️  H12 = Témoin négatif — position automatiquement bloquée par l\'application', {
    x: 0.65, y: 6.38, w: 5.3, h: 0.39, fontSize: 10, color: '92400E', fontFace: 'Calibri', valign: 'middle',
  });

  addSpeakerNotes(s, "La saisie est guidée par les protocoles de collecte d'IPM. Le champ 'repas sanguin' propose uniquement les valeurs reconnues : N, G, Gr, SGr, NC — impossible de saisir une valeur incorrecte. La position H12 dans la plaque est automatiquement bloquée — c'est le témoin négatif, l'application l'empêche physiquement. Et si vous avez 200 spécimens à importer d'un coup, le fichier Excel standard est accepté directement.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Recherche & export
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.green);
  addFooter(s, 6);

  addTitle(s, 'Recherche & Export — Les données à portée de main');
  addDivider(s, 1.1);

  // Filtres gauche
  s.addText('Filtres multi-critères', {
    x: 0.55, y: 1.3, w: 4.5, h: 0.4, fontSize: 14, bold: true, color: C.dark, fontFace: 'Calibri',
  });

  const filters = ['Type de spécimen', 'Statut sanguin (N/G/Gr/SGr/NC)', 'Espèce (genre)', 'Localité / Mission / Projet', 'Période de collecte', 'Méthode de collecte'];
  filters.forEach((f, i) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.55, y: 1.8 + i * 0.7, w: 4.5, h: 0.55,
      fill: { color: C.white }, line: { color: C.gray200, width: 1 }, rectRadius: 0.07,
    });
    s.addText('🔍  ' + f, {
      x: 0.7, y: 1.83 + i * 0.7, w: 4.2, h: 0.49,
      fontSize: 11.5, color: C.gray800, valign: 'middle', fontFace: 'Calibri',
    });
  });

  // Résultats droite (tableau simplifié)
  s.addText('Résultats — prêts à exporter', {
    x: 5.4, y: 1.3, w: 6.1, h: 0.4, fontSize: 14, bold: true, color: C.dark, fontFace: 'Calibri',
  });

  const headers = ['Genre', 'Espèce', 'Repas sang', 'Parité', 'Localité'];
  headers.forEach((h, i) => {
    s.addShape(pres.ShapeType.rect, {
      x: 5.4 + i * 1.22, y: 1.82, w: 1.22, h: 0.42,
      fill: { color: C.greenDark }, line: { color: C.greenDark },
    });
    s.addText(h, {
      x: 5.4 + i * 1.22, y: 1.82, w: 1.22, h: 0.42,
      fontSize: 9.5, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Calibri',
    });
  });

  const tableData = [
    ['Anopheles', 'gambiae', 'G', 'P', 'Antananarivo'],
    ['Culex', 'quinquefasciatus', 'N', 'NP', 'Toamasina'],
    ['Aedes', 'albopictus', 'Gr', 'P', 'Fianarantsoa'],
    ['Anopheles', 'arabiensis', 'SGr', 'P', 'Mahajanga'],
  ];

  tableData.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const bg = ri % 2 === 0 ? C.white : C.gray100;
      s.addShape(pres.ShapeType.rect, {
        x: 5.4 + ci * 1.22, y: 2.24 + ri * 0.5, w: 1.22, h: 0.5,
        fill: { color: bg }, line: { color: C.gray200, width: 0.5 },
      });
      s.addText(cell, {
        x: 5.4 + ci * 1.22, y: 2.24 + ri * 0.5, w: 1.22, h: 0.5,
        fontSize: 10, color: C.gray800, align: 'center', valign: 'middle',
        fontFace: ci < 2 ? 'Calibri' : 'Calibri',
        italic: ci < 2,
      });
    });
  });

  // Bouton export
  addBox(s, 8.5, 5.6, 2.9, 0.65, C.green, '⬇️  Exporter en Excel (.xlsx)', C.white, 13);

  s.addText('Colonnes structurées, prêtes pour R / Python / SPSS', {
    x: 5.4, y: 6.35, w: 6.1, h: 0.4,
    fontSize: 11, color: C.gray600, italic: true, fontFace: 'Calibri',
  });

  addSpeakerNotes(s, "Un chercheur qui a besoin de tous les moustiques gorgés collectés à Antananarivo en avril sur le projet X ? Trois filtres, deux secondes, et le fichier Excel est prêt. Les colonnes sont exactement celles attendues par vos protocoles d'analyse. La colonne Parité est même calculée automatiquement selon les règles de collecte IPM.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Utilisateurs & sécurité
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.green);
  addFooter(s, 7);

  addTitle(s, 'Gestion des accès & Sécurité des données');
  addDivider(s, 1.1);

  // Tableau des rôles
  const rolesCols = ['Admin', 'Chercheur', 'Terrain', 'Lecteur'];
  const rolesColors = [C.red, C.green, C.amber, C.gray600];
  const perms = [
    { label: 'Consulter les données',           vals: [true, true, true, true] },
    { label: 'Saisir des spécimens',             vals: [true, true, true, false] },
    { label: 'Modifier / supprimer',             vals: [true, true, false, false] },
    { label: 'Importer / Exporter Excel',        vals: [true, true, false, false] },
    { label: 'Gérer les projets & missions',     vals: [true, true, false, false] },
    { label: 'Gérer les utilisateurs',           vals: [true, false, false, false] },
    { label: 'Accéder aux logs d\'audit',        vals: [true, false, false, false] },
  ];

  // En-têtes colonnes
  rolesCols.forEach((r, ci) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: 3.0 + ci * 2.2, y: 1.4, w: 2.0, h: 0.55,
      fill: { color: rolesColors[ci] }, line: { color: rolesColors[ci] }, rectRadius: 0.08,
    });
    s.addText(r, {
      x: 3.0 + ci * 2.2, y: 1.4, w: 2.0, h: 0.55,
      fontSize: 13, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Calibri',
    });
  });

  // Lignes permissions
  perms.forEach((p, ri) => {
    s.addText(p.label, {
      x: 0.55, y: 2.1 + ri * 0.62, w: 2.35, h: 0.55,
      fontSize: 11, color: C.gray800, valign: 'middle', fontFace: 'Calibri',
    });
    p.vals.forEach((v, ci) => {
      const bg = ri % 2 === 0 ? C.white : C.gray100;
      s.addShape(pres.ShapeType.rect, {
        x: 3.0 + ci * 2.2, y: 2.1 + ri * 0.62, w: 2.0, h: 0.55,
        fill: { color: bg }, line: { color: C.gray200, width: 0.5 },
      });
      s.addText(v ? '✅' : '—', {
        x: 3.0 + ci * 2.2, y: 2.1 + ri * 0.62, w: 2.0, h: 0.55,
        fontSize: 14, align: 'center', valign: 'middle',
        color: v ? C.green : C.gray400,
      });
    });
  });

  // Badges sécurité
  const badges = [
    { icon: '🔐', text: 'JWT — Tokens sécurisés' },
    { icon: '👤', text: 'Activation manuelle des comptes' },
    { icon: '📋', text: 'Journal d\'audit complet' },
    { icon: '🏠', text: 'Données hébergées sur NAS IPM' },
  ];

  badges.forEach((b, i) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.55 + i * 2.95, y: 6.45, w: 2.65, h: 0.45,
      fill: { color: C.greenLight }, line: { color: C.green, width: 1 }, rectRadius: 0.08,
    });
    s.addText(b.icon + '  ' + b.text, {
      x: 0.65 + i * 2.95, y: 6.47, w: 2.5, h: 0.41,
      fontSize: 10, color: C.greenDark, valign: 'middle', fontFace: 'Calibri', bold: true,
    });
  });

  addSpeakerNotes(s, "La sécurité des données de recherche est non-négociable. Un nouveau compte créé est inactif par défaut — un administrateur doit l'activer manuellement. Chaque action dans l'application est enregistrée dans un journal d'audit : qui a modifié quoi, quand. Et surtout : toutes les données restent hébergées sur le serveur NAS d'Institut Pasteur Madagascar — rien ne part dans le cloud public.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Processus de développement
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.green);
  addFooter(s, 8);

  addTitle(s, 'Comment l\'application a été construite');
  addDivider(s, 1.1);

  // Timeline
  const steps = [
    { n: '01', label: 'Analyse des besoins', sub: 'Interviews terrain & chercheurs\nIdentification de chaque champ métier', color: C.green },
    { n: '02', label: 'Conception', sub: 'Schéma de données\nHiérarchie Projet → Spécimen', color: '0D9488' },
    { n: '03', label: 'Développement', sub: 'Application web complète\nTestée & validée en continu', color: C.amber },
    { n: '04', label: 'Déploiement', sub: 'Docker + Nginx\nServeur NAS IPM Synology', color: C.greenDark },
  ];

  steps.forEach((st, i) => {
    const x = 0.55 + i * 3.0;
    // Cercle
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.8, y: 1.5, w: 0.9, h: 0.9,
      fill: { color: st.color }, line: { color: st.color },
    });
    s.addText(st.n, { x: x + 0.8, y: 1.5, w: 0.9, h: 0.9, fontSize: 18, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Calibri' });
    // Ligne de connexion
    if (i < steps.length - 1) {
      s.addShape(pres.ShapeType.line, {
        x: x + 1.72, y: 1.95, w: 1.28, h: 0,
        line: { color: C.gray200, width: 2 },
      });
    }
    // Label
    s.addText(st.label, { x, y: 2.55, w: 2.5, h: 0.45, fontSize: 13, bold: true, color: C.dark, align: 'center', fontFace: 'Calibri' });
    // Sub
    s.addText(st.sub, { x, y: 3.05, w: 2.5, h: 1.0, fontSize: 10.5, color: C.gray600, align: 'center', fontFace: 'Calibri', lineSpacingMultiple: 1.3 });
  });

  // Stack technique
  s.addText('Stack technique', {
    x: 0.55, y: 4.3, w: 11, h: 0.4, fontSize: 13, bold: true, color: C.dark, fontFace: 'Calibri',
  });

  const stack = [
    { label: 'PostgreSQL', sub: 'Base de données' },
    { label: 'Express.js', sub: 'API REST' },
    { label: 'React 19', sub: 'Interface' },
    { label: 'Node.js', sub: 'Serveur' },
    { label: 'Prisma ORM', sub: 'Schéma & migrations' },
    { label: 'Docker + Nginx', sub: 'Déploiement' },
  ];

  stack.forEach((t, i) => {
    const x = 0.55 + (i % 4) * 2.9;
    const y = 4.8 + Math.floor(i / 4) * 0.85;
    const col = C.green;
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: 2.6, h: 0.65, fill: { color: C.white }, line: { color: col, width: 1.5 }, rectRadius: 0.08,
    });
    s.addText(t.label, { x, y, w: 2.6, h: 0.38, fontSize: 12, bold: true, color: col, align: 'center', valign: 'bottom', fontFace: 'Calibri' });
    s.addText(t.sub, { x, y: y + 0.33, w: 2.6, h: 0.32, fontSize: 9.5, color: C.gray600, align: 'center', valign: 'top', fontFace: 'Calibri' });
  });

  addSpeakerNotes(s, "L'application a été construite en suivant une approche rigoureuse : d'abord comprendre les besoins réels du terrain et des chercheurs, puis concevoir une architecture adaptée, développer et tester en continu, et enfin déployer sur le serveur IPM. Le résultat est une application stable, sécurisée et maintainable sur le long terme.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Bénéfices concrets
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.green);
  addFooter(s, 9);

  addTitle(s, 'Ce que ça change concrètement');
  addDivider(s, 1.1);

  const benefits = [
    { icon: '⏱️', kpi: '~45 sec', label: 'Saisie d\'un spécimen', desc: 'vs plusieurs minutes de retranscription papier → Excel' },
    { icon: '0️⃣', kpi: '0 erreur', label: 'Valeurs incorrectes', desc: 'Les codes statut sanguin, stade, parité sont imposés par l\'interface' },
    { icon: '1️⃣', kpi: '1 clic', label: 'Export prêt à analyser', desc: 'Fichier Excel structuré, aucun reformatage manuel nécessaire' },
    { icon: '🔍', kpi: '100 %', label: 'Traçabilité', desc: 'Audit log complet — chaque modification est horodatée et nominative' },
    { icon: '🏠', kpi: 'On-premise', label: 'Données sécurisées', desc: 'Hébergement sur NAS IPM — aucune donnée ne quitte l\'institution' },
  ];

  benefits.forEach((b, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 0.55 + col * 3.8;
    const y = 1.5 + row * 2.8;
    const w = 3.4;
    const h = 2.5;

    s.addShape(pres.ShapeType.roundRect, {
      x, y, w, h,
      fill: { color: C.white },
      line: { color: C.green, width: 1.5 },
      rectRadius: 0.15,
      shadow: { type: 'outer', color: '00000010', blur: 8, offset: 2, angle: 90 },
    });
    s.addText(b.icon, { x, y: y + 0.2, w, h: 0.55, fontSize: 26, align: 'center' });
    s.addText(b.kpi, { x, y: y + 0.8, w, h: 0.6, fontSize: 26, bold: true, color: C.green, align: 'center', fontFace: 'Calibri' });
    s.addText(b.label, { x, y: y + 1.4, w, h: 0.38, fontSize: 12, bold: true, color: C.dark, align: 'center', fontFace: 'Calibri' });
    s.addText(b.desc, { x: x + 0.15, y: y + 1.8, w: w - 0.3, h: 0.58, fontSize: 10, color: C.gray600, align: 'center', fontFace: 'Calibri', wrap: true });
  });

  addSpeakerNotes(s, "Concrètement : un agent de terrain saisit un moustique en 45 secondes avec les bonnes valeurs. Un chercheur exporte les données du mois en un clic, dans le bon format. Un administrateur sait exactement qui a touché quelle donnée. Et tout reste sur vos serveurs IPM — aucune donnée ne part dans le cloud public.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Prochaines étapes & conclusion
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  addBg(s, C.offWhite);
  addAccentBar(s, C.green);
  addFooter(s, 10);

  addTitle(s, 'Prochaines étapes — Vers une adoption complète');
  addDivider(s, 1.1);

  // Court terme
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.55, y: 1.4, w: 5.5, h: 3.8,
    fill: { color: C.greenLight }, line: { color: C.green, width: 1 }, rectRadius: 0.12,
  });
  s.addText('Court terme', {
    x: 0.75, y: 1.55, w: 5.1, h: 0.5,
    fontSize: 15, bold: true, color: C.greenDark, fontFace: 'Calibri',
  });
  const shortTerm = [
    '✅  Formation équipes terrain & chercheurs',
    '🔧  Déblocage accès externe (routeur IT)',
    '📂  Migration données historiques existantes',
    '🧪  Tests utilisateurs & retours terrain',
  ];
  shortTerm.forEach((t, i) => {
    s.addText(t, {
      x: 0.75, y: 2.15 + i * 0.72, w: 5.1, h: 0.62,
      fontSize: 12.5, color: C.greenDark, fontFace: 'Calibri', valign: 'middle',
    });
  });

  // Moyen terme
  s.addShape(pres.ShapeType.roundRect, {
    x: 6.4, y: 1.4, w: 5.1, h: 3.8,
    fill: { color: 'EFF6FF' }, line: { color: '3B82F6', width: 1 }, rectRadius: 0.12,
  });
  s.addText('Moyen terme', {
    x: 6.6, y: 1.55, w: 4.7, h: 0.5,
    fontSize: 15, bold: true, color: '1D4ED8', fontFace: 'Calibri',
  });
  const midTerm = [
    '📱  Application mobile terrain (hors-ligne)',
    '🔬  Intégration analyses bioinformatiques',
    '📊  Rapports automatisés (SIG, cartographie)',
    '🌍  Extension à d\'autres projets IPM',
  ];
  midTerm.forEach((t, i) => {
    s.addText(t, {
      x: 6.6, y: 2.15 + i * 0.72, w: 4.7, h: 0.62,
      fontSize: 12.5, color: '1E40AF', fontFace: 'Calibri', valign: 'middle',
    });
  });

  // Conclusion
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.55, y: 5.5, w: 11, h: 1.2,
    fill: { color: C.green }, line: { color: C.green }, rectRadius: 0.15,
  });
  s.addText('SpécimenManager est prêt.\nChaque jour sans lui, c\'est un risque de perte de données irremplaçables.', {
    x: 0.75, y: 5.55, w: 10.6, h: 1.1,
    fontSize: 15.5, bold: true, color: C.white, align: 'center', valign: 'middle',
    fontFace: 'Calibri', lineSpacingMultiple: 1.4,
  });

  addSpeakerNotes(s, "L'application est fonctionnelle et déployée. Les prochaines étapes dépendent de vous : former les équipes, débloquer l'accès réseau externe avec l'IT, et planifier la migration des données historiques. À moyen terme, une version mobile permettrait une saisie directement sur le terrain sans connexion. Je reste disponible pour toutes vos questions. Merci.");
}

// ── Sauvegarde ────────────────────────────────────────────────────────────────
const outPath = 'C:\\Users\\Andrianina\\Desktop\\SpecimenManager\\presentation\\SpécimenManager_Présentation.pptx';
pres.writeFile({ fileName: outPath })
  .then(() => console.log('✅  Fichier créé : ' + outPath))
  .catch(e => { console.error('❌  Erreur :', e.message); process.exit(1); });
