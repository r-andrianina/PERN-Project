/* eslint-disable react-refresh/only-export-components -- ce fichier exporte aussi la constante MODULES ; faux positif HMR (cf. router/index.jsx) */
import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, FlaskConical, Search, Plus, Calendar, Info,
  Microscope, TestTube, Dna, Zap, Waves, GitBranch, Layers, Eye, Bug,
  ArrowRight, Timer, AlertTriangle,
} from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import { Select, DatePicker } from '../../components/ui';

const pad2 = (n) => String(n).padStart(2, '0');
const HOURS   = Array.from({ length: 24 }, (_, i) => ({ value: pad2(i), label: pad2(i) }));
const MINUTES = Array.from({ length: 12 }, (_, i) => ({ value: pad2(i * 5), label: pad2(i * 5) }));

// ── Configuration des modules ─────────────────────────────────

export const MODULES = [
  { value: 'identification_morpho', label: 'Identification morpho.',  Icon: Eye,          color: 'text-fg-muted', bg: 'bg-surface-2',  desc: 'Clé dichotomique, parité, gorgement' },
  { value: 'broyage_pool',          label: 'Broyage / Pool',          Icon: Layers,       color: 'text-info',     bg: 'bg-info/10',    desc: "Constitution d'un pool de spécimens" },
  { value: 'dessication',           label: 'Dessication',             Icon: TestTube,     color: 'text-info',     bg: 'bg-info/10',    desc: 'Conservation à sec' },
  { value: 'extraction',            label: 'Extraction ADN/ARN',      Icon: Dna,          color: 'text-success',  bg: 'bg-success/10', desc: 'Extraction et contrôle qualité' },
  { value: 'amplification_pcr',     label: 'PCR Standard',            Icon: Zap,          color: 'text-warning',  bg: 'bg-warning/10', desc: "Détection qualitative, gel d'électrophorèse" },
  { value: 'qpcr',                  label: 'qPCR / RT-qPCR',          Icon: FlaskConical, color: 'text-primary',  bg: 'bg-primary/10', desc: 'Quantitatif, valeur Ct' },
  { value: 'nested_pcr',            label: 'PCR Nichée (Nested)',      Icon: GitBranch,    color: 'text-warning',  bg: 'bg-warning/10', desc: "2 rounds d'amplification, sensibilité max" },
  { value: 'sequencage',            label: 'Séquençage',              Icon: Waves,        color: 'text-primary',  bg: 'bg-primary/10', desc: 'Sanger / NGS + BLAST' },
  { value: 'microscopie',           label: 'Microscopie',             Icon: Microscope,   color: 'text-danger',   bg: 'bg-danger/10',  desc: 'Glandes salivaires, frottis, oocystes' },
];

// ── Options de formulaire ─────────────────────────────────────

const SPECIMEN_ENDPOINTS = { moustique: 'moustiques', tique: 'tiques', puce: 'puces', autre: 'autres-specimens' };
const SPECIMEN_TYPE_OPTIONS = [
  { value: 'moustique', label: 'Moustique' }, { value: 'tique', label: 'Tique' },
  { value: 'puce', label: 'Puce' }, { value: 'autre', label: 'Autre spécimen' },
];
const NIVEAU_CONFIANCE_OPTIONS = [
  { value: 'certain', label: 'Certain' }, { value: 'probable', label: 'Probable' }, { value: 'douteux', label: 'Douteux' },
];
const TYPE_BROYAGE_OPTIONS = [
  { value: 'tissuelyser', label: 'TissueLyser' }, { value: 'pilon_mortier', label: 'Pilon et mortier' },
  { value: 'billes_verre', label: 'Billes de verre' }, { value: 'sonication', label: 'Sonication' }, { value: 'manuel', label: 'Manuel' },
];
const TEMP_STOCKAGE_OPTIONS = [
  { value: '-80°C', label: '-80°C (congélateur profond)' }, { value: '-20°C', label: '-20°C' },
  { value: '+4°C', label: '+4°C (réfrigérateur)' }, { value: 'TA', label: 'Température ambiante' },
];
const TYPE_AN_OPTIONS = [
  { value: 'adn', label: 'ADN génomique' }, { value: 'arn', label: 'ARN total' }, { value: 'adn_arn', label: 'ADN + ARN' },
];
const METHODE_EXTRACT_OPTIONS = [
  { value: 'destructive', label: 'Destructive (corps entier)' }, { value: 'non_destructive', label: 'Non-destructive' },
];
const STATUT_BANDE_OPTIONS = [
  { value: 'positif', label: 'Positif ✓' }, { value: 'negatif', label: 'Négatif ✗' }, { value: 'inconclusif', label: 'Inconclusif ?' },
];
const METHODE_SEQ_OPTIONS = [
  { value: 'sanger', label: 'Sanger (Capillaire)' }, { value: 'ngs_illumina', label: 'NGS Illumina' }, { value: 'oxford_nanopore', label: 'Oxford Nanopore' },
];
const TYPE_EXAMEN_OPTIONS = [
  { value: 'glandes_salivaires', label: 'Glandes salivaires' }, { value: 'frottis_sanguin', label: 'Frottis sanguin' },
  { value: 'estomac_moustique', label: 'Estomac moustique (oocystes)' }, { value: 'ovaires', label: 'Ovaires (parité)' },
  { value: 'corps_entier', label: 'Corps entier' },
];
const GROSSISSEMENT_OPTIONS = [
  { value: '10x', label: '10×' }, { value: '40x', label: '40×' }, { value: '100x', label: '100× (immersion huile)' },
];
const WELLS = [];
for (const r of 'ABCDEFGH') for (let c = 1; c <= 12; c++) WELLS.push({ value: `${r}${c}`, label: `${r}${c}` });

// ── Composants partagés ───────────────────────────────────────

function SectionTitle({ icon: Icon, iconClass = 'text-primary', children, sub }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-current/10 ${iconClass}`}>
        <Icon size={15} />
      </div>
      <div>
        <h2 className="text-sm font-bold text-fg tracking-tight">{children}</h2>
        {sub && <p className="text-[11px] text-fg-subtle mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-0">
      <span className="text-[11px] text-fg-subtle">{label}</span>
      <span className="text-[11px] text-fg font-medium text-right">{children || '—'}</span>
    </div>
  );
}

function NoteInfo({ children }) {
  return (
    <div className="p-3 bg-info/5 border border-info/20 rounded-xl flex gap-2 text-xs text-fg-subtle">
      <Info size={13} className="text-info flex-shrink-0 mt-0.5" /><span>{children}</span>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <hr className="flex-1 border-border" />
      <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider px-1">{label}</span>
      <hr className="flex-1 border-border" />
    </div>
  );
}

// Champ date + heure — calendrier personnalisé (DatePicker) pour la date,
// deux menus déroulants bornés 00-23 / 00-55 (pas de 5 min) pour l'heure.
function DateTimeField({ label, value, onChange, required }) {
  const [datePart = '', timePart = ''] = (value || '').split('T');
  const [hh = '', mm = ''] = timePart.split(':');

  const emit = (nextDate, nextHh, nextMm) => {
    const d = nextDate !== undefined ? nextDate : datePart;
    const h = nextHh   !== undefined ? nextHh   : (hh || '00');
    const m = nextMm   !== undefined ? nextMm   : (mm || '00');
    onChange(d ? `${d}T${h}:${m}` : '');
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <div className="flex gap-2">
        <DatePicker value={datePart} onChange={(d) => emit(d, undefined, undefined)} wrapperClassName="flex-1" />
        <Select value={hh} onChange={(h) => emit(undefined, h, undefined)}
          options={HOURS} placeholder="Hh" searchable={false} wrapperClassName="w-[4.5rem]" />
        <Select value={mm} onChange={(m) => emit(undefined, undefined, m)}
          options={MINUTES} placeholder="Mm" searchable={false} wrapperClassName="w-[4.5rem]" />
      </div>
    </div>
  );
}

// Badge durée calculée entre début et fin
function DurationBadge({ start, end }) {
  if (!start || !end) return null;
  const diff = new Date(end) - new Date(start);
  if (isNaN(diff)) return null;
  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-danger/8 text-danger rounded-lg text-xs font-medium">
        <AlertTriangle size={11} />
        Date de fin antérieure au début
      </span>
    );
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const label = h > 0 ? `${h} h${m > 0 ? ` ${m} min` : ''}` : `${m} min`;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/8 text-primary rounded-lg text-xs font-medium">
      <Timer size={11} />
      Durée : {label}
    </span>
  );
}

function PathogeneSelect({ value, onChange, pathogenes }) {
  return (
    <FormField
      label="Pathogène ciblé" name="pathogeneCibleId" type="select"
      value={value} onChange={onChange}
      options={pathogenes.map((p) => ({ value: p.id, label: `${p.nom}${p.famille ? ` (${p.famille})` : ''}` }))}
      hint="optionnel — depuis le dictionnaire"
    />
  );
}

// ── Sous-formulaires des modules ──────────────────────────────

function ModuleIdentificationMorpho({ f, h }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Clé dichotomique utilisée" name="cleUtilisee" type="text" value={f.cleUtilisee} onChange={h} placeholder="ex: Gillies & de Meillon 1968, Brunhes et al. 1997…" />
        <FormField label="Espèce identifiée" name="especeIdentifiee" type="text" value={f.especeIdentifiee} onChange={h} placeholder="ex: Anopheles gambiae s.l." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-4 gap-4">
        <FormField label="Niveau de confiance" name="niveauConfiance" type="select" value={f.niveauConfiance} onChange={h} options={NIVEAU_CONFIANCE_OPTIONS} />
        <FormField label="Stade confirmé" name="stadeConfirme" type="text" value={f.stadeConfirme} onChange={h} placeholder="Adulte, Larve L4…" />
        <FormField label="Gorgement" name="gorgement" type="text" value={f.gorgement} onChange={h} placeholder="À jeun / Gorgée / Semi-gorgée" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Méthode de parité" name="pariteMethode" type="text" value={f.pariteMethode} onChange={h} placeholder="Christopher, Detinova…" />
        <FormField label="Résultat parité" name="pariteResultat" type="text" value={f.pariteResultat} onChange={h} placeholder="Pare / Nullipare" />
      </div>
      <FormField label="Parties prélevées" name="partiesPrelevees" type="text" value={f.partiesPrelevees} onChange={h} placeholder="ex: Tête+thorax séparés, corps entier, glandes salivaires…" hint="pour analyses ultérieures" />
    </div>
  );
}

function ModuleBroyagePool({ f, h }) {
  return (
    <div className="space-y-4">
      <NoteInfo>Le pool est constitué à partir des spécimens liés à cette manipulation. L'ID pool sera généré automatiquement.</NoteInfo>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Méthode de broyage" name="methodeBroyage" type="select" value={f.methodeBroyage} onChange={h} options={TYPE_BROYAGE_OPTIONS} />
        <FormField label="Tampon utilisé" name="tamponUtilise" type="text" value={f.tamponUtilise} onChange={h} placeholder="ex: PBS 1×, DMEM, TRIZOL…" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Volume tampon <span className="text-fg-subtle font-normal">(µL)</span></label>
          <input type="number" name="volumeTamponUl" step="0.1" min="0" value={f.volumeTamponUl} onChange={h} placeholder="ex: 500" className="input-base w-full text-sm" />
        </div>
        <FormField label="Paramètres broyeur" name="parametresBroyeur" type="text" value={f.parametresBroyeur} onChange={h} placeholder="ex: 30 Hz, 2×1 min" />
      </div>
      <Divider label="Résultat" />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Volume récupéré <span className="text-fg-subtle font-normal">(µL)</span></label>
          <input type="number" name="volumeRecupereUl" step="0.1" min="0" value={f.volumeRecupereUl} onChange={h} placeholder="ex: 450" className="input-base w-full text-sm" />
        </div>
        <FormField label="Aspect macroscopique" name="aspectMacro" type="text" value={f.aspectMacro} onChange={h} placeholder="Limpide / Trouble / Rosé…" />
      </div>
    </div>
  );
}

function ModuleDessication({ f, h }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Méthode" name="methode" type="text" value={f.methode} onChange={h} placeholder="ex: Silica gel, DESS, Lyophilisation…" />
        <FormField label="Température de stockage" name="temperatureStockage" type="select" value={f.temperatureStockage} onChange={h} options={TEMP_STOCKAGE_OPTIONS} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Durée dessication <span className="text-fg-subtle font-normal">(heures)</span></label>
          <input type="number" name="dureeDessicationH" step="0.5" min="0" value={f.dureeDessicationH} onChange={h} placeholder="ex: 48" className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Silica gel <span className="text-fg-subtle font-normal">(g)</span></label>
          <input type="number" name="quantiteSilicaGelG" step="0.1" min="0" value={f.quantiteSilicaGelG} onChange={h} placeholder="ex: 2" className="input-base w-full text-sm" />
        </div>
        <FormField label="Date de mise en conservation" name="dateMiseConservation" type="date" value={f.dateMiseConservation} onChange={h} />
      </div>
      <Divider label="Résultat" />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Partie du corps" name="partieCorps" type="text" value={f.partieCorps} onChange={h} placeholder="Corps entier / Tête+thorax / Abdomen…" />
        <FormField label="Statut du tissu" name="statutTissu" type="text" value={f.statutTissu} onChange={h} placeholder="Intègre / Dégradé / Fragmenté" />
        <FormField label="Emplacement de stockage" name="emplacementCode" type="text" value={f.emplacementCode} onChange={h} placeholder="ex: CONG-B2 / Tiroir A3 / Boîte 12" />
      </div>
    </div>
  );
}

function ModuleExtraction({ f, h }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Type d'acide nucléique" name="typeAcideNucleique" type="select" value={f.typeAcideNucleique} onChange={h} options={TYPE_AN_OPTIONS} />
        <FormField label="Kit d'extraction" name="typeKit" type="text" value={f.typeKit} onChange={h} placeholder="ex: DNeasy Blood & Tissue (Qiagen)" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Méthode" name="methodeExtraction" type="select" value={f.methodeExtraction} onChange={h} options={METHODE_EXTRACT_OPTIONS} />
        <FormField label="Homogénéisation" name="methodeHomogeneisation" type="select" value={f.methodeHomogeneisation} onChange={h} options={TYPE_BROYAGE_OPTIONS} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Quantité tissu <span className="text-fg-subtle font-normal">(mg)</span></label>
          <input type="number" name="quantiteTissuMg" step="0.01" min="0" value={f.quantiteTissuMg} onChange={h} placeholder="ex: 5" className="input-base w-full text-sm" />
        </div>
        <FormField label="N° de lot kit" name="numerotLot" type="text" value={f.numerotLot} onChange={h} placeholder="ex: LOT-2026-042" />
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Volume élution <span className="text-fg-subtle font-normal">(µL)</span></label>
          <input type="number" name="volumeElutionUl" step="1" min="0" value={f.volumeElutionUl} onChange={h} placeholder="ex: 100" className="input-base w-full text-sm" />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" name="controlExtraction" checked={f.controlExtraction === true || f.controlExtraction === 'true'} onChange={(e) => h({ target: { name: 'controlExtraction', value: e.target.checked } })} className="rounded" />
        <span className="text-xs text-fg">Témoin négatif d'extraction inclus (eau)</span>
      </label>
      <Divider label="Résultats contrôle qualité" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['concentrationAdn', 'Conc. ADN', 'ng/µL', 'ex: 12.5'], ['pureteA260A280', 'A260/A280', '', 'ex: 1.82'], ['pureteA260A230', 'A260/A230', '', 'ex: 2.10'], ['volumeFinalUl', 'Volume final', 'µL', 'ex: 50']].map(([name, label, unit, ph]) => (
          <div key={name}>
            <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{label}{unit && <span className="font-normal text-fg-subtle"> ({unit})</span>}</label>
            <input type="number" name={name} step="0.001" min="0" value={f[name]} onChange={h} placeholder={ph} className="input-base w-full text-sm" />
          </div>
        ))}
      </div>
      <FormField label="ID tube ADN/ARN" name="idTubeAdn" type="text" value={f.idTubeAdn} onChange={h} placeholder="ex: ADN-2026-0104" hint="identifiant unique du tube" />
    </div>
  );
}

function ModulePcr({ f, h, pathogenes }) {
  return (
    <div className="space-y-4">
      <PathogeneSelect value={f.pathogeneCibleId} onChange={h} pathogenes={pathogenes} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Gène cible" name="geneCible" type="text" value={f.geneCible} onChange={h} placeholder="ex: COI, ITS2, 18S, CSP…" />
        <FormField label="ID Plaque PCR" name="idPlaquePcr" type="text" value={f.idPlaquePcr} onChange={h} placeholder="ex: PCR-PL-0023" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Amorce Forward (5'→3')" name="amorceForward" type="text" value={f.amorceForward} onChange={h} placeholder="Séquence ou code…" />
        <FormField label="Amorce Reverse (5'→3')" name="amorceReverse" type="text" value={f.amorceReverse} onChange={h} placeholder="Séquence ou code…" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <FormField label="Enzyme / Master Mix" name="enzyme" type="text" value={f.enzyme} onChange={h} placeholder="ex: HotStar Taq, GoTaq Green…" />
        <FormField label="Programme thermocycleur" name="programmeThermo" type="text" value={f.programmeThermo} onChange={h} placeholder="ex: 95°C/5min – 35×(95/58/72°C) – 72°C/7min" />
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Taille attendue <span className="text-fg-subtle font-normal">(pb)</span></label>
          <input type="number" name="tailleAttenduePb" step="1" min="0" value={f.tailleAttenduePb} onChange={h} placeholder="ex: 658" className="input-base w-full text-sm" />
        </div>
        <FormField label="Puits (A1–H12)" name="puitsPcr" type="select" value={f.puitsPcr} onChange={h} options={WELLS} />
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input type="checkbox" name="temoinPositif" checked={f.temoinPositif === true || f.temoinPositif === 'true'} onChange={(e) => h({ target: { name: 'temoinPositif', value: e.target.checked } })} className="rounded" />
          Témoin positif inclus
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input type="checkbox" name="temoinNegatif" checked={f.temoinNegatif === true || f.temoinNegatif === 'true'} onChange={(e) => h({ target: { name: 'temoinNegatif', value: e.target.checked } })} className="rounded" />
          Témoin négatif inclus
        </label>
      </div>
      <Divider label="Résultat gel" />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Statut bande gel" name="statutBandeGel" type="select" value={f.statutBandeGel} onChange={h} options={STATUT_BANDE_OPTIONS} />
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Taille bande observée <span className="text-fg-subtle font-normal">(pb)</span></label>
          <input type="number" name="tailleBandePb" step="1" min="0" value={f.tailleBandePb} onChange={h} placeholder="ex: 650" className="input-base w-full text-sm" />
        </div>
      </div>
    </div>
  );
}

function ModuleQpcr({ f, h, pathogenes }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Type de qPCR" name="typePcr" type="select" value={f.typePcr} onChange={h}
          options={[{ value: 'qPCR', label: 'qPCR (ADN)' }, { value: 'RT-qPCR', label: 'RT-qPCR (ARN)' }]} />
        <PathogeneSelect value={f.pathogeneCibleId} onChange={h} pathogenes={pathogenes} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Gène cible" name="geneCible" type="text" value={f.geneCible} onChange={h} placeholder="ex: NS5, CSP, E1…" />
        <FormField label="Gène de référence interne" name="geneReference" type="text" value={f.geneReference} onChange={h} placeholder="ex: RPS17, actin, GAPDH" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Amorce Forward" name="amorceForward" type="text" value={f.amorceForward} onChange={h} placeholder="Séquence…" />
        <FormField label="Amorce Reverse" name="amorceReverse" type="text" value={f.amorceReverse} onChange={h} placeholder="Séquence…" />
      </div>
      <FormField label="Sonde TaqMan" name="sondeTaqman" type="text" value={f.sondeTaqman} onChange={h} placeholder="Séquence de la sonde…" hint="optionnel (format SYBR Green si absent)" />
      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-4 gap-4">
        <FormField label="Master Mix" name="masterMix" type="text" value={f.masterMix} onChange={h} placeholder="ex: SsoAdvanced, TaqMan Fast" />
        <FormField label="ID Plaque qPCR" name="idPlaqueQpcr" type="text" value={f.idPlaqueQpcr} onChange={h} placeholder="ex: qPCR-PL-007" />
        <FormField label="Puits (A1–H12)" name="puitsQpcr" type="select" value={f.puitsQpcr} onChange={h} options={WELLS} />
      </div>
      <Divider label="Résultats quantitatifs" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['valeurCt', 'Ct spécimen', '', 'ex: 28.4'], ['ctTemoinPositif', 'Ct témoin +', '', 'ex: 22.1'], ['ctTemoinNegatif', 'Ct témoin −', '', 'ex: 0'], ['ctControleInterne', 'Ct contrôle int.', '', 'ex: 20.5']].map(([name, label,, ph]) => (
          <div key={name}>
            <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{label}</label>
            <input type="number" name={name} step="0.01" min="0" value={f[name]} onChange={h} placeholder={ph} className="input-base w-full text-sm" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Interprétation" name="interpretation" type="select" value={f.interpretation} onChange={h} options={STATUT_BANDE_OPTIONS} />
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Efficacité <span className="text-fg-subtle font-normal">(%)</span></label>
          <input type="number" name="efficacitePct" step="0.1" min="0" max="120" value={f.efficacitePct} onChange={h} placeholder="ex: 95" className="input-base w-full text-sm" />
        </div>
      </div>
    </div>
  );
}

function ModuleNestedPcr({ f, h, pathogenes }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <PathogeneSelect value={f.pathogeneCibleId} onChange={h} pathogenes={pathogenes} />
        <FormField label="Gène cible" name="geneCible" type="text" value={f.geneCible} onChange={h} placeholder="ex: COI, 18S…" />
      </div>
      <div className="flex gap-6 mb-1">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input type="checkbox" name="temoinPositif" checked={f.temoinPositif === true || f.temoinPositif === 'true'} onChange={(e) => h({ target: { name: 'temoinPositif', value: e.target.checked } })} className="rounded" />
          Témoin positif inclus
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input type="checkbox" name="temoinNegatif" checked={f.temoinNegatif === true || f.temoinNegatif === 'true'} onChange={(e) => h({ target: { name: 'temoinNegatif', value: e.target.checked } })} className="rounded" />
          Témoin négatif inclus
        </label>
      </div>
      <div className="rounded-xl border border-info/30 bg-info/5 p-4 space-y-3">
        <p className="text-xs font-bold text-info">Round 1 (amorces externes)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          <FormField label="Amorce F1" name="amorceF1" type="text" value={f.amorceF1} onChange={h} placeholder="ex: LCO1490…" />
          <FormField label="Amorce R1" name="amorceR1" type="text" value={f.amorceR1} onChange={h} placeholder="ex: HCO2198…" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Taille attendue (pb)</label>
            <input type="number" name="tailleAttendue1" step="1" min="0" value={f.tailleAttendue1} onChange={h} placeholder="ex: 710" className="input-base w-full text-sm" />
          </div>
          <FormField label="Résultat Round 1" name="statutBande1" type="select" value={f.statutBande1} onChange={h} options={STATUT_BANDE_OPTIONS} />
        </div>
      </div>
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
        <p className="text-xs font-bold text-warning">Round 2 (amorces internes)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          <FormField label="Amorce F2" name="amorceF2" type="text" value={f.amorceF2} onChange={h} placeholder="Amorce interne F…" />
          <FormField label="Amorce R2" name="amorceR2" type="text" value={f.amorceR2} onChange={h} placeholder="Amorce interne R…" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Taille attendue (pb)</label>
            <input type="number" name="tailleAttendue2" step="1" min="0" value={f.tailleAttendue2} onChange={h} placeholder="ex: 450" className="input-base w-full text-sm" />
          </div>
          <FormField label="Résultat Round 2" name="statutBande2" type="select" value={f.statutBande2} onChange={h} options={STATUT_BANDE_OPTIONS} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Résultat final" name="resultatFinal" type="select" value={f.resultatFinal} onChange={h} options={STATUT_BANDE_OPTIONS} />
        <FormField label="ID Plaque" name="idPlaque" type="text" value={f.idPlaque} onChange={h} placeholder="ex: NEST-PL-002" />
      </div>
    </div>
  );
}

function ModuleSequencage({ f, h }) {
  return (
    <div className="space-y-4">
      <NoteInfo>Les fichiers bruts (.ab1, .fastq) et la séquence consensus peuvent être ajoutés depuis la fiche de la manipulation après création.</NoteInfo>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Méthode de séquençage" name="methodeSequencage" type="select" value={f.methodeSequencage} onChange={h} options={METHODE_SEQ_OPTIONS} />
        <FormField label="Prestataire / Plateforme" name="prestataire" type="text" value={f.prestataire} onChange={h} placeholder="ex: Macrogen, Genewiz, MGH…" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="ID Plaque / Tube envoyé" name="idPlaqueTube" type="text" value={f.idPlaqueTube} onChange={h} placeholder="ex: SEQ-PL-0007" />
        <FormField label="Amorce de séquençage" name="amorceSequencage" type="text" value={f.amorceSequencage} onChange={h} placeholder="ex: M13F, T7, LCO1490…" />
      </div>
      <Divider label="Résultats BLAST" />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Organisme le plus proche" name="organismeBlast" type="text" value={f.organismeBlast} onChange={h} placeholder="ex: Anopheles gambiae s.s." />
        <FormField label="N° accession GenBank" name="accessionGenbank" type="text" value={f.accessionGenbank} onChange={h} placeholder="ex: MN123456" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Identité BLAST <span className="text-fg-subtle font-normal">(%)</span></label>
          <input type="number" name="identiteBlastPct" step="0.1" min="0" max="100" value={f.identiteBlastPct} onChange={h} placeholder="ex: 99.8" className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Couverture BLAST <span className="text-fg-subtle font-normal">(%)</span></label>
          <input type="number" name="couvertureBlastPct" step="0.1" min="0" max="100" value={f.couvertureBlastPct} onChange={h} placeholder="ex: 98.5" className="input-base w-full text-sm" />
        </div>
      </div>
    </div>
  );
}

function ModuleMicroscopie({ f, h }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-4 gap-4">
        <FormField label="Type d'examen" name="typeExamen" type="select" value={f.typeExamen} onChange={h} options={TYPE_EXAMEN_OPTIONS} />
        <FormField label="Coloration" name="coloration" type="text" value={f.coloration} onChange={h} placeholder="ex: Giemsa, May-Grünwald, non coloré" />
        <FormField label="Grossissement" name="grossissement" type="select" value={f.grossissement} onChange={h} options={GROSSISSEMENT_OPTIONS} />
      </div>
      <Divider label="Résultats" />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label="Résultat" name="resultat" type="select" value={f.resultat} onChange={h}
          options={[{ value: 'positif', label: 'Positif (parasites observés)' }, { value: 'negatif', label: 'Négatif' }, { value: 'inconclusif', label: 'Inconclusif' }]} />
        <FormField label="Stade observé" name="stadeObserve" type="text" value={f.stadeObserve} onChange={h} placeholder="ex: Sporozoïtes, Oocystes, Trophozoïtes…" />
      </div>
      <FormField label="Densité parasitaire" name="densiteParasitaire" type="text" value={f.densiteParasitaire} onChange={h} placeholder="ex: 3 sporozoïtes / glande, 500 parasites/µL…" />
      <div>
        <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">Observations <span className="text-fg-subtle font-normal">(optionnel)</span></label>
        <textarea name="observations" value={f.observations} onChange={h} rows={2} placeholder="Notes libres…" className="input-base w-full text-sm resize-none" />
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────

export default function NouvelleManipulation() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [specimenType,    setSpecimenType]    = useState(searchParams.get('specimenType') || '');
  const [specimenId,      setSpecimenId]      = useState(searchParams.get('specimenId') || '');
  const [specimenLabel,   setSpecimenLabel]   = useState(searchParams.get('specimenId') ? `#${searchParams.get('specimenId')}` : '');
  const [specimenSearch,  setSpecimenSearch]  = useState('');
  const [specimenOptions, setSpecimenOptions] = useState([]);
  const [searching,       setSearching]       = useState(false);

  const [moduleType, setModuleType] = useState('');
  const [protocole,  setProtocole]  = useState('');
  const [dateDebut,  setDateDebut]  = useState(new Date().toISOString().slice(0, 16));
  const [dateFin,    setDateFin]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [pathogenes, setPathogenes] = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [errors,     setErrors]     = useState({});

  const [moduleForm, setModuleForm] = useState({
    // morpho
    cleUtilisee: '', especeIdentifiee: '', niveauConfiance: '', stadeConfirme: '', gorgement: '', pariteMethode: '', pariteResultat: '', partiesPrelevees: '', observations: '',
    // broyage
    methodeBroyage: '', tamponUtilise: '', volumeTamponUl: '', parametresBroyeur: '', volumeRecupereUl: '', aspectMacro: '',
    // dessication
    methode: '', temperatureStockage: '', dureeDessicationH: '', quantiteSilicaGelG: '', dateMiseConservation: '', partieCorps: '', statutTissu: '', emplacementCode: '',
    // extraction
    typeAcideNucleique: '', typeKit: '', methodeExtraction: '', methodeHomogeneisation: '', quantiteTissuMg: '', numerotLot: '', volumeElutionUl: '', controlExtraction: false,
    concentrationAdn: '', pureteA260A280: '', pureteA260A230: '', volumeFinalUl: '', idTubeAdn: '',
    // pcr
    pathogeneCibleId: '', geneCible: '', amorceForward: '', amorceReverse: '', enzyme: '', programmeThermo: '', tailleAttenduePb: '', idPlaquePcr: '', puitsPcr: '',
    temoinPositif: false, temoinNegatif: false, statutBandeGel: '', tailleBandePb: '',
    // qpcr
    typePcr: '', sondeTaqman: '', geneReference: '', masterMix: '', volumeReactionUl: '', idPlaqueQpcr: '', puitsQpcr: '',
    valeurCt: '', ctTemoinPositif: '', ctTemoinNegatif: '', ctControleInterne: '', efficacitePct: '', interpretation: '', chargeVirale: '',
    // nested
    amorceF1: '', amorceR1: '', tailleAttendue1: '', statutBande1: '', amorceF2: '', amorceR2: '', tailleAttendue2: '', statutBande2: '',
    resultatFinal: '', tailleBandeObsPb: '', idPlaque: '',
    // sequencage
    methodeSequencage: '', prestataire: '', idPlaqueTube: '', amorceSequencage: '',
    organismeBlast: '', identiteBlastPct: '', couvertureBlastPct: '', accessionGenbank: '',
    // microscopie
    typeExamen: '', coloration: '', grossissement: '', resultat: '', stadeObserve: '', densiteParasitaire: '',
  });

  useEffect(() => {
    api.get('/dictionnaire/pathogenes-cibles', { params: { actif: 'true', limit: 100 } })
      .then((r) => setPathogenes(r.data.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!specimenType || !specimenSearch.trim()) { setSpecimenOptions([]); return; }
    const endpoint = SPECIMEN_ENDPOINTS[specimenType];
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get(`/${endpoint}`, { params: { search: specimenSearch, limit: 20 } });
        const items = r.data.specimens ?? r.data.moustiques ?? r.data.tiques ?? r.data.puces ?? [];
        setSpecimenOptions(items.map((s) => ({
          value: s.id,
          label: [s.idTerrain || `#${s.id}`, s.typeSpecimen?.nom, s.taxonomie?.nom].filter(Boolean).join(' — '),
        })));
      } catch { setSpecimenOptions([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [specimenType, specimenSearch]);

  const handleModuleChange = (e) => {
    const { name, value } = e.target;
    setModuleForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!specimenType && !specimenId) errs.specimenType = 'Choisissez un type de spécimen';
    if (!specimenId) errs.specimenId = 'Sélectionnez un spécimen';
    if (!moduleType) errs.moduleType = 'Choisissez un module';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setIsLoading(true);
    try {
      const num = (v) => (v !== '' && v != null ? parseFloat(v) : null);
      const payload = {
        specimenType,
        specimenId:  parseInt(specimenId),
        typeManipulation: moduleType,
        protocole:   protocole || null,
        dateDebut:   new Date(dateDebut).toISOString(),
        dateFin:     dateFin ? new Date(dateFin).toISOString() : null,
        notes:       notes || null,
        ...moduleForm,
        concentrationAdn:   num(moduleForm.concentrationAdn),
        pureteA260A280:     num(moduleForm.pureteA260A280),
        pureteA260A230:     num(moduleForm.pureteA260A230),
        volumeFinalUl:      num(moduleForm.volumeFinalUl),
        quantiteTissuMg:    num(moduleForm.quantiteTissuMg),
        volumeElutionUl:    num(moduleForm.volumeElutionUl),
        dureeDessicationH:  num(moduleForm.dureeDessicationH),
        quantiteSilicaGelG: num(moduleForm.quantiteSilicaGelG),
        volumeTamponUl:     num(moduleForm.volumeTamponUl),
        volumeRecupereUl:   num(moduleForm.volumeRecupereUl),
        volumeReactionUl:   num(moduleForm.volumeReactionUl),
        valeurCt:           num(moduleForm.valeurCt),
        ctTemoinPositif:    num(moduleForm.ctTemoinPositif),
        ctTemoinNegatif:    num(moduleForm.ctTemoinNegatif),
        ctControleInterne:  num(moduleForm.ctControleInterne),
        efficacitePct:      num(moduleForm.efficacitePct),
        chargeVirale:       num(moduleForm.chargeVirale),
        identiteBlastPct:   num(moduleForm.identiteBlastPct),
        couvertureBlastPct: num(moduleForm.couvertureBlastPct),
        tailleAttenduePb:   moduleForm.tailleAttenduePb  ? parseInt(moduleForm.tailleAttenduePb)  : null,
        tailleBandePb:      moduleForm.tailleBandePb     ? parseInt(moduleForm.tailleBandePb)     : null,
        tailleAttendue1:    moduleForm.tailleAttendue1   ? parseInt(moduleForm.tailleAttendue1)   : null,
        tailleAttendue2:    moduleForm.tailleAttendue2   ? parseInt(moduleForm.tailleAttendue2)   : null,
        pathogeneCibleId:   moduleForm.pathogeneCibleId  ? parseInt(moduleForm.pathogeneCibleId)  : null,
        methodeExtraction:      moduleForm.methodeExtraction      || null,
        methodeHomogeneisation: moduleForm.methodeHomogeneisation || null,
        typeAcideNucleique:     moduleForm.typeAcideNucleique     || null,
        methodeBroyage:         moduleForm.methodeBroyage         || null,
        niveauConfiance:        moduleForm.niveauConfiance        || null,
        statutBandeGel:         moduleForm.statutBandeGel         || null,
        interpretation:         moduleForm.interpretation         || null,
        statutBande1:           moduleForm.statutBande1           || null,
        statutBande2:           moduleForm.statutBande2           || null,
        resultatFinal:          moduleForm.resultatFinal          || null,
        methodeSequencage:      moduleForm.methodeSequencage      || null,
        typeExamen:             moduleForm.typeExamen             || null,
        grossissement:          moduleForm.grossissement          || null,
        resultat:               moduleForm.resultat               || null,
        dateMiseConservation:   moduleForm.dateMiseConservation   || null,
        temperatureStockage:    moduleForm.temperatureStockage    || null,
        typePcr:                moduleForm.typePcr                || null,
        puitsPcr:               moduleForm.puitsPcr               || null,
        puitsQpcr:              moduleForm.puitsQpcr              || null,
      };
      const r = await api.post('/labo', payload);
      navigate(`/labo/${r.data.manipulation.id}`);
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedModule = MODULES.find((m) => m.value === moduleType);

  return (
    <div className="max-w-screen-2xl space-y-4">
      <Link to="/labo" className="inline-flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg transition-colors group">
        <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Laboratoire
      </Link>

      <div className="flex items-center gap-3 pb-1">
        <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
          <FlaskConical size={17} className="text-warning" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-fg">Nouvelle manipulation</h1>
          <p className="text-xs text-fg-subtle">9 modules disponibles — Morphologie · Biologie moléculaire · Microscopie</p>
        </div>
      </div>

      {errors.submit && (
        <div className="p-3.5 bg-danger/8 border border-danger/25 rounded-xl text-sm text-danger flex items-center gap-2">
          <span className="font-semibold">Erreur :</span> {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_380px] gap-5 2xl:gap-8 items-start">
          <div className="space-y-4">

            {/* 1. Spécimen */}
            <div className="card p-6">
              <SectionTitle icon={Bug} iconClass="text-primary" sub="Spécimen individuel à traiter">
                Spécimen cible
              </SectionTitle>
              <div className="space-y-4">
                <FormField label="Type de spécimen" name="specimenType" type="select"
                  value={specimenType}
                  onChange={(e) => { setSpecimenType(e.target.value); setSpecimenId(''); setSpecimenLabel(''); setSpecimenOptions([]); setErrors((p) => ({ ...p, specimenType: null })); }}
                  options={SPECIMEN_TYPE_OPTIONS} required error={errors.specimenType} />

                {specimenType && (
                  <div>
                    <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">
                      Spécimen <span className="text-danger">*</span>
                    </label>
                    {specimenId && !specimenSearch ? (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-success/40 bg-success/5">
                        <span className="text-sm text-fg font-medium truncate">{specimenLabel}</span>
                        <button type="button" onClick={() => { setSpecimenId(''); setSpecimenLabel(''); }}
                          className="text-xs text-fg-subtle hover:text-danger transition-colors flex-shrink-0">Changer</button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
                          <input type="text" placeholder="ID terrain, taxonomie…" value={specimenSearch}
                            onChange={(e) => setSpecimenSearch(e.target.value)}
                            className={`input-base pl-9 w-full text-sm ${errors.specimenId ? 'border-danger/50 bg-danger/5' : ''}`}
                            autoFocus={!!specimenType} />
                          {searching && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
                        </div>
                        {specimenOptions.length > 0 && (
                          <div className="mt-1 border border-border rounded-xl overflow-hidden shadow-card">
                            {specimenOptions.map((opt) => (
                              <button key={opt.value} type="button"
                                onClick={() => { setSpecimenId(opt.value); setSpecimenLabel(opt.label); setSpecimenSearch(''); setSpecimenOptions([]); setErrors((p) => ({ ...p, specimenId: null })); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-fg hover:bg-surface-2 transition-colors border-b border-border last:border-0">
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {specimenSearch && !searching && specimenOptions.length === 0 && (
                          <p className="mt-1.5 text-xs text-fg-subtle text-center py-2">Aucun résultat</p>
                        )}
                      </>
                    )}
                    {errors.specimenId && <p className="mt-1.5 text-xs text-danger">{errors.specimenId}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Choix du module */}
            <div className="card p-6">
              <SectionTitle icon={FlaskConical} iconClass="text-warning" sub="Sélectionnez le type de manipulation">
                Module / Protocole
              </SectionTitle>
              {errors.moduleType && <p className="text-xs text-danger mb-3">{errors.moduleType}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 2xl:gap-4">
                {MODULES.map(({ value, label, Icon, color, bg, desc }) => (
                  <button key={value} type="button"
                    onClick={() => { setModuleType(value); setErrors((p) => ({ ...p, moduleType: null })); }}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                      moduleType === value ? `border-current ${color} ${bg}` : 'border-border hover:border-border-hover bg-surface'
                    }`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <Icon size={14} className={color} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold leading-tight ${moduleType === value ? color : 'text-fg'}`}>{label}</p>
                      <p className="text-[10px] text-fg-subtle mt-0.5 leading-tight">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Formulaire du module */}
            {moduleType && (
              <div className="card p-6">
                {selectedModule && (
                  <SectionTitle icon={selectedModule.Icon} iconClass={selectedModule.color} sub="Données du protocole">
                    {selectedModule.label}
                  </SectionTitle>
                )}
                {moduleType === 'identification_morpho' && <ModuleIdentificationMorpho f={moduleForm} h={handleModuleChange} />}
                {moduleType === 'broyage_pool'          && <ModuleBroyagePool          f={moduleForm} h={handleModuleChange} />}
                {moduleType === 'dessication'           && <ModuleDessication          f={moduleForm} h={handleModuleChange} />}
                {moduleType === 'extraction'            && <ModuleExtraction           f={moduleForm} h={handleModuleChange} />}
                {moduleType === 'amplification_pcr'     && <ModulePcr                  f={moduleForm} h={handleModuleChange} pathogenes={pathogenes} />}
                {moduleType === 'qpcr'                  && <ModuleQpcr                 f={moduleForm} h={handleModuleChange} pathogenes={pathogenes} />}
                {moduleType === 'nested_pcr'            && <ModuleNestedPcr            f={moduleForm} h={handleModuleChange} pathogenes={pathogenes} />}
                {moduleType === 'sequencage'            && <ModuleSequencage           f={moduleForm} h={handleModuleChange} />}
                {moduleType === 'microscopie'           && <ModuleMicroscopie          f={moduleForm} h={handleModuleChange} />}
              </div>
            )}

            {/* 4. Informations générales */}
            <div className="card p-6">
              <SectionTitle icon={Calendar} iconClass="text-fg-muted" sub="Protocole officiel, plage horaire, notes">
                Informations générales
              </SectionTitle>
              <div className="space-y-5">

                {/* SOP */}
                <FormField label="Référence protocole SOP" name="protocole" type="text"
                  value={protocole} onChange={(e) => setProtocole(e.target.value)}
                  placeholder="ex: SOP-LAB-042 v2.1" hint="optionnel" />

                {/* Plage horaire */}
                <div className="p-4 bg-surface-2 rounded-xl border border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <Timer size={12} className="text-fg-subtle" />
                    <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">Plage horaire</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_28px_1fr] gap-2 items-end">
                    <DateTimeField
                      label="Début"
                      value={dateDebut}
                      onChange={setDateDebut}
                      required
                    />
                    {/* Flèche centrale */}
                    <div className="hidden sm:flex items-center justify-center pb-2.5">
                      <ArrowRight size={14} className="text-fg-subtle" />
                    </div>
                    <DateTimeField
                      label="Fin"
                      value={dateFin}
                      onChange={setDateFin}
                    />
                  </div>
                  {/* Badge durée */}
                  {dateFin && (
                    <DurationBadge start={dateDebut} end={dateFin} />
                  )}
                  {!dateFin && (
                    <p className="text-[11px] text-fg-subtle">Laissez vide si la manipulation est toujours en cours.</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">
                    Notes <span className="font-normal text-fg-subtle">(optionnel)</span>
                  </label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    placeholder="Conditions expérimentales, observations…"
                    className="input-base w-full text-sm resize-none" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Sidebar sticky ── */}
          <div className="xl:sticky xl:top-5 space-y-4">
            <button type="submit" disabled={isLoading}
              className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl disabled:opacity-60">
              {isLoading
                ? <><span className="w-4 h-4 border-2 border-fg-on-primary/30 border-t-fg-on-primary rounded-full animate-spin" /> Enregistrement…</>
                : <><Plus size={15} /> Créer la manipulation</>}
            </button>

            <div className="card p-5">
              <h3 className="text-xs font-bold text-fg-subtle uppercase tracking-wider mb-4">Récapitulatif</h3>
              <div className="space-y-2.5">
                <SummaryRow label="Spécimen">
                  {specimenId ? <span className="text-success font-mono text-[11px]">{specimenLabel || `#${specimenId}`}</span> : null}
                </SummaryRow>
                <SummaryRow label="Module">
                  {selectedModule && (
                    <span className={`flex items-center gap-1 ${selectedModule.color}`}>
                      <selectedModule.Icon size={11} />{selectedModule.label}
                    </span>
                  )}
                </SummaryRow>
                <SummaryRow label="Protocole">{protocole || null}</SummaryRow>
                <SummaryRow label="Début">
                  {dateDebut ? new Date(dateDebut).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : null}
                </SummaryRow>
                {dateFin && (
                  <SummaryRow label="Fin">
                    {new Date(dateFin).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </SummaryRow>
                )}
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-2">Statut initial</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-fg-subtle flex-shrink-0" />
                <span className="text-xs text-fg"><strong>Brut</strong> — données modifiables</span>
              </div>
              <p className="text-[10px] text-fg-subtle mt-1.5 leading-relaxed">La validation (Chercheur+) verrouille définitivement les résultats.</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
