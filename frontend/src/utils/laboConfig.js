// Présentation des manipulations de laboratoire : libellé, icône et couleur
// par type, et par statut de résultat.
//
// Ces tables étaient recopiées dans LaboPage et ManipulationDetail, et avaient
// déjà divergé — la page de détail y avait ajouté une couleur de fond et deux
// libellés plus longs. Avec l'ajout de l'historique d'analyses sur les fiches
// spécimens (AnalysesLabo), il y aurait eu une TROISIÈME copie.
//
// La variation de la page de détail est légitime : un tableau compact et une
// fiche plein écran n'ont pas les mêmes besoins. Elle est donc absorbée ici
// (la couleur de fond fait partie de la table commune, les deux libellés longs
// s'obtiennent par `surcharges`) plutôt que d'être une raison de dupliquer.

import {
  Eye, Layers, TestTube, Dna, Zap, Activity, GitBranch, Waves, Microscope,
  FlaskConical, FileEdit, ShieldCheck, ShieldAlert,
} from 'lucide-react';

// Partie structurelle, indépendante de la langue : elle ne doit jamais diverger
// d'une page à l'autre, sinon le même type de manipulation change d'icône selon
// l'écran où on le regarde.
const TYPES = {
  identification_morpho: { cle: 'laboPage.typeMorpho',       Icon: Eye,          color: 'text-fg-muted', bg: 'bg-surface-2'  },
  broyage_pool:          { cle: 'laboPage.typeBroyage',      Icon: Layers,       color: 'text-info',     bg: 'bg-info/10'    },
  dessication:           { cle: 'laboPage.typeDessication',  Icon: TestTube,     color: 'text-info',     bg: 'bg-info/10'    },
  extraction:            { cle: 'laboPage.typeExtraction',   Icon: Dna,          color: 'text-success',  bg: 'bg-success/10' },
  amplification_pcr:     { cle: 'laboPage.typePcr',          Icon: Zap,          color: 'text-warning',  bg: 'bg-warning/10' },
  qpcr:                  { cle: 'laboPage.typeQpcr',         Icon: Activity,     color: 'text-primary',  bg: 'bg-primary/10' },
  nested_pcr:            { cle: 'laboPage.typeNestedPcr',    Icon: GitBranch,    color: 'text-warning',  bg: 'bg-warning/10' },
  sequencage:            { cle: 'laboPage.typeSequencage',   Icon: Waves,        color: 'text-primary',  bg: 'bg-primary/10' },
  microscopie:           { cle: 'laboPage.typeMicroscopie',  Icon: Microscope,   color: 'text-danger',   bg: 'bg-danger/10'  },
  autre:                 { cle: 'laboPage.typeAutre',        Icon: FlaskConical, color: 'text-fg-muted', bg: 'bg-surface-2'  },
};

const STATUTS = {
  brut:     { cle: 'laboPage.statutBrut',     tone: 'default', Icon: FileEdit    },
  valide:   { cle: 'laboPage.statutValide',   tone: 'success', Icon: ShieldCheck },
  invalide: { cle: 'laboPage.statutInvalide', tone: 'danger',  Icon: ShieldAlert },
};

/**
 * Table des types de manipulation, libellés résolus dans la langue courante.
 *
 * @param {Function} t          la fonction de `useT()`
 * @param {object}   surcharges clés i18n à substituer, par type — utilisé par
 *   la page de détail, qui veut des libellés plus explicites que le tableau.
 */
export function getTypeConfig(t, surcharges = {}) {
  return Object.fromEntries(
    Object.entries(TYPES).map(([type, { cle, ...reste }]) => [
      type,
      { label: t(surcharges[type] ?? cle), ...reste },
    ]),
  );
}

/** Table des statuts de résultat, libellés résolus dans la langue courante. */
export function getStatutConfig(t) {
  return Object.fromEntries(
    Object.entries(STATUTS).map(([statut, { cle, ...reste }]) => [
      statut,
      { label: t(cle), ...reste },
    ]),
  );
}
