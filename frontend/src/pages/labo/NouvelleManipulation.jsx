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
import { useT } from '../../lib/i18n';

const pad2 = (n) => String(n).padStart(2, '0');
const HOURS   = Array.from({ length: 24 }, (_, i) => ({ value: pad2(i), label: pad2(i) }));
const MINUTES = Array.from({ length: 12 }, (_, i) => ({ value: pad2(i * 5), label: pad2(i * 5) }));

// ── Configuration des modules ─────────────────────────────────

export const getModules = (t) => [
  { value: 'identification_morpho', label: t('nouvelleManip.moduleLabelMorpho'), Icon: Eye,          color: 'text-fg-muted', bg: 'bg-surface-2',  desc: t('nouvelleManip.moduleDescMorpho') },
  { value: 'broyage_pool',          label: t('laboPage.typeBroyage'),      Icon: Layers,       color: 'text-info',     bg: 'bg-info/10',    desc: t('nouvelleManip.moduleDescBroyage') },
  { value: 'dessication',           label: t('laboPage.typeDessication'),  Icon: TestTube,     color: 'text-info',     bg: 'bg-info/10',    desc: t('nouvelleManip.moduleDescDessication') },
  { value: 'extraction',            label: t('laboPage.typeExtraction'),   Icon: Dna,          color: 'text-success',  bg: 'bg-success/10', desc: t('nouvelleManip.moduleDescExtraction') },
  { value: 'amplification_pcr',     label: t('laboPage.typePcr'),          Icon: Zap,          color: 'text-warning',  bg: 'bg-warning/10', desc: t('nouvelleManip.moduleDescPcr') },
  { value: 'qpcr',                  label: t('laboPage.typeQpcr'),         Icon: FlaskConical, color: 'text-primary',  bg: 'bg-primary/10', desc: t('nouvelleManip.moduleDescQpcr') },
  { value: 'nested_pcr',            label: t('manipDetail.typeNestedPcrFull'), Icon: GitBranch,    color: 'text-warning',  bg: 'bg-warning/10', desc: t('nouvelleManip.moduleDescNested') },
  { value: 'sequencage',            label: t('laboPage.typeSequencage'),   Icon: Waves,        color: 'text-primary',  bg: 'bg-primary/10', desc: t('nouvelleManip.moduleDescSeq') },
  { value: 'microscopie',           label: t('laboPage.typeMicroscopie'),  Icon: Microscope,   color: 'text-danger',   bg: 'bg-danger/10',  desc: t('nouvelleManip.moduleDescMicro') },
];

// ── Options de formulaire ─────────────────────────────────────

const SPECIMEN_ENDPOINTS = { moustique: 'moustiques', tique: 'tiques', puce: 'puces', autre: 'autres-specimens' };
const getSpecimenTypeOptions = (t) => [
  { value: 'moustique', label: t('specimenTypes.moustique') }, { value: 'tique', label: t('specimenTypes.tique') },
  { value: 'puce', label: t('specimenTypes.puce') }, { value: 'autre', label: t('specimenTypes.autre') },
];
const getNiveauConfianceOptions = (t) => [
  { value: 'certain', label: t('nouvelleManip.confianceCertain') }, { value: 'probable', label: t('nouvelleManip.confianceProbable') }, { value: 'douteux', label: t('nouvelleManip.confianceDouteux') },
];
const getTypeBroyageOptions = (t) => [
  { value: 'tissuelyser', label: 'TissueLyser' }, { value: 'pilon_mortier', label: t('nouvelleManip.broyagePilonMortier') },
  { value: 'billes_verre', label: t('nouvelleManip.broyageBillesVerre') }, { value: 'sonication', label: t('nouvelleManip.broyageSonication') }, { value: 'manuel', label: t('nouvelleManip.broyageManuel') },
];
const getTempStockageOptions = (t) => [
  { value: '-80°C', label: t('nouvelleManip.tempDeepFreezer') }, { value: '-20°C', label: '-20°C' },
  { value: '+4°C', label: t('nouvelleManip.tempFridge') }, { value: 'TA', label: t('nouvelleManip.tempAmbient') },
];
const getTypeAnOptions = (t) => [
  { value: 'adn', label: t('nouvelleManip.typeAnGenomicDna') }, { value: 'arn', label: t('nouvelleManip.typeAnTotalRna') }, { value: 'adn_arn', label: t('nouvelleManip.typeAnDnaRna') },
];
const getMethodeExtractOptions = (t) => [
  { value: 'destructive', label: t('nouvelleManip.extractDestructiveFull') }, { value: 'non_destructive', label: t('manipDetail.nonDestructive') },
];
const getStatutBandeOptions = (t) => [
  { value: 'positif', label: t('nouvelleManip.statutPositifCheck') }, { value: 'negatif', label: t('nouvelleManip.statutNegatifCross') }, { value: 'inconclusif', label: t('nouvelleManip.statutInconclusifQ') },
];
const getMethodeSeqOptions = (t) => [
  { value: 'sanger', label: t('nouvelleManip.methodeSeqSangerCapillaire') }, { value: 'ngs_illumina', label: 'NGS Illumina' }, { value: 'oxford_nanopore', label: 'Oxford Nanopore' },
];
const getTypeExamenOptions = (t) => [
  { value: 'glandes_salivaires', label: t('nouvelleManip.examSalivaryGlands') }, { value: 'frottis_sanguin', label: t('nouvelleManip.examBloodSmear') },
  { value: 'estomac_moustique', label: t('nouvelleManip.examMosquitoStomach') }, { value: 'ovaires', label: t('nouvelleManip.examOvaries') },
  { value: 'corps_entier', label: t('nouvelleManip.examWholeBody') },
];
const getGrossissementOptions = (t) => [
  { value: '10x', label: '10×' }, { value: '40x', label: '40×' }, { value: '100x', label: t('nouvelleManip.grossissement100Oil') },
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
  const t = useT();
  if (!start || !end) return null;
  const diff = new Date(end) - new Date(start);
  if (isNaN(diff)) return null;
  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-danger/8 text-danger rounded-lg text-xs font-medium">
        <AlertTriangle size={11} />
        {t('nouvelleManip.durationWarning')}
      </span>
    );
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const label = h > 0 ? `${h} h${m > 0 ? ` ${m} min` : ''}` : `${m} min`;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/8 text-primary rounded-lg text-xs font-medium">
      <Timer size={11} />
      {t('nouvelleManip.durationPrefix')} {label}
    </span>
  );
}

function PathogeneSelect({ value, onChange, pathogenes }) {
  const t = useT();
  return (
    <FormField
      label={t('manipDetail.pathogeneCible')} name="pathogeneCibleId" type="select"
      value={value} onChange={onChange}
      options={pathogenes.map((p) => ({ value: p.id, label: `${p.nom}${p.famille ? ` (${p.famille})` : ''}` }))}
      hint={t('nouvelleManip.pathogeneHint')}
    />
  );
}

// ── Sous-formulaires des modules ──────────────────────────────

function ModuleIdentificationMorpho({ f, h }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.cleDichotomiqueUtilisee')} name="cleUtilisee" type="text" value={f.cleUtilisee} onChange={h} placeholder={t('nouvelleManip.cleDichotomiquePlaceholder')} />
        <FormField label={t('manipDetail.especeIdentifiee')} name="especeIdentifiee" type="text" value={f.especeIdentifiee} onChange={h} placeholder={t('nouvelleManip.especeIdentifieePlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-4 gap-4">
        <FormField label={t('manipDetail.niveauConfiance')} name="niveauConfiance" type="select" value={f.niveauConfiance} onChange={h} options={getNiveauConfianceOptions(t)} />
        <FormField label={t('manipDetail.stadeConfirme')} name="stadeConfirme" type="text" value={f.stadeConfirme} onChange={h} placeholder={t('nouvelleManip.stadeConfirmePlaceholder')} />
        <FormField label={t('manipDetail.gorgement')} name="gorgement" type="text" value={f.gorgement} onChange={h} placeholder={t('nouvelleManip.gorgementPlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.methodeParite')} name="pariteMethode" type="text" value={f.pariteMethode} onChange={h} placeholder={t('nouvelleManip.methodeParitePlaceholder')} />
        <FormField label={t('manipDetail.resultatParite')} name="pariteResultat" type="text" value={f.pariteResultat} onChange={h} placeholder={t('nouvelleManip.resultatParitePlaceholder')} />
      </div>
      <FormField label={t('manipDetail.partiesPrelevees')} name="partiesPrelevees" type="text" value={f.partiesPrelevees} onChange={h} placeholder={t('nouvelleManip.partiesPreleveesPlaceholder')} hint={t('nouvelleManip.partiesPreleveesHint')} />
    </div>
  );
}

function ModuleBroyagePool({ f, h }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <NoteInfo>{t('nouvelleManip.broyageNote')}</NoteInfo>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.methodeBroyage')} name="methodeBroyage" type="select" value={f.methodeBroyage} onChange={h} options={getTypeBroyageOptions(t)} />
        <FormField label={t('manipDetail.tamponUtilise')} name="tamponUtilise" type="text" value={f.tamponUtilise} onChange={h} placeholder={t('nouvelleManip.tamponUtilisePlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('nouvelleManip.volumeTamponLabel')} <span className="text-fg-subtle font-normal">(µL)</span></label>
          <input type="number" name="volumeTamponUl" step="0.1" min="0" value={f.volumeTamponUl} onChange={h} placeholder="ex: 500" className="input-base w-full text-sm" />
        </div>
        <FormField label={t('manipDetail.parametresBroyeur')} name="parametresBroyeur" type="text" value={f.parametresBroyeur} onChange={h} placeholder={t('nouvelleManip.parametresBroyeurPlaceholder')} />
      </div>
      <Divider label={t('nouvelleManip.resultatDividerSingle')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('nouvelleManip.volumeRecupereLabel')} <span className="text-fg-subtle font-normal">(µL)</span></label>
          <input type="number" name="volumeRecupereUl" step="0.1" min="0" value={f.volumeRecupereUl} onChange={h} placeholder="ex: 450" className="input-base w-full text-sm" />
        </div>
        <FormField label={t('manipDetail.aspectMacroscopique')} name="aspectMacro" type="text" value={f.aspectMacro} onChange={h} placeholder={t('nouvelleManip.aspectMacroPlaceholder')} />
      </div>
    </div>
  );
}

function ModuleDessication({ f, h }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.methodeGeneric')} name="methode" type="text" value={f.methode} onChange={h} placeholder={t('nouvelleManip.methodePlaceholder')} />
        <FormField label={t('nouvelleManip.temperatureStockageLabel')} name="temperatureStockage" type="select" value={f.temperatureStockage} onChange={h} options={getTempStockageOptions(t)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('nouvelleManip.dureeDessicationLabel')} <span className="text-fg-subtle font-normal">{t('nouvelleManip.dureeDessicationUnit')}</span></label>
          <input type="number" name="dureeDessicationH" step="0.5" min="0" value={f.dureeDessicationH} onChange={h} placeholder={t('nouvelleManip.dureeDessicationPlaceholder')} className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('manipDetail.silicaGel')} <span className="text-fg-subtle font-normal">{t('nouvelleManip.silicaGelUnit')}</span></label>
          <input type="number" name="quantiteSilicaGelG" step="0.1" min="0" value={f.quantiteSilicaGelG} onChange={h} placeholder={t('nouvelleManip.silicaGelPlaceholder')} className="input-base w-full text-sm" />
        </div>
        <FormField label={t('nouvelleManip.dateMiseConservationLabel')} name="dateMiseConservation" type="date" value={f.dateMiseConservation} onChange={h} />
      </div>
      <Divider label={t('nouvelleManip.resultatDividerSingle')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.partieCorps')} name="partieCorps" type="text" value={f.partieCorps} onChange={h} placeholder={t('nouvelleManip.partieCorpsPlaceholder')} />
        <FormField label={t('nouvelleManip.statutTissuLabel')} name="statutTissu" type="text" value={f.statutTissu} onChange={h} placeholder={t('nouvelleManip.statutTissuPlaceholder')} />
        <FormField label={t('nouvelleManip.emplacementLabel')} name="emplacementCode" type="text" value={f.emplacementCode} onChange={h} placeholder={t('nouvelleManip.emplacementPlaceholder')} />
      </div>
    </div>
  );
}

function ModuleExtraction({ f, h }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.typeAcideNucleiqueLabel')} name="typeAcideNucleique" type="select" value={f.typeAcideNucleique} onChange={h} options={getTypeAnOptions(t)} />
        <FormField label={t('nouvelleManip.kitLabel')} name="typeKit" type="text" value={f.typeKit} onChange={h} placeholder={t('nouvelleManip.kitPlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.methodeGeneric')} name="methodeExtraction" type="select" value={f.methodeExtraction} onChange={h} options={getMethodeExtractOptions(t)} />
        <FormField label={t('manipDetail.homogeneisation')} name="methodeHomogeneisation" type="select" value={f.methodeHomogeneisation} onChange={h} options={getTypeBroyageOptions(t)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('nouvelleManip.quantiteTissuLabel')} <span className="text-fg-subtle font-normal">(mg)</span></label>
          <input type="number" name="quantiteTissuMg" step="0.01" min="0" value={f.quantiteTissuMg} onChange={h} placeholder={t('nouvelleManip.quantiteTissuPlaceholder')} className="input-base w-full text-sm" />
        </div>
        <FormField label={t('nouvelleManip.numeroLotLabel')} name="numerotLot" type="text" value={f.numerotLot} onChange={h} placeholder={t('nouvelleManip.numeroLotPlaceholder')} />
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('nouvelleManip.volumeElutionLabel')} <span className="text-fg-subtle font-normal">(µL)</span></label>
          <input type="number" name="volumeElutionUl" step="1" min="0" value={f.volumeElutionUl} onChange={h} placeholder={t('nouvelleManip.volumeElutionPlaceholder')} className="input-base w-full text-sm" />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" name="controlExtraction" checked={f.controlExtraction === true || f.controlExtraction === 'true'} onChange={(e) => h({ target: { name: 'controlExtraction', value: e.target.checked } })} className="rounded" />
        <span className="text-xs text-fg">{t('nouvelleManip.temoinNegatifExtractionCheckbox')}</span>
      </label>
      <Divider label={t('nouvelleManip.resultatsControleQualite')} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['concentrationAdn', t('nouvelleManip.concentrationAdnShort'), 'ng/µL', 'ex: 12.5'], ['pureteA260A280', 'A260/A280', '', 'ex: 1.82'], ['pureteA260A230', 'A260/A230', '', 'ex: 2.10'], ['volumeFinalUl', t('nouvelleManip.volumeFinalShort'), 'µL', 'ex: 50']].map(([name, label, unit, ph]) => (
          <div key={name}>
            <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{label}{unit && <span className="font-normal text-fg-subtle"> ({unit})</span>}</label>
            <input type="number" name={name} step="0.001" min="0" value={f[name]} onChange={h} placeholder={ph} className="input-base w-full text-sm" />
          </div>
        ))}
      </div>
      <FormField label={t('manipDetail.idTubeAdn')} name="idTubeAdn" type="text" value={f.idTubeAdn} onChange={h} placeholder={t('nouvelleManip.idTubeAdnPlaceholder')} hint={t('nouvelleManip.idTubeAdnHint')} />
    </div>
  );
}

function ModulePcr({ f, h, pathogenes }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <PathogeneSelect value={f.pathogeneCibleId} onChange={h} pathogenes={pathogenes} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.geneCible')} name="geneCible" type="text" value={f.geneCible} onChange={h} placeholder="ex: COI, ITS2, 18S, CSP…" />
        <FormField label={t('manipDetail.plaquePcr')} name="idPlaquePcr" type="text" value={f.idPlaquePcr} onChange={h} placeholder={t('nouvelleManip.idPlaquePcrPlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.amorceForwardFullLabel')} name="amorceForward" type="text" value={f.amorceForward} onChange={h} placeholder={t('nouvelleManip.sequenceOuCodePlaceholder')} />
        <FormField label={t('nouvelleManip.amorceReverseFullLabel')} name="amorceReverse" type="text" value={f.amorceReverse} onChange={h} placeholder={t('nouvelleManip.sequenceOuCodePlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <FormField label={t('manipDetail.enzymeMasterMix')} name="enzyme" type="text" value={f.enzyme} onChange={h} placeholder={t('nouvelleManip.enzymePlaceholder')} />
        <FormField label={t('manipDetail.programmeThermocycleur')} name="programmeThermo" type="text" value={f.programmeThermo} onChange={h} placeholder={t('nouvelleManip.programmeThermoPlaceholder')} />
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('manipDetail.tailleAttendue')} <span className="text-fg-subtle font-normal">{t('nouvelleManip.tailleAttenduePbUnit')}</span></label>
          <input type="number" name="tailleAttenduePb" step="1" min="0" value={f.tailleAttenduePb} onChange={h} placeholder={t('nouvelleManip.tailleAttenduePlaceholder')} className="input-base w-full text-sm" />
        </div>
        <FormField label={t('nouvelleManip.puitsLabel')} name="puitsPcr" type="select" value={f.puitsPcr} onChange={h} options={WELLS} />
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input type="checkbox" name="temoinPositif" checked={f.temoinPositif === true || f.temoinPositif === 'true'} onChange={(e) => h({ target: { name: 'temoinPositif', value: e.target.checked } })} className="rounded" />
          {t('nouvelleManip.temoinPositifCheckbox')}
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input type="checkbox" name="temoinNegatif" checked={f.temoinNegatif === true || f.temoinNegatif === 'true'} onChange={(e) => h({ target: { name: 'temoinNegatif', value: e.target.checked } })} className="rounded" />
          {t('nouvelleManip.temoinNegatifCheckbox')}
        </label>
      </div>
      <Divider label={t('manipDetail.sectionResultatGel')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.statutBandeGelLabel')} name="statutBandeGel" type="select" value={f.statutBandeGel} onChange={h} options={getStatutBandeOptions(t)} />
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('manipDetail.tailleBandeObservee')} <span className="text-fg-subtle font-normal">{t('nouvelleManip.tailleAttenduePbUnit')}</span></label>
          <input type="number" name="tailleBandePb" step="1" min="0" value={f.tailleBandePb} onChange={h} placeholder={t('nouvelleManip.tailleBandeObserveePlaceholder')} className="input-base w-full text-sm" />
        </div>
      </div>
    </div>
  );
}

function ModuleQpcr({ f, h, pathogenes }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.typeDeQpcrLabel')} name="typePcr" type="select" value={f.typePcr} onChange={h}
          options={[{ value: 'qPCR', label: t('nouvelleManip.qpcrTypeDna') }, { value: 'RT-qPCR', label: t('nouvelleManip.qpcrTypeRna') }]} />
        <PathogeneSelect value={f.pathogeneCibleId} onChange={h} pathogenes={pathogenes} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.geneCible')} name="geneCible" type="text" value={f.geneCible} onChange={h} placeholder="ex: NS5, CSP, E1…" />
        <FormField label={t('nouvelleManip.geneReferenceInterneLabel')} name="geneReference" type="text" value={f.geneReference} onChange={h} placeholder={t('nouvelleManip.geneReferenceInternePlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.amorceForward')} name="amorceForward" type="text" value={f.amorceForward} onChange={h} placeholder={t('nouvelleManip.sequencePlaceholder')} />
        <FormField label={t('manipDetail.amorceReverse')} name="amorceReverse" type="text" value={f.amorceReverse} onChange={h} placeholder={t('nouvelleManip.sequencePlaceholder')} />
      </div>
      <FormField label={t('manipDetail.sondeTaqman')} name="sondeTaqman" type="text" value={f.sondeTaqman} onChange={h} placeholder={t('nouvelleManip.sondeTaqmanPlaceholder')} hint={t('nouvelleManip.sondeTaqmanHint')} />
      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-4 gap-4">
        <FormField label={t('manipDetail.masterMix')} name="masterMix" type="text" value={f.masterMix} onChange={h} placeholder={t('nouvelleManip.masterMixPlaceholder')} />
        <FormField label={t('nouvelleManip.idPlaqueQpcrLabel')} name="idPlaqueQpcr" type="text" value={f.idPlaqueQpcr} onChange={h} placeholder={t('nouvelleManip.idPlaqueQpcrPlaceholder')} />
        <FormField label={t('nouvelleManip.puitsLabel')} name="puitsQpcr" type="select" value={f.puitsQpcr} onChange={h} options={WELLS} />
      </div>
      <Divider label={t('nouvelleManip.resultatsQuantitatifs')} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['valeurCt', t('nouvelleManip.ctSpecimenShort'), '', 'ex: 28.4'], ['ctTemoinPositif', t('nouvelleManip.ctTemoinPosShort'), '', 'ex: 22.1'], ['ctTemoinNegatif', t('nouvelleManip.ctTemoinNegShort'), '', 'ex: 0'], ['ctControleInterne', t('nouvelleManip.ctControleIntShort'), '', 'ex: 20.5']].map(([name, label,, ph]) => (
          <div key={name}>
            <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{label}</label>
            <input type="number" name={name} step="0.01" min="0" value={f[name]} onChange={h} placeholder={ph} className="input-base w-full text-sm" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.interpretation')} name="interpretation" type="select" value={f.interpretation} onChange={h} options={getStatutBandeOptions(t)} />
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('manipDetail.efficacite')} <span className="text-fg-subtle font-normal">{t('nouvelleManip.efficaciteUnit')}</span></label>
          <input type="number" name="efficacitePct" step="0.1" min="0" max="120" value={f.efficacitePct} onChange={h} placeholder={t('nouvelleManip.efficacitePlaceholder')} className="input-base w-full text-sm" />
        </div>
      </div>
    </div>
  );
}

function ModuleNestedPcr({ f, h, pathogenes }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <PathogeneSelect value={f.pathogeneCibleId} onChange={h} pathogenes={pathogenes} />
        <FormField label={t('manipDetail.geneCible')} name="geneCible" type="text" value={f.geneCible} onChange={h} placeholder="ex: COI, 18S…" />
      </div>
      <div className="flex gap-6 mb-1">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input type="checkbox" name="temoinPositif" checked={f.temoinPositif === true || f.temoinPositif === 'true'} onChange={(e) => h({ target: { name: 'temoinPositif', value: e.target.checked } })} className="rounded" />
          {t('nouvelleManip.temoinPositifCheckbox')}
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input type="checkbox" name="temoinNegatif" checked={f.temoinNegatif === true || f.temoinNegatif === 'true'} onChange={(e) => h({ target: { name: 'temoinNegatif', value: e.target.checked } })} className="rounded" />
          {t('nouvelleManip.temoinNegatifCheckbox')}
        </label>
      </div>
      <div className="rounded-xl border border-info/30 bg-info/5 p-4 space-y-3">
        <p className="text-xs font-bold text-info">{t('nouvelleManip.round1Label')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          <FormField label={t('manipDetail.f1Label')} name="amorceF1" type="text" value={f.amorceF1} onChange={h} placeholder={t('nouvelleManip.amorceF1Placeholder')} />
          <FormField label={t('manipDetail.r1Label')} name="amorceR1" type="text" value={f.amorceR1} onChange={h} placeholder={t('nouvelleManip.amorceR1Placeholder')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('nouvelleManip.tailleAttenduePbLabel')}</label>
            <input type="number" name="tailleAttendue1" step="1" min="0" value={f.tailleAttendue1} onChange={h} placeholder="ex: 710" className="input-base w-full text-sm" />
          </div>
          <FormField label={t('manipDetail.resultatRound1')} name="statutBande1" type="select" value={f.statutBande1} onChange={h} options={getStatutBandeOptions(t)} />
        </div>
      </div>
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
        <p className="text-xs font-bold text-warning">{t('nouvelleManip.round2Label')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          <FormField label={t('manipDetail.f2Label')} name="amorceF2" type="text" value={f.amorceF2} onChange={h} placeholder={t('nouvelleManip.amorceInterneFPlaceholder')} />
          <FormField label={t('manipDetail.r2Label')} name="amorceR2" type="text" value={f.amorceR2} onChange={h} placeholder={t('nouvelleManip.amorceInterneRPlaceholder')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('nouvelleManip.tailleAttenduePbLabel')}</label>
            <input type="number" name="tailleAttendue2" step="1" min="0" value={f.tailleAttendue2} onChange={h} placeholder="ex: 450" className="input-base w-full text-sm" />
          </div>
          <FormField label={t('manipDetail.resultatRound2')} name="statutBande2" type="select" value={f.statutBande2} onChange={h} options={getStatutBandeOptions(t)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.resultatFinalLabel')} name="resultatFinal" type="select" value={f.resultatFinal} onChange={h} options={getStatutBandeOptions(t)} />
        <FormField label={t('nouvelleManip.idPlaqueLabel')} name="idPlaque" type="text" value={f.idPlaque} onChange={h} placeholder={t('nouvelleManip.idPlaqueNestedPlaceholder')} />
      </div>
    </div>
  );
}

function ModuleSequencage({ f, h }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <NoteInfo>{t('nouvelleManip.seqNote')}</NoteInfo>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.methodeSeqLabel')} name="methodeSequencage" type="select" value={f.methodeSequencage} onChange={h} options={getMethodeSeqOptions(t)} />
        <FormField label={t('nouvelleManip.prestatairePlatformeLabel')} name="prestataire" type="text" value={f.prestataire} onChange={h} placeholder={t('nouvelleManip.prestatairePlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.idPlaqueTubeLabel')} name="idPlaqueTube" type="text" value={f.idPlaqueTube} onChange={h} placeholder={t('nouvelleManip.idPlaqueTubePlaceholder')} />
        <FormField label={t('nouvelleManip.amorceSeqLabel')} name="amorceSequencage" type="text" value={f.amorceSequencage} onChange={h} placeholder={t('nouvelleManip.amorceSeqPlaceholder')} />
      </div>
      <Divider label={t('nouvelleManip.resultatsBlast')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('nouvelleManip.organismePlusProcheLabel')} name="organismeBlast" type="text" value={f.organismeBlast} onChange={h} placeholder={t('nouvelleManip.organismePlaceholder')} />
        <FormField label={t('nouvelleManip.accessionLabel')} name="accessionGenbank" type="text" value={f.accessionGenbank} onChange={h} placeholder={t('nouvelleManip.accessionPlaceholder')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('manipDetail.identiteBlast')} <span className="text-fg-subtle font-normal">{t('nouvelleManip.identiteBlastUnit')}</span></label>
          <input type="number" name="identiteBlastPct" step="0.1" min="0" max="100" value={f.identiteBlastPct} onChange={h} placeholder={t('nouvelleManip.identiteBlastPlaceholder')} className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('manipDetail.couvertureBlast')} <span className="text-fg-subtle font-normal">{t('nouvelleManip.couvertureBlastUnit')}</span></label>
          <input type="number" name="couvertureBlastPct" step="0.1" min="0" max="100" value={f.couvertureBlastPct} onChange={h} placeholder={t('nouvelleManip.couvertureBlastPlaceholder')} className="input-base w-full text-sm" />
        </div>
      </div>
    </div>
  );
}

function ModuleMicroscopie({ f, h }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-4 gap-4">
        <FormField label={t('manipDetail.typeExamen')} name="typeExamen" type="select" value={f.typeExamen} onChange={h} options={getTypeExamenOptions(t)} />
        <FormField label={t('manipDetail.coloration')} name="coloration" type="text" value={f.coloration} onChange={h} placeholder={t('nouvelleManip.colorationPlaceholder')} />
        <FormField label={t('manipDetail.grossissement')} name="grossissement" type="select" value={f.grossissement} onChange={h} options={getGrossissementOptions(t)} />
      </div>
      <Divider label={t('nouvelleManip.resultatsDividerPlural')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        <FormField label={t('manipDetail.resultatLabel')} name="resultat" type="select" value={f.resultat} onChange={h}
          options={[{ value: 'positif', label: t('nouvelleManip.microResultatPositif') }, { value: 'negatif', label: t('nouvelleManip.microResultatNegatif') }, { value: 'inconclusif', label: t('nouvelleManip.microResultatInconclusif') }]} />
        <FormField label={t('manipDetail.stadeObserve')} name="stadeObserve" type="text" value={f.stadeObserve} onChange={h} placeholder={t('nouvelleManip.stadeObservePlaceholder')} />
      </div>
      <FormField label={t('manipDetail.densiteParasitaire')} name="densiteParasitaire" type="text" value={f.densiteParasitaire} onChange={h} placeholder={t('nouvelleManip.densiteParasitairePlaceholder')} />
      <div>
        <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">{t('nouvelleManip.observationsOptionalLabel')} <span className="text-fg-subtle font-normal">{t('nouvelleManip.observationsOptionalHint')}</span></label>
        <textarea name="observations" value={f.observations} onChange={h} rows={2} placeholder={t('nouvelleManip.observationsPlaceholder')} className="input-base w-full text-sm resize-none" />
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────

export default function NouvelleManipulation() {
  const t = useT();
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
    const tid = setTimeout(async () => {
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
    return () => clearTimeout(tid);
  }, [specimenType, specimenSearch]);

  const handleModuleChange = (e) => {
    const { name, value } = e.target;
    setModuleForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!specimenType && !specimenId) errs.specimenType = t('nouvelleManip.errSpecimenType');
    if (!specimenId) errs.specimenId = t('nouvelleManip.errSpecimenId');
    if (!moduleType) errs.moduleType = t('nouvelleManip.errModuleType');
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
      setErrors({ submit: err.response?.data?.error || t('nouvelleManip.errCreationGeneric') });
    } finally {
      setIsLoading(false);
    }
  };

  const modules = getModules(t);
  const selectedModule = modules.find((m) => m.value === moduleType);

  return (
    <div className="max-w-screen-2xl space-y-4">
      <Link to="/labo" className="inline-flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg transition-colors group">
        <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        {t('manipDetail.backToLabo')}
      </Link>

      <div className="flex items-center gap-3 pb-1">
        <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
          <FlaskConical size={17} className="text-warning" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-fg">{t('nouvelleManip.pageTitle')}</h1>
          <p className="text-xs text-fg-subtle">{t('nouvelleManip.pageSubtitle')}</p>
        </div>
      </div>

      {errors.submit && (
        <div className="p-3.5 bg-danger/8 border border-danger/25 rounded-xl text-sm text-danger flex items-center gap-2">
          <span className="font-semibold">{t('nouvelleManip.errorPrefix')}</span> {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_380px] gap-5 2xl:gap-8 items-start">
          <div className="space-y-4">

            {/* 1. Spécimen */}
            <div className="card p-6">
              <SectionTitle icon={Bug} iconClass="text-primary" sub={t('nouvelleManip.sectionSpecimenSub')}>
                {t('nouvelleManip.sectionSpecimenTitle')}
              </SectionTitle>
              <div className="space-y-4">
                <FormField label={t('nouvelleManip.typeSpecimenLabel')} name="specimenType" type="select"
                  value={specimenType}
                  onChange={(e) => { setSpecimenType(e.target.value); setSpecimenId(''); setSpecimenLabel(''); setSpecimenOptions([]); setErrors((p) => ({ ...p, specimenType: null })); }}
                  options={getSpecimenTypeOptions(t)} required error={errors.specimenType} />

                {specimenType && (
                  <div>
                    <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">
                      {t('nouvelleManip.specimenRequiredLabel')} <span className="text-danger">*</span>
                    </label>
                    {specimenId && !specimenSearch ? (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-success/40 bg-success/5">
                        <span className="text-sm text-fg font-medium truncate">{specimenLabel}</span>
                        <button type="button" onClick={() => { setSpecimenId(''); setSpecimenLabel(''); }}
                          className="text-xs text-fg-subtle hover:text-danger transition-colors flex-shrink-0">{t('nouvelleManip.changerBtn')}</button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
                          <input type="text" placeholder={t('nouvelleManip.specimenSearchPlaceholder')} value={specimenSearch}
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
                          <p className="mt-1.5 text-xs text-fg-subtle text-center py-2">{t('nouvelleManip.noResultsSearch')}</p>
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
              <SectionTitle icon={FlaskConical} iconClass="text-warning" sub={t('nouvelleManip.sectionModuleSub')}>
                {t('nouvelleManip.sectionModuleTitle')}
              </SectionTitle>
              {errors.moduleType && <p className="text-xs text-danger mb-3">{errors.moduleType}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 2xl:gap-4">
                {modules.map(({ value, label, Icon, color, bg, desc }) => (
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
                  <SectionTitle icon={selectedModule.Icon} iconClass={selectedModule.color} sub={t('nouvelleManip.sectionModuleFormSub')}>
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
              <SectionTitle icon={Calendar} iconClass="text-fg-muted" sub={t('nouvelleManip.sectionInfoGeneralesSub')}>
                {t('nouvelleManip.sectionInfoGeneralesTitle')}
              </SectionTitle>
              <div className="space-y-5">

                {/* SOP */}
                <FormField label={t('nouvelleManip.protocoleSopRefLabel')} name="protocole" type="text"
                  value={protocole} onChange={(e) => setProtocole(e.target.value)}
                  placeholder={t('nouvelleManip.protocoleSopPlaceholder')} hint={t('nouvelleManip.optionalHint')} />

                {/* Plage horaire */}
                <div className="p-4 bg-surface-2 rounded-xl border border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <Timer size={12} className="text-fg-subtle" />
                    <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">{t('nouvelleManip.plageHoraireLabel')}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_28px_1fr] gap-2 items-end">
                    <DateTimeField
                      label={t('nouvelleManip.debutLabel')}
                      value={dateDebut}
                      onChange={setDateDebut}
                      required
                    />
                    {/* Flèche centrale */}
                    <div className="hidden sm:flex items-center justify-center pb-2.5">
                      <ArrowRight size={14} className="text-fg-subtle" />
                    </div>
                    <DateTimeField
                      label={t('nouvelleManip.finLabel')}
                      value={dateFin}
                      onChange={setDateFin}
                    />
                  </div>
                  {/* Badge durée */}
                  {dateFin && (
                    <DurationBadge start={dateDebut} end={dateFin} />
                  )}
                  {!dateFin && (
                    <p className="text-[11px] text-fg-subtle">{t('nouvelleManip.plageHoraireHint')}</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-fg-muted tracking-wide mb-1.5">
                    {t('nouvelleManip.notesOptionalLabel')} <span className="font-normal text-fg-subtle">{t('nouvelleManip.notesOptionalHint')}</span>
                  </label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    placeholder={t('nouvelleManip.notesGeneralesPlaceholder')}
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
                ? <><span className="w-4 h-4 border-2 border-fg-on-primary/30 border-t-fg-on-primary rounded-full animate-spin" /> {t('nouvelleManip.savingLabel')}</>
                : <><Plus size={15} /> {t('nouvelleManip.createManipBtn')}</>}
            </button>

            <div className="card p-5">
              <h3 className="text-xs font-bold text-fg-subtle uppercase tracking-wider mb-4">{t('nouvelleManip.recapitulatifTitle')}</h3>
              <div className="space-y-2.5">
                <SummaryRow label={t('nouvelleManip.summarySpecimen')}>
                  {specimenId ? <span className="text-success font-mono text-[11px]">{specimenLabel || `#${specimenId}`}</span> : null}
                </SummaryRow>
                <SummaryRow label={t('nouvelleManip.summaryModule')}>
                  {selectedModule && (
                    <span className={`flex items-center gap-1 ${selectedModule.color}`}>
                      <selectedModule.Icon size={11} />{selectedModule.label}
                    </span>
                  )}
                </SummaryRow>
                <SummaryRow label={t('nouvelleManip.summaryProtocole')}>{protocole || null}</SummaryRow>
                <SummaryRow label={t('nouvelleManip.summaryDebut')}>
                  {dateDebut ? new Date(dateDebut).toLocaleString(t('common.locale'), { dateStyle: 'short', timeStyle: 'short' }) : null}
                </SummaryRow>
                {dateFin && (
                  <SummaryRow label={t('nouvelleManip.summaryFin')}>
                    {new Date(dateFin).toLocaleString(t('common.locale'), { dateStyle: 'short', timeStyle: 'short' })}
                  </SummaryRow>
                )}
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-2">{t('nouvelleManip.statutInitialTitle')}</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-fg-subtle flex-shrink-0" />
                <span className="text-xs text-fg"><strong>{t('nouvelleManip.statutInitialBrut')}</strong> {t('nouvelleManip.statutInitialDataEditable')}</span>
              </div>
              <p className="text-[10px] text-fg-subtle mt-1.5 leading-relaxed">{t('nouvelleManip.statutInitialHint')}</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
