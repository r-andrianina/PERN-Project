'use strict';
// Manuel utilisateur — Saisie d'un specimen dans SpécimenManager
// Généré avec la bibliothèque `docx` (format .docx / Word)

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, VerticalAlign, ShadingType,
  PageBreak, Header, Footer,
  TableBorders, convertInchesToTwip,
} = require('docx');
const fs   = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '..', 'specimenmanager_manuel_saisie.docx');

// ── Couleurs ──────────────────────────────────────────────────────
const GREEN      = '1D9E75';
const GREEN_DK   = '166B50';
const GREEN_LT   = 'E8F8F2';
const BLUE       = '3B82F6';
const BLUE_LT    = 'EFF6FF';
const AMBER      = 'F59E0B';
const AMBER_LT   = 'FFFBEB';
const RED        = 'EF4444';
const RED_LT     = 'FEF2F2';
const PURPLE     = '8B5CF6';
const PURPLE_LT  = 'F5F3FF';
const GRAY50     = 'F9FAFB';
const GRAY100    = 'F3F4F6';
const GRAY200    = 'E5E7EB';
const GRAY600    = '4B5563';
const GRAY700    = '374151';
const GRAY900    = '111827';
const WHITE      = 'FFFFFF';
const BLACK      = '000000';

// ── Helpers typographiques ────────────────────────────────────────

const pt  = (n) => n * 2;          // demi-points (unité Word)
const twp = convertInchesToTwip;

function h1(text, color = GREEN) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: pt(14), after: pt(6) },
    children: [new TextRun({ text, color, bold: true, size: pt(16) })],
  });
}

function h2(text, color = GREEN_DK) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: pt(10), after: pt(4) },
    children: [new TextRun({ text, color, bold: true, size: pt(13) })],
  });
}

function h3(text, color = GRAY700) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: pt(8), after: pt(3) },
    children: [new TextRun({ text, color, bold: true, size: pt(11) })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: pt(2), after: pt(4) },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        size: pt(10.5),
        color: opts.color || GRAY700,
        bold: opts.bold || false,
        italics: opts.italic || false,
      }),
    ],
  });
}

function bullet(text, level = 0, color = GREEN) {
  return new Paragraph({
    bullet: { level },
    spacing: { before: pt(1), after: pt(2) },
    children: [
      new TextRun({ text, size: pt(10.5), color: GRAY700 }),
    ],
  });
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'steps', level },
    spacing: { before: pt(1), after: pt(2) },
    children: [new TextRun({ text, size: pt(10.5), color: GRAY700 })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function spacer(lines = 1) {
  return new Paragraph({
    spacing: { before: 0, after: pt(lines * 6) },
    children: [new TextRun({ text: '' })],
  });
}

function separator() {
  return new Paragraph({
    spacing: { before: pt(6), after: pt(6) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GRAY200 } },
    children: [new TextRun({ text: '' })],
  });
}

// ── Tableau simple (champs de formulaire) ─────────────────────────

function noBorder() {
  return {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };
}

function thinBorder(color = GRAY200) {
  const s = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: s, bottom: s, left: s, right: s, insideHorizontal: s, insideVertical: s };
}

function cellTxt(text, opts = {}) {
  return new TableCell({
    width:      opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading:    opts.bg ? { type: ShadingType.SOLID, color: opts.bg } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins:    { top: 60, bottom: 60, left: 100, right: 100 },
    borders:    opts.borders || noBorder(),
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            size:    pt(opts.size || 10),
            color:   opts.color || GRAY700,
            bold:    opts.bold || false,
            italics: opts.italic || false,
          }),
        ],
      }),
    ],
  });
}

function fieldTable(rows, bgColor = GRAY50) {
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        cellTxt('Champ', { width: 30, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
        cellTxt('Description', { width: 55, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
        cellTxt('Obligatoire', { width: 15, bg: GREEN, color: WHITE, bold: true, center: true, borders: thinBorder(GREEN) }),
      ],
    }),
    ...rows.map(([label, desc, req], i) =>
      new TableRow({
        children: [
          cellTxt(label, { width: 30, bg: i % 2 === 0 ? bgColor : WHITE, bold: true, color: GRAY900, borders: thinBorder() }),
          cellTxt(desc,  { width: 55, bg: i % 2 === 0 ? bgColor : WHITE, borders: thinBorder() }),
          cellTxt(req ? 'Oui' : 'Non', { width: 15, bg: i % 2 === 0 ? bgColor : WHITE, center: true, color: req ? RED : GRAY600, bold: req, borders: thinBorder() }),
        ],
      })
    ),
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder(),
    rows: tableRows,
  });
}

// ── Boite colorée (info / attention) ─────────────────────────────

function infoBox(text, opts = {}) {
  const bg    = opts.bg    || BLUE_LT;
  const color = opts.color || BLUE;
  const label = opts.label || 'Information';
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: bg },
            borders: {
              left: { style: BorderStyle.THICK, size: 16, color },
              top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
            margins: { top: 80, bottom: 80, left: 160, right: 120 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: pt(2) },
                children: [new TextRun({ text: label, bold: true, size: pt(10), color })],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text, size: pt(10), color: GRAY700 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Etape numerotée (mise en valeur) ─────────────────────────────

function stepTable(num, title, desc, color = GREEN) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            borders: noBorder(),
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(num), bold: true, size: pt(14), color: WHITE })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 92, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: GRAY50 },
            margins: { top: 60, bottom: 60, left: 140, right: 100 },
            borders: { left: { style: BorderStyle.THICK, size: 8, color }, top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
            children: [
              new Paragraph({
                spacing: { before: 0, after: pt(2) },
                children: [new TextRun({ text: title, bold: true, size: pt(11), color })],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: desc, size: pt(10), color: GRAY600 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Document ──────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'steps',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: twp(0.35), hanging: twp(0.25) } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: pt(10.5), color: GRAY700 },
        paragraph: { spacing: { after: pt(4) } },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1',
        basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { bold: true, size: pt(16), color: GREEN, font: 'Calibri' },
        paragraph: { spacing: { before: pt(14), after: pt(6) } },
      },
      {
        id: 'Heading2', name: 'Heading 2',
        basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { bold: true, size: pt(13), color: GREEN_DK, font: 'Calibri' },
        paragraph: { spacing: { before: pt(10), after: pt(4) } },
      },
      {
        id: 'Heading3', name: 'Heading 3',
        basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { bold: true, size: pt(11), color: GRAY700, font: 'Calibri' },
        paragraph: { spacing: { before: pt(8), after: pt(3) } },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: twp(1), bottom: twp(0.9), left: twp(1.1), right: twp(1.1) },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GRAY200 } },
              spacing: { after: pt(4) },
              children: [
                new TextRun({ text: 'SpécimenManager — Manuel de saisie des spécimens', size: pt(8.5), color: GRAY600 }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 6, color: GRAY200 } },
              spacing: { before: pt(4) },
              children: [
                new TextRun({ text: 'Institut Pasteur de Madagascar  •  SpécimenManager', size: pt(8), color: GRAY600 }),
              ],
            }),
          ],
        }),
      },
      children: [

        // ══════════════════════════════════════════════════════════
        //  PAGE DE GARDE
        // ══════════════════════════════════════════════════════════
        new Paragraph({
          spacing: { before: pt(40), after: pt(6) },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'SpécimenManager', bold: true, size: pt(32), color: GREEN })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: pt(8) },
          children: [new TextRun({ text: 'Institut Pasteur de Madagascar', size: pt(14), color: GRAY600 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: pt(10), after: pt(4) },
          children: [new TextRun({ text: 'Manuel de saisie des spécimens', bold: true, size: pt(22), color: GRAY900 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: pt(30) },
          children: [new TextRun({ text: 'Guide pas-à-pas pour l\'enregistrement des données entomologiques', size: pt(12), color: GRAY600, italics: true })],
        }),
        separator(),
        spacer(),

        // Sommaire textuel
        h2('Ce manuel couvre'),
        bullet('Connexion et rôles utilisateurs'),
        bullet('Compréhension de la hiérarchie des données'),
        bullet('Création d\'un Projet'),
        bullet('Création d\'une Mission'),
        bullet('Création d\'une Localité (avec géolocalisation GPS)'),
        bullet('Création d\'une Méthode de collecte'),
        bullet('Saisie d\'un spécimen (Moustique, Tique, Puce)'),
        bullet('Champs spécifiques par type de spécimen'),
        bullet('Utilisation de la boîte à tubes (PlaquePuits)'),
        bullet('Import Excel en lot'),
        bullet('Bonnes pratiques et conseils'),
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: pt(20), after: 0 },
          children: [new TextRun({ text: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), size: pt(9), color: GRAY600 })],
        }),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 1 — CONNEXION
        // ══════════════════════════════════════════════════════════
        h1('1.  Connexion à l\'application'),
        para('Ouvrez votre navigateur et accédez à l\'adresse fournie par votre administrateur (ex : http://192.168.x.x:8080 sur le réseau local de l\'Institut).'),
        spacer(0.5),
        h2('Procédure de connexion'),
        numbered('Entrez votre adresse email institutionnelle (ex : nom.prenom@pasteur.mg).'),
        numbered('Entrez votre mot de passe.'),
        numbered('Cliquez sur « Se connecter ».'),
        spacer(0.5),
        infoBox(
          'Votre compte doit être activé par un administrateur avant la première connexion. Si vous ne pouvez pas vous connecter, contactez votre responsable informatique.',
          { bg: BLUE_LT, color: BLUE, label: 'ℹ  Information' }
        ),
        spacer(),
        separator(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 2 — RÔLES
        // ══════════════════════════════════════════════════════════
        h1('2.  Les rôles utilisateurs'),
        para('Chaque utilisateur possède un rôle qui définit ce qu\'il peut voir et modifier dans l\'application.'),
        spacer(0.5),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: thinBorder(),
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                cellTxt('Rôle',         { width: 20, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
                cellTxt('Droits',       { width: 80, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
              ],
            }),
            ...[
              ['Admin',       'Accès total : utilisateurs, référentiels, toutes les données.'],
              ['Superviseur', 'Gestion des projets et membres. Peut créer/modifier des projets et ajouter des utilisateurs.'],
              ['Chercheur',   'Peut créer et modifier toutes les données scientifiques (projets, missions, spécimens).'],
              ['Technicien',  'Saisie des spécimens, méthodes de collecte et import Excel.'],
              ['Lecteur',     'Consultation uniquement. Aucune modification possible.'],
            ].map(([role, droits], i) =>
              new TableRow({
                children: [
                  cellTxt(role,   { width: 20, bg: i % 2 === 0 ? GRAY50 : WHITE, bold: true, color: GRAY900, borders: thinBorder() }),
                  cellTxt(droits, { width: 80, bg: i % 2 === 0 ? GRAY50 : WHITE, borders: thinBorder() }),
                ],
              })
            ),
          ],
        }),
        spacer(0.5),
        infoBox(
          'Pour saisir des spécimens, vous devez être au moins Technicien ET avoir les permissions pour le(s) type(s) de spécimen concerné(s) (moustique, tique, puce). Ces permissions sont attribuées par un administrateur.',
          { bg: AMBER_LT, color: AMBER, label: '⚠  Attention' }
        ),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 3 — HIÉRARCHIE
        // ══════════════════════════════════════════════════════════
        h1('3.  Comprendre la hiérarchie des données'),
        para('Avant de saisir un spécimen, toutes les entités parentes doivent exister. La hiérarchie est stricte :'),
        spacer(0.5),
        new Table({
          width: { size: 60, type: WidthType.PERCENTAGE },
          borders: noBorder(),
          rows: [
            ['PROJET',    'Ex : Surveillance arboviroses 2026',         GREEN],
            ['MISSION',   'Ex : ORD-2026-001',                          BLUE],
            ['LOCALITÉ',  'Ex : Fokontany Antananarivo-Renivohitra',    AMBER],
            ['MÉTHODE',   'Ex : CDC_1 (piégeage lumineux)',             PURPLE],
            ['SPÉCIMEN',  'Ex : Anopheles gambiae, Femelle, Adulte',    RED],
          ].map(([label, example, color]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.SOLID, color },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  borders: noBorder(),
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: label, bold: true, size: pt(11), color: WHITE })],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: example, size: pt(8.5), color: 'D1FAE5', italics: true })],
                    }),
                  ],
                }),
              ],
            })
          ),
        }),
        spacer(0.5),
        infoBox(
          'Règle fondamentale : un spécimen est toujours lié à une Méthode de collecte, jamais directement à une localité ou une mission.',
          { bg: RED_LT, color: RED, label: '⚠  Règle importante' }
        ),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 4 — PROJETS
        // ══════════════════════════════════════════════════════════
        h1('4.  Créer ou sélectionner un Projet'),
        para('Le projet est le contenant de plus haut niveau. Il regroupe plusieurs missions de terrain.'),
        spacer(0.5),
        h2('Étapes'),
        stepTable(1, 'Aller dans la section Projets', 'Dans le menu de gauche, cliquez sur « Projets ».', GREEN),
        spacer(0.3),
        stepTable(2, 'Créer un nouveau projet', 'Cliquez sur « Nouveau projet » (visible pour Chercheur, Superviseur et Admin).', GREEN),
        spacer(0.3),
        stepTable(3, 'Remplir les informations', 'Complétez les champs et cliquez sur « Enregistrer ».', GREEN),
        spacer(0.5),
        h2('Champs du formulaire Projet'),
        fieldTable([
          ['Code',          'Identifiant court unique (ex : SURV-ARB-2026)',      true],
          ['Nom',           'Nom complet du projet',                              true],
          ['Porteur',       'Organisme ou responsable scientifique',              false],
          ['Date début',    'Date de démarrage du projet',                        false],
          ['Date fin',      'Date de clôture prévue',                             false],
          ['Statut',        'Actif / Terminé / Suspendu',                        false],
          ['Description',   'Contexte et objectifs du projet',                    false],
        ], GREEN_LT),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 5 — MISSIONS
        // ══════════════════════════════════════════════════════════
        h1('5.  Créer une Mission'),
        para('Une mission correspond à une sortie terrain identifiée par un ordre de mission officiel.'),
        spacer(0.5),
        h2('Étapes'),
        stepTable(1, 'Aller dans Missions', 'Menu gauche → « Missions », puis « Nouvelle mission ».', BLUE),
        spacer(0.3),
        stepTable(2, 'Associer au projet', 'Sélectionnez le projet parent dans la liste déroulante.', BLUE),
        spacer(0.3),
        stepTable(3, 'Remplir les informations de mission', 'Numéro d\'ordre, dates, chef de mission, statut et agents de terrain.', BLUE),
        spacer(0.5),
        h2('Champs du formulaire Mission'),
        fieldTable([
          ['Ordre de mission', 'Référence officielle (ex : ORD-2026-001)',        true],
          ['Projet',           'Sélectionner le projet parent',                   true],
          ['Chef de mission',  'Nom de l\'encadrant scientifique',                false],
          ['Date début',       'Date de départ sur le terrain',                   true],
          ['Date fin',         'Date de retour (facultative)',                     false],
          ['Statut',           'Planifiée / En cours / Terminée / Annulée',       false],
          ['Objet',            'Description des objectifs de la sortie',           false],
          ['Agents terrain',   'Maximum 5 agents assignés à la mission',          false],
        ], BLUE_LT),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 6 — LOCALITÉS
        // ══════════════════════════════════════════════════════════
        h1('6.  Créer une Localité'),
        para('La localité est le site géographique précis où les spécimens ont été collectés.'),
        spacer(0.5),
        h2('Étapes'),
        stepTable(1, 'Accéder au détail de la mission', 'Dans la liste des missions, cliquez sur la mission concernée.', AMBER),
        spacer(0.3),
        stepTable(2, 'Ajouter une localité', 'Cliquez sur « Nouvelle localité » depuis le détail de la mission.', AMBER),
        spacer(0.3),
        stepTable(3, 'Définir la position GPS', 'Cliquez sur la carte pour positionner le site, ou entrez les coordonnées manuellement.', AMBER),
        spacer(0.5),
        h2('Champs du formulaire Localité'),
        fieldTable([
          ['Nom de la localité', 'Nom du site ou du village',                    true],
          ['Région',             'Région administrative',                          false],
          ['District',           'District administratif',                         false],
          ['Commune',            'Commune',                                        false],
          ['Fokontany',          'Fokontany (quartier)',                           false],
          ['Latitude',           'Coordonnée GPS (ex : -18.9137)',                false],
          ['Longitude',          'Coordonnée GPS (ex : 47.5361)',                 false],
        ], AMBER_LT),
        spacer(0.5),
        infoBox(
          'Astuce carte : cliquez directement sur la carte pour placer le marqueur. Les champs Région, District, Commune et Fokontany se remplissent automatiquement si la position est reconnue dans le shapefile Madagascar.',
          { bg: AMBER_LT, color: AMBER, label: '💡  Astuce' }
        ),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 7 — MÉTHODES
        // ══════════════════════════════════════════════════════════
        h1('7.  Créer une Méthode de collecte'),
        para('La méthode décrit le type de piégeage utilisé (CDC, BG-Sentinel, capture humaine…) et ses conditions d\'utilisation.'),
        spacer(0.5),
        h2('Étapes'),
        stepTable(1, 'Accéder depuis Méthodes ou depuis la Localité', 'Menu gauche → « Méthodes » ou depuis le détail d\'une localité.', PURPLE),
        spacer(0.3),
        stepTable(2, 'Sélectionner le type de méthode', 'Choisissez dans la liste : CDC-LT, BG-Sentinel, Aspiration, Capture humaine…', PURPLE),
        spacer(0.3),
        stepTable(3, 'Définir le numéro du dispositif', 'Chaque dispositif dans une localité a un numéro : CDC_1, CDC_2, BG_1, etc.', PURPLE),
        spacer(0.5),
        h2('Champs du formulaire Méthode'),
        fieldTable([
          ['Localité',              'Site parent auquel est rattachée la méthode',      true],
          ['Type de méthode',       'CDC-LT / BG-Sentinel / Aspirateur / Capture…',    true],
          ['Numéro',                'Numéro du dispositif dans cette localité (1, 2…)',  true],
          ['Type habitat',          'Péridomestique / Forestier / Rizicole…',           false],
          ['Type environnement',    'Urbain / Rural / Forestier…',                      false],
          ['Date de collecte',      'Date de pose/retrait du piège',                    false],
          ['Heure début',           'Heure de mise en place (ex : 18:00)',              false],
          ['Heure fin',             'Heure de levée (ex : 06:00)',                      false],
          ['Position GPS',          'Coordonnées du dispositif (optionnel)',             false],
          ['Notes',                 'Observations particulières sur la collecte',        false],
        ], PURPLE_LT),
        spacer(0.5),
        h2('Types de méthodes courants'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: thinBorder(),
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                cellTxt('Code',        { width: 18, bg: PURPLE, color: WHITE, bold: true, borders: thinBorder(PURPLE) }),
                cellTxt('Description', { width: 82, bg: PURPLE, color: WHITE, bold: true, borders: thinBorder(PURPLE) }),
              ],
            }),
            ...[
              ['CDC-LT',   'Piège lumineux CDC (CDC Light Trap) — attraction par lumière UV'],
              ['BG-SENT',  'Piège BG-Sentinel — attraction par CO₂ et phéromones'],
              ['HLC',      'Capture sur appât humain (Human Landing Catch)'],
              ['ASPIR',    'Aspiration à l\'aide d\'un aspirateur de type Prokopack'],
              ['REPO',     'Capture au repos dans les habitations'],
              ['LARV',     'Collecte de larves dans les gîtes larvaires'],
            ].map(([code, desc], i) =>
              new TableRow({
                children: [
                  cellTxt(code, { width: 18, bg: i % 2 === 0 ? PURPLE_LT : WHITE, bold: true, color: PURPLE, borders: thinBorder() }),
                  cellTxt(desc, { width: 82, bg: i % 2 === 0 ? PURPLE_LT : WHITE, borders: thinBorder() }),
                ],
              })
            ),
          ],
        }),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 8 — SAISIE SPÉCIMEN
        // ══════════════════════════════════════════════════════════
        h1('8.  Saisir un spécimen'),
        para('Une fois la méthode de collecte créée, vous pouvez saisir les spécimens collectés.'),
        spacer(0.5),
        h2('Étapes'),
        stepTable(1, 'Aller dans la section Spécimens', 'Menu gauche → choisissez le type : Moustiques, Tiques ou Puces.', RED),
        spacer(0.3),
        stepTable(2, 'Cliquer sur « Nouveau spécimen »', 'Le bouton est visible uniquement si vous avez la permission pour ce type.', RED),
        spacer(0.3),
        stepTable(3, 'Sélectionner la méthode parente', 'Choisissez la méthode de collecte à laquelle ce spécimen est associé.', RED),
        spacer(0.3),
        stepTable(4, 'Remplir les champs biologiques', 'Taxonomie, nombre, sexe, stade et tous les champs spécifiques au type.', RED),
        spacer(0.3),
        stepTable(5, 'Assigner une position de plaque', 'Si le spécimen est placé dans une boîte à tubes, sélectionnez la position.', RED),
        spacer(0.5),
        h2('Champs communs à tous les spécimens'),
        fieldTable([
          ['Méthode de collecte',   'Rattacher le spécimen à une méthode existante',    true],
          ['Taxonomie',             'Genre et espèce (ex : Anopheles gambiae)',           true],
          ['Nombre',                'Nombre d\'individus dans ce lot (défaut : 1)',       true],
          ['Sexe',                  'Mâle / Femelle / Inconnu',                          true],
          ['Stade',                 'Adulte / Larve L1–L4 / Nymphe / Œuf',              false],
          ['ID terrain',            'Code de terrain (ex : MQ-2026-001)',                false],
          ['Date de collecte',      'Date effective de la collecte',                     false],
          ['Solution conservation', 'Éthanol 70% / Congélation / Sec…',                 false],
          ['Notes',                 'Observations libres sur le spécimen',               false],
        ], RED_LT),
        spacer(0.5),
        infoBox(
          'Champ Taxonomie : saisissez les premières lettres du genre ou de l\'espèce — l\'autocomplétion propose les taxons disponibles dans le référentiel. Si l\'espèce est absente, contactez votre administrateur pour l\'ajouter.',
          { bg: GREEN_LT, color: GREEN, label: '💡  Astuce' }
        ),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 9 — CHAMPS SPÉCIFIQUES
        // ══════════════════════════════════════════════════════════
        h1('9.  Champs spécifiques par type de spécimen'),
        spacer(0.3),

        h2('Moustiques (Culicidae)'),
        fieldTable([
          ['Parité',         'Nullipare / Paucipare / Multipare (pour les femelles)',   false],
          ['Repas de sang',  'À jeun / Gorgée / Semi-gorgée / Digéré',                 false],
          ['Position plaque','Position dans la boîte à tubes (ex : A1, B3…)',           false],
        ], GREEN_LT),
        spacer(0.5),

        h2('Tiques (Ixodida)'),
        fieldTable([
          ['Gorgée',         'À jeun / Gorgée / Semi-gorgée',                          false],
          ['Hôte',           'Animal hôte sur lequel la tique a été prélevée',          false],
          ['Position plaque','Position dans la boîte à tubes (ex : A1, B3…)',           false],
        ], AMBER_LT),
        spacer(0.5),

        h2('Puces (Siphonaptera)'),
        fieldTable([
          ['Hôte',           'Animal hôte sur lequel la puce a été prélevée',           false],
          ['Position plaque','Position dans la boîte à tubes (ex : A1, B3…)',           false],
        ], PURPLE_LT),
        spacer(0.5),
        separator(),

        h1('10.  Boîte à tubes — PlaquePuits'),
        para('La boîte à tubes permet de localiser physiquement le spécimen dans une plaque de 96 puits (8 lignes A–H × 12 colonnes 1–12).'),
        spacer(0.5),
        h2('Comment utiliser la boîte à tubes'),
        numbered('Dans le formulaire de saisie, faites défiler jusqu\'à la section « Position dans la plaque ».'),
        numbered('La grille 8×12 apparaît. Les positions déjà occupées sont grisées.'),
        numbered('Cliquez sur une case libre pour l\'assigner au spécimen en cours de saisie.'),
        numbered('La position sélectionnée (ex : B3) s\'affiche dans le champ « Position plaque ».'),
        spacer(0.5),
        infoBox(
          'Chaque position (A1 à H12) est unique par méthode de collecte. Vous ne pouvez pas assigner deux spécimens à la même position au sein d\'une même méthode.',
          { bg: RED_LT, color: RED, label: '⚠  Règle importante' }
        ),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 11 — IMPORT EXCEL
        // ══════════════════════════════════════════════════════════
        h1('11.  Import Excel (lot de spécimens)'),
        para('Pour saisir un grand nombre de spécimens rapidement, utilisez l\'import par fichier Excel (.xlsx).'),
        spacer(0.5),
        h2('Étapes'),
        stepTable(1, 'Télécharger le modèle Excel', 'Allez dans « Import » (menu gauche) → cliquez « Télécharger le modèle .xlsx ».'),
        spacer(0.3),
        stepTable(2, 'Remplir le fichier', 'Ouvrez le modèle dans Excel. Respectez les colonnes et conservez la première ligne d\'en-tête.'),
        spacer(0.3),
        stepTable(3, 'Sélectionner la méthode cible', 'Dans l\'interface d\'import, choisissez la méthode de collecte destinataire.'),
        spacer(0.3),
        stepTable(4, 'Importer le fichier', 'Glissez-déposez ou cliquez pour sélectionner le fichier .xlsx, puis confirmez.'),
        spacer(0.5),
        h2('Structure du fichier Excel'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: thinBorder(),
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                cellTxt('Col', { width: 8,  bg: GREEN, color: WHITE, bold: true, center: true, borders: thinBorder(GREEN) }),
                cellTxt('Champ', { width: 24, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
                cellTxt('Exemple', { width: 40, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
                cellTxt('Obligatoire', { width: 18, bg: GREEN, color: WHITE, bold: true, center: true, borders: thinBorder(GREEN) }),
              ],
            }),
            ...[
              ['1',  'Genre',               'Anopheles',     true],
              ['2',  'Espèce',              'gambiae',        true],
              ['3',  'Nombre',              '1',              true],
              ['4',  'Sexe',               'F',              true],
              ['5',  'Stade',              'Adulte',         false],
              ['6',  'Parité',             'Nullipare',      false],
              ['7',  'Repas sang',         'A_jeun',         false],
              ['8',  'Date collecte',      '2026-06-15',     false],
              ['9',  'ID terrain',         'MQ-2026-001',    false],
              ['10', 'Notes',              'Piège CDC nord', false],
              ['11', 'Solution conserv.',  'Ethanol_70',     false],
            ].map(([col, champ, ex, req], i) =>
              new TableRow({
                children: [
                  cellTxt(col,   { width: 8,  bg: i % 2 === 0 ? GRAY50 : WHITE, bold: true, center: true, borders: thinBorder() }),
                  cellTxt(champ, { width: 24, bg: i % 2 === 0 ? GRAY50 : WHITE, bold: true, borders: thinBorder() }),
                  cellTxt(ex,    { width: 40, bg: i % 2 === 0 ? GRAY50 : WHITE, italic: true, borders: thinBorder() }),
                  cellTxt(req ? 'Oui' : 'Non', { width: 18, bg: i % 2 === 0 ? GRAY50 : WHITE, center: true, color: req ? RED : GRAY600, bold: req, borders: thinBorder() }),
                ],
              })
            ),
          ],
        }),
        spacer(0.5),
        infoBox(
          'La première ligne du fichier (en-têtes) est ignorée par le système. Ne modifiez pas l\'ordre des colonnes. Les valeurs de sexe acceptées sont : M, F, inconnu.',
          { bg: BLUE_LT, color: BLUE, label: 'ℹ  À savoir' }
        ),

        pageBreak(),

        // ══════════════════════════════════════════════════════════
        //  CHAPITRE 12 — BONNES PRATIQUES
        // ══════════════════════════════════════════════════════════
        h1('12.  Bonnes pratiques et conseils'),
        spacer(0.3),
        bullet('Vérifiez que la taxonomie utilisée (genre + espèce) existe dans le référentiel avant d\'importer un fichier Excel.'),
        bullet('Si une ligne est invalide lors de l\'import, les autres lignes valides sont quand même importées.'),
        bullet('Utilisez l\'Explorateur (menu « Recherche ») pour vérifier rapidement les spécimens saisis et exporter vers Excel.'),
        bullet('En cas d\'erreur de saisie, utilisez le bouton de modification depuis le détail du spécimen.'),
        bullet('L\'export Excel depuis l\'Explorateur contient la localisation complète (région, district, commune, fokontany).'),
        bullet('Signalez tout problème à votre administrateur en mentionnant le message d\'erreur exact affiché.'),
        spacer(),
        separator(),

        h2('Récapitulatif de la hiérarchie'),
        para('À retenir avant chaque saisie :'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: thinBorder(),
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                cellTxt('Niveau',   { width: 20, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
                cellTxt('Créer dans',{ width: 35, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
                cellTxt('Obligatoire pour',{ width: 45, bg: GREEN, color: WHITE, bold: true, borders: thinBorder(GREEN) }),
              ],
            }),
            ...[
              ['Projet',    'Menu Projets',     'Contenir des missions'],
              ['Mission',   'Menu Missions',    'Contenir des localités'],
              ['Localité',  'Détail Mission',   'Contenir des méthodes'],
              ['Méthode',   'Menu Méthodes',    'Rattacher les spécimens'],
              ['Spécimen',  'Menu Moustiques / Tiques / Puces', 'Enregistrement final'],
            ].map(([niv, where, why], i) =>
              new TableRow({
                children: [
                  cellTxt(niv,   { width: 20, bg: i % 2 === 0 ? GRAY50 : WHITE, bold: true, color: GREEN, borders: thinBorder() }),
                  cellTxt(where, { width: 35, bg: i % 2 === 0 ? GRAY50 : WHITE, borders: thinBorder() }),
                  cellTxt(why,   { width: 45, bg: i % 2 === 0 ? GRAY50 : WHITE, borders: thinBorder() }),
                ],
              })
            ),
          ],
        }),
        spacer(),
        infoBox(
          'Besoin d\'aide ? Contactez votre administrateur système ou le référent informatique de l\'Institut Pasteur de Madagascar.',
          { bg: GREEN_LT, color: GREEN, label: '📞  Contact' }
        ),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT, buffer);
  console.log('Manuel Word généré :', OUT);
});
