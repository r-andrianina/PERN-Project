import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, FlaskConical, ShieldCheck, ShieldAlert, FileEdit,
  TestTube, Dna, Zap, Waves, User, AlertTriangle,
  Upload, Check, X, Eye, Layers, GitBranch, Microscope, Activity,
} from 'lucide-react';
import { Card, Button, Badge, Spinner } from '../../components/ui';
import AuthImg, { downloadAuthFile } from '../../components/AuthImg';
import { useApiQuery } from '../../hooks';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { useT } from '../../lib/i18n';

// ── Config ────────────────────────────────────────────────────

const getTypeConfig = (t) => ({
  identification_morpho: { label: t('manipDetail.typeIdentificationMorpho'), Icon: Eye,          color: 'text-fg-muted',  bg: 'bg-surface-2'   },
  broyage_pool:          { label: t('laboPage.typeBroyage'),      Icon: Layers,       color: 'text-info',      bg: 'bg-info/10'     },
  dessication:           { label: t('laboPage.typeDessication'),  Icon: TestTube,     color: 'text-info',      bg: 'bg-info/10'     },
  extraction:            { label: t('laboPage.typeExtraction'),   Icon: Dna,          color: 'text-success',   bg: 'bg-success/10'  },
  amplification_pcr:     { label: t('laboPage.typePcr'),          Icon: Zap,          color: 'text-warning',   bg: 'bg-warning/10'  },
  qpcr:                  { label: t('laboPage.typeQpcr'),         Icon: Activity,     color: 'text-primary',   bg: 'bg-primary/10'  },
  nested_pcr:            { label: t('manipDetail.typeNestedPcrFull'), Icon: GitBranch,    color: 'text-warning',   bg: 'bg-warning/10'  },
  sequencage:            { label: t('laboPage.typeSequencage'),   Icon: Waves,        color: 'text-primary',   bg: 'bg-primary/10'  },
  microscopie:           { label: t('laboPage.typeMicroscopie'),  Icon: Microscope,   color: 'text-danger',    bg: 'bg-danger/10'   },
  autre:                 { label: t('laboPage.typeAutre'),        Icon: FlaskConical, color: 'text-fg-muted',  bg: 'bg-surface-2'   },
});

const getStatutConfig = (t) => ({
  brut:     { label: t('laboPage.statutBrut'),     tone: 'default', Icon: FileEdit    },
  valide:   { label: t('laboPage.statutValide'),   tone: 'success', Icon: ShieldCheck },
  invalide: { label: t('laboPage.statutInvalide'), tone: 'danger',  Icon: ShieldAlert },
});

const getEventIcons = (t) => ({
  CREATION:       { label: t('manipDetail.eventCreated'),       color: 'bg-primary' },
  MODIFICATION:   { label: t('manipDetail.eventModified'),      color: 'bg-info'    },
  VALIDATION:     { label: t('manipDetail.eventValidated'),     color: 'bg-success' },
  INVALIDATION:   { label: t('manipDetail.eventInvalidated'),   color: 'bg-danger'  },
  UPLOAD_GEL:     { label: t('manipDetail.eventGelUploaded'),   color: 'bg-warning' },
  UPLOAD_MICRO:   { label: t('manipDetail.eventMicroUploaded'), color: 'bg-warning' },
  UPLOAD_FICHIER: { label: t('manipDetail.eventFileUploaded'),  color: 'bg-warning' },
});


// ── Helpers ───────────────────────────────────────────────────

function UploadBtn({ subtype, accept, hasFile, label, replaceLabel, uploading, uploadingLabel, disabled, onUpload }) {
  return (
    <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-2 transition-colors cursor-pointer text-sm font-medium text-fg ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <Upload size={14} />
      {uploading ? uploadingLabel : hasFile ? replaceLabel : label}
      <input type="file" accept={accept} onChange={(e) => onUpload(e, subtype)}
        className="hidden" disabled={uploading || disabled} />
    </label>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-fg-subtle w-44 flex-shrink-0">{label}</span>
      <span className="text-sm text-fg font-medium break-all">
        {children || <span className="text-fg-subtle font-normal">—</span>}
      </span>
    </div>
  );
}

function Section({ title, children, accent }) {
  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-wider mb-3 ${accent || 'text-fg-subtle'}`}>{title}</p>
      <div>{children}</div>
    </div>
  );
}

function Mono({ children }) {
  return <code className="text-xs font-mono bg-surface-2 px-1.5 py-0.5 rounded break-all">{children}</code>;
}

function BandeBadge({ statut }) {
  if (!statut) return <span className="text-fg-subtle font-normal">—</span>;
  const tone = statut === 'positif' ? 'success' : statut === 'negatif' ? 'danger' : 'default';
  return <Badge tone={tone} size="sm">{statut.charAt(0).toUpperCase() + statut.slice(1)}</Badge>;
}

function GelImage({ path }) {
  const t = useT();
  if (!path) return null;
  return (
    <div className="mt-4">
      <p className="text-xs text-fg-subtle mb-2">{t('manipDetail.gelImageCaption')}</p>
      <AuthImg src={`/uploads/${path}`} alt="Gel" className="max-h-64 rounded-lg border border-border object-contain" />
    </div>
  );
}

// ── ModuleDetails — 9 branches ────────────────────────────────

function ModuleDetails({ manip }) {
  const t = useT();
  const typ = manip.typeManipulation;

  // — Identification morphologique
  if (typ === 'identification_morpho' && manip.identificationMorpho) {
    const d = manip.identificationMorpho;
    return (
      <Section title={t('manipDetail.typeIdentificationMorpho')}>
        <InfoRow label={t('manipDetail.cleDichotomique')}>{d.cleUtilisee}</InfoRow>
        <InfoRow label={t('manipDetail.especeIdentifiee')}>
          {d.especeIdentifiee && <em>{d.especeIdentifiee}</em>}
        </InfoRow>
        <InfoRow label={t('manipDetail.niveauConfiance')}>
          {d.niveauConfiance && (
            <Badge tone={d.niveauConfiance === 'certain' ? 'success' : d.niveauConfiance === 'douteux' ? 'danger' : 'default'} size="sm">
              {d.niveauConfiance.charAt(0).toUpperCase() + d.niveauConfiance.slice(1)}
            </Badge>
          )}
        </InfoRow>
        <InfoRow label={t('manipDetail.stadeConfirme')}>{d.stadeConfirme}</InfoRow>
        <InfoRow label={t('manipDetail.gorgement')}>{d.gorgement}</InfoRow>
        <InfoRow label={t('manipDetail.methodeParite')}>{d.pariteMethode}</InfoRow>
        <InfoRow label={t('manipDetail.resultatParite')}>{d.pariteResultat}</InfoRow>
        <InfoRow label={t('manipDetail.partiesPrelevees')}>{d.partiesPrelevees}</InfoRow>
        {d.observations && (
          <div className="mt-3 p-3 bg-surface-2 rounded-lg text-sm text-fg">{d.observations}</div>
        )}
      </Section>
    );
  }

  // — Broyage / Pool
  if (typ === 'broyage_pool' && manip.broyagePool) {
    const d = manip.broyagePool;
    return (
      <Section title={t('manipDetail.sectionBroyagePool')}>
        <InfoRow label={t('manipDetail.methodeBroyage')}>{d.methodeBroyage}</InfoRow>
        <InfoRow label={t('manipDetail.tamponUtilise')}>{d.tamponUtilise}</InfoRow>
        <InfoRow label={t('manipDetail.volumeTampon')}>{d.volumeTamponUl != null ? `${d.volumeTamponUl} µL` : null}</InfoRow>
        <InfoRow label={t('manipDetail.parametresBroyeur')}>{d.parametresBroyeur}</InfoRow>
        <InfoRow label={t('manipDetail.volumeRecupere')}>{d.volumeRecupereUl != null ? `${d.volumeRecupereUl} µL` : null}</InfoRow>
        <InfoRow label={t('manipDetail.aspectMacroscopique')}>{d.aspectMacro}</InfoRow>
      </Section>
    );
  }

  // — Dessication
  if (typ === 'dessication' && manip.dessication) {
    const d = manip.dessication;
    return (
      <Section title={t('laboPage.typeDessication')}>
        <InfoRow label={t('manipDetail.methodeGeneric')}>{d.methode}</InfoRow>
        <InfoRow label={t('manipDetail.temperatureStockage')}>{d.temperatureStockage}</InfoRow>
        <InfoRow label={t('manipDetail.dureeDessication')}>{d.dureeDessicationH != null ? `${d.dureeDessicationH} h` : null}</InfoRow>
        <InfoRow label={t('manipDetail.silicaGel')}>{d.quantiteSilicaGelG != null ? `${d.quantiteSilicaGelG} g` : null}</InfoRow>
        <InfoRow label={t('manipDetail.dateConservation')}>
          {d.dateMiseConservation ? new Date(d.dateMiseConservation).toLocaleDateString(t('common.locale')) : null}
        </InfoRow>
        <InfoRow label={t('manipDetail.partieCorps')}>{d.partieCorps}</InfoRow>
        <InfoRow label={t('manipDetail.statutTissu')}>{d.statutTissu}</InfoRow>
        <InfoRow label={t('manipDetail.emplacement')}>{d.emplacementCode}</InfoRow>
      </Section>
    );
  }

  // — Extraction ADN/ARN
  if (typ === 'extraction' && manip.extraction) {
    const d = manip.extraction;
    return (
      <Section title={t('laboPage.typeExtraction')}>
        <InfoRow label={t('manipDetail.typeAcideNucleique')}>
          {d.typeAcideNucleique ? d.typeAcideNucleique.toUpperCase().replace('_', '/') : null}
        </InfoRow>
        <InfoRow label={t('manipDetail.kit')}>{d.typeKit}</InfoRow>
        <InfoRow label={t('manipDetail.methodeExtraction')}>{d.methodeExtraction === 'destructive' ? t('manipDetail.destructive') : d.methodeExtraction === 'non_destructive' ? t('manipDetail.nonDestructive') : null}</InfoRow>
        <InfoRow label={t('manipDetail.homogeneisation')}>{d.methodeHomogeneisation}</InfoRow>
        <InfoRow label={t('manipDetail.quantiteTissu')}>{d.quantiteTissuMg != null ? `${d.quantiteTissuMg} mg` : null}</InfoRow>
        <InfoRow label={t('manipDetail.numeroLotKit')}>{d.numerotLot}</InfoRow>
        <InfoRow label={t('manipDetail.volumeElution')}>{d.volumeElutionUl != null ? `${d.volumeElutionUl} µL` : null}</InfoRow>
        <InfoRow label={t('manipDetail.temoinNegatifExtraction')}>{d.controlExtraction ? <Badge tone="info" size="sm">{t('manipDetail.inclus')}</Badge> : null}</InfoRow>
        <InfoRow label={t('manipDetail.idTubeAdn')}>{d.idTubeAdn}</InfoRow>
        <InfoRow label={t('manipDetail.concentrationAdn')}>{d.concentrationAdn != null ? `${d.concentrationAdn} ng/µL` : null}</InfoRow>
        <InfoRow label="A260/A280">{d.pureteA260A280}</InfoRow>
        <InfoRow label="A260/A230">{d.pureteA260A230}</InfoRow>
        <InfoRow label={t('manipDetail.volumeFinal')}>{d.volumeFinalUl != null ? `${d.volumeFinalUl} µL` : null}</InfoRow>
      </Section>
    );
  }

  // — PCR Standard
  if (typ === 'amplification_pcr' && manip.pcr) {
    const d = manip.pcr;
    return (
      <div className="space-y-5">
        <Section title={t('manipDetail.sectionPcrProtocole')}>
          {d.pathogeneCible && <InfoRow label={t('manipDetail.pathogeneCible')}><Badge tone="default" size="sm">{d.pathogeneCible.nom}</Badge></InfoRow>}
          <InfoRow label={t('manipDetail.geneCible')}>{d.geneCible}</InfoRow>
          <InfoRow label={t('manipDetail.amorceForward')}>{d.amorceForward && <Mono>{d.amorceForward}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.amorceReverse')}>{d.amorceReverse && <Mono>{d.amorceReverse}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.enzymeMasterMix')}>{d.enzyme}</InfoRow>
          <InfoRow label={t('manipDetail.programmeThermocycleur')}>{d.programmeThermo && <Mono>{d.programmeThermo}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.tailleAttendue')}>{d.tailleAttenduePb != null ? `${d.tailleAttenduePb} pb` : null}</InfoRow>
          <InfoRow label={t('manipDetail.plaquePcr')}>{d.idPlaquePcr}</InfoRow>
          <InfoRow label={t('manipDetail.puits')}>{d.puitsPcr && <Badge tone="default" size="sm">{d.puitsPcr}</Badge>}</InfoRow>
          <InfoRow label={t('manipDetail.temoins')}>
            <span className="flex gap-2">
              {d.temoinPositif && <Badge tone="success" size="sm">{t('manipDetail.positifCheck')}</Badge>}
              {d.temoinNegatif && <Badge tone="info" size="sm">{t('manipDetail.negatifCheck')}</Badge>}
            </span>
          </InfoRow>
        </Section>
        <Section title={t('manipDetail.sectionResultatGel')}>
          <InfoRow label={t('manipDetail.statutBande')}><BandeBadge statut={d.statutBandeGel} /></InfoRow>
          <InfoRow label={t('manipDetail.tailleBandeObservee')}>{d.tailleBandePb != null ? `${d.tailleBandePb} pb` : null}</InfoRow>
          <GelImage path={d.imageGelPath} />
        </Section>
      </div>
    );
  }

  // — qPCR / RT-qPCR
  if (typ === 'qpcr' && manip.qpcr) {
    const d = manip.qpcr;
    return (
      <div className="space-y-5">
        <Section title={t('manipDetail.sectionQpcrProtocole')}>
          <InfoRow label={t('common.type')}>{d.typePcr}</InfoRow>
          {d.pathogeneCible && <InfoRow label={t('manipDetail.pathogeneCible')}><Badge tone="default" size="sm">{d.pathogeneCible.nom}</Badge></InfoRow>}
          <InfoRow label={t('manipDetail.geneCible')}>{d.geneCible}</InfoRow>
          <InfoRow label={t('manipDetail.geneReferenceInterne')}>{d.geneReference}</InfoRow>
          <InfoRow label={t('manipDetail.amorceForward')}>{d.amorceForward && <Mono>{d.amorceForward}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.amorceReverse')}>{d.amorceReverse && <Mono>{d.amorceReverse}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.sondeTaqman')}>{d.sondeTaqman && <Mono>{d.sondeTaqman}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.masterMix')}>{d.masterMix}</InfoRow>
          <InfoRow label={t('manipDetail.plaquePuits')}>
            {[d.idPlaqueQpcr, d.puitsQpcr].filter(Boolean).join(' — ') || null}
          </InfoRow>
        </Section>
        <Section title={t('manipDetail.sectionResultatsQuantitatifs')} accent="text-primary">
          <InfoRow label={t('manipDetail.ctSpecimen')}>{d.valeurCt != null ? <span className="font-mono text-lg">{d.valeurCt}</span> : null}</InfoRow>
          <InfoRow label={t('manipDetail.ctTemoinPos')}>{d.ctTemoinPositif != null ? `${d.ctTemoinPositif}` : null}</InfoRow>
          <InfoRow label={t('manipDetail.ctTemoinNeg')}>{d.ctTemoinNegatif != null ? `${d.ctTemoinNegatif}` : null}</InfoRow>
          <InfoRow label={t('manipDetail.ctControleInterne')}>{d.ctControleInterne != null ? `${d.ctControleInterne}` : null}</InfoRow>
          <InfoRow label={t('manipDetail.efficacite')}>{d.efficacitePct != null ? `${d.efficacitePct} %` : null}</InfoRow>
          <InfoRow label={t('manipDetail.interpretation')}><BandeBadge statut={d.interpretation} /></InfoRow>
        </Section>
      </div>
    );
  }

  // — Nested PCR
  if (typ === 'nested_pcr' && manip.nestedPcr) {
    const d = manip.nestedPcr;
    return (
      <div className="space-y-5">
        {d.pathogeneCible && (
          <InfoRow label={t('manipDetail.pathogeneCible')}><Badge tone="default" size="sm">{d.pathogeneCible.nom}</Badge></InfoRow>
        )}
        <InfoRow label={t('manipDetail.geneCible')}>{d.geneCible}</InfoRow>
        <div className="rounded-xl border border-info/30 bg-info/5 p-4">
          <p className="text-xs font-bold text-info mb-3">{t('manipDetail.round1Title')}</p>
          <InfoRow label={t('manipDetail.f1Label')}>{d.amorceF1 && <Mono>{d.amorceF1}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.r1Label')}>{d.amorceR1 && <Mono>{d.amorceR1}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.tailleAttendue')}>{d.tailleAttendue1 != null ? `${d.tailleAttendue1} pb` : null}</InfoRow>
          <InfoRow label={t('manipDetail.resultatRound1')}><BandeBadge statut={d.statutBande1} /></InfoRow>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-bold text-warning mb-3">{t('manipDetail.round2Title')}</p>
          <InfoRow label={t('manipDetail.f2Label')}>{d.amorceF2 && <Mono>{d.amorceF2}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.r2Label')}>{d.amorceR2 && <Mono>{d.amorceR2}</Mono>}</InfoRow>
          <InfoRow label={t('manipDetail.tailleAttendue')}>{d.tailleAttendue2 != null ? `${d.tailleAttendue2} pb` : null}</InfoRow>
          <InfoRow label={t('manipDetail.resultatRound2')}><BandeBadge statut={d.statutBande2} /></InfoRow>
        </div>
        <Section title={t('manipDetail.sectionResultatFinal')} accent="text-warning">
          <InfoRow label={t('manipDetail.statutFinal')}><BandeBadge statut={d.resultatFinal} /></InfoRow>
          <InfoRow label={t('manipDetail.plaqueId')}>{d.idPlaque}</InfoRow>
          <InfoRow label={t('manipDetail.temoins')}>
            <span className="flex gap-2">
              {d.temoinPositif && <Badge tone="success" size="sm">{t('manipDetail.positifCheck')}</Badge>}
              {d.temoinNegatif && <Badge tone="info" size="sm">{t('manipDetail.negatifCheck')}</Badge>}
            </span>
          </InfoRow>
          <GelImage path={d.imageGelPath} />
        </Section>
      </div>
    );
  }

  // — Séquençage
  if (typ === 'sequencage' && manip.sequencage) {
    const d = manip.sequencage;
    return (
      <div className="space-y-5">
        <Section title={t('manipDetail.sectionSequencageProtocole')}>
          <InfoRow label={t('manipDetail.methodeGeneric')}>{d.methodeSequencage}</InfoRow>
          <InfoRow label={t('manipDetail.prestataire')}>{d.prestataire}</InfoRow>
          <InfoRow label={t('manipDetail.idPlaqueTube')}>{d.idPlaqueTube}</InfoRow>
          <InfoRow label={t('manipDetail.amorceGeneric')}>{d.amorceSequencage}</InfoRow>
          {d.fichierRawPath && (
            <InfoRow label={t('manipDetail.fichierRaw')}>
              <button
                onClick={() => downloadAuthFile(`/uploads/${d.fichierRawPath}`, d.fichierRawPath.split('/').pop())}
                className="text-primary hover:underline text-xs"
              >
                {t('manipDetail.telechargerPrefix')} {d.fichierRawPath.split('/').pop()}
              </button>
            </InfoRow>
          )}
        </Section>
        {(d.organismeBlast || d.sequenceConsensus) && (
          <Section title={t('manipDetail.sectionResultatsBlast')} accent="text-primary">
            {d.organismeBlast && <InfoRow label={t('manipDetail.organismePlusProche')}><em>{d.organismeBlast}</em></InfoRow>}
            {d.identiteBlastPct != null && <InfoRow label={t('manipDetail.identiteBlast')}>{`${d.identiteBlastPct} %`}</InfoRow>}
            {d.couvertureBlastPct != null && <InfoRow label={t('manipDetail.couvertureBlast')}>{`${d.couvertureBlastPct} %`}</InfoRow>}
            {d.accessionGenbank && (
              <InfoRow label={t('manipDetail.accessionGenbank')}><Mono>{d.accessionGenbank}</Mono></InfoRow>
            )}
            {d.sequenceConsensus && (
              <div className="mt-3">
                <p className="text-xs text-fg-subtle mb-1.5">{t('manipDetail.sequenceConsensus')}</p>
                <pre className="text-xs font-mono bg-surface-2 border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                  {d.sequenceConsensus}
                </pre>
              </div>
            )}
          </Section>
        )}
      </div>
    );
  }

  // — Microscopie
  if (typ === 'microscopie' && manip.microscopie) {
    const d = manip.microscopie;
    return (
      <div className="space-y-5">
        <Section title={t('manipDetail.sectionMicroscopieParametres')}>
          <InfoRow label={t('manipDetail.typeExamen')}>{d.typeExamen?.replace(/_/g, ' ')}</InfoRow>
          <InfoRow label={t('manipDetail.coloration')}>{d.coloration}</InfoRow>
          <InfoRow label={t('manipDetail.grossissement')}>{d.grossissement}</InfoRow>
        </Section>
        <Section title={t('manipDetail.sectionResultats')} accent="text-danger">
          <InfoRow label={t('manipDetail.resultatLabel')}><BandeBadge statut={d.resultat} /></InfoRow>
          <InfoRow label={t('manipDetail.stadeObserve')}>{d.stadeObserve}</InfoRow>
          <InfoRow label={t('manipDetail.densiteParasitaire')}>{d.densiteParasitaire}</InfoRow>
          {d.observations && <div className="mt-3 p-3 bg-surface-2 rounded-lg text-sm text-fg">{d.observations}</div>}
          {d.imageMicroPath && (
            <div className="mt-4">
              <p className="text-xs text-fg-subtle mb-2">{t('manipDetail.photoMicroscopiqueCaption')}</p>
              <AuthImg src={`/uploads/${d.imageMicroPath}`} alt="Microscopie" className="max-h-64 rounded-lg border border-border object-contain" />
            </div>
          )}
        </Section>
      </div>
    );
  }

  return <p className="text-xs text-fg-subtle">{t('manipDetail.noModuleData')}</p>;
}

// ── Composant principal ───────────────────────────────────────

export default function ManipulationDetail() {
  const t = useT();
  const { id }      = useParams();
  const { user }    = useAuthStore();
  const isAdmin     = user?.role === 'admin';
  const isChercheur = ['admin', 'superviseur', 'chercheur'].includes(user?.role);

  const { data, loading, refetch } = useApiQuery(`/labo/${id}`);
  const manip = data?.manipulation;

  const [uploading,       setUploading]       = useState(false);
  const [showInvalidForm, setShowInvalidForm] = useState(false);
  const [motif,           setMotif]           = useState('');

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  if (!manip) {
    return (
      <div className="text-center py-20 text-fg-subtle">
        {t('manipDetail.notFound')}{' '}
        <Link to="/labo" className="text-primary hover:underline">{t('manipDetail.backWord')}</Link>
      </div>
    );
  }

  const typeConfig = getTypeConfig(t);
  const statutConfig = getStatutConfig(t);
  const cfg       = typeConfig[manip.typeManipulation] ?? typeConfig.autre;
  const statutCfg = statutConfig[manip.statut] ?? statutConfig.brut;
  const isLocked  = manip.statut === 'valide';
  const specimenLabels = {
    moustique: t('specimenTypes.moustique'),
    tique:     t('specimenTypes.tique'),
    puce:      t('specimenTypes.puce'),
    autre:     t('specimenTypes.autre'),
  };

  // Types nécessitant un upload gel
  const needsGel = ['amplification_pcr', 'nested_pcr'].includes(manip.typeManipulation);
  // Chemin image gel selon le type
  const gelPath  = manip.pcr?.imageGelPath ?? manip.nestedPcr?.imageGelPath;
  // Types nécessitant un upload fichier raw
  const needsFichier = manip.typeManipulation === 'sequencage';
  // Microscopie → upload photo
  const needsMicro = manip.typeManipulation === 'microscopie';

  const handleValider = async () => {
    const ok = await dialog.confirm({
      title:   t('manipDetail.validerDialogTitle'),
      message: t('manipDetail.validerDialogMessage'),
    });
    if (!ok) return;
    try {
      await api.post(`/labo/${id}/valider`);
      toast.success(t('manipDetail.validerSuccess'));
      refetch();
    } catch (err) { toast.error(err.response?.data?.error || t('manipDetail.errorGeneric')); }
  };

  const handleInvalider = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/labo/${id}/invalider`, { motifInvalidation: motif });
      toast.success(t('manipDetail.invaliderSuccess'));
      setShowInvalidForm(false);
      setMotif('');
      refetch();
    } catch (err) { toast.error(err.response?.data?.error || t('manipDetail.errorGeneric')); }
  };

  const handleUpload = async (e, subtype) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      await api.post(`/labo/${id}/upload/${subtype}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(subtype === 'fichier' ? t('manipDetail.fileUploadedSuccess') : t('manipDetail.imageUploadedSuccess'));
      refetch();
    } catch (err) { toast.error(err.response?.data?.error || t('manipDetail.uploadErrorGeneric')); }
    finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div className="max-w-screen-2xl space-y-4">

      <Link to="/labo" className="inline-flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg transition-colors group">
        <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        {t('manipDetail.backToLabo')}
      </Link>

      {/* En-tête */}
      <div className="flex flex-wrap items-start gap-4 justify-between pb-1">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg}`}>
            <cfg.Icon size={18} className={cfg.color} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-fg">{cfg.label}</h1>
            <p className="text-xs text-fg-subtle">
              {specimenLabels[manip.specimenType] ?? manip.specimenType}
              {manip.specimenId ? ` #${manip.specimenId}` : ''}
              {manip.pool && ` — ${t('manipDetail.poolPrefix')} #${manip.pool.id}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={statutCfg.tone}>{statutCfg.label}</Badge>
          {!isLocked && isChercheur && (
            <Button size="sm" icon={ShieldCheck} onClick={handleValider}>{t('manipDetail.validerBtn')}</Button>
          )}
          {isLocked && isChercheur && (
            <Button size="sm" variant="danger" icon={ShieldAlert}
              onClick={() => setShowInvalidForm((v) => !v)}>
              {t('manipDetail.invaliderBtn')}
            </Button>
          )}
        </div>
      </div>

      {/* Formulaire invalidation */}
      {showInvalidForm && (
        <div className="card p-5 border border-danger/30">
          <form onSubmit={handleInvalider} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-danger mb-1.5">{t('manipDetail.motifLabel')}</label>
              <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)}
                placeholder={t('manipDetail.motifPlaceholder')}
                className="input-base w-full text-sm border-danger/30" />
            </div>
            <Button type="submit" size="sm" variant="danger" icon={Check}>{t('manipDetail.confirmBtn')}</Button>
            <Button type="button" size="sm" variant="ghost" icon={X}
              onClick={() => setShowInvalidForm(false)}>{t('manipDetail.cancelBtn')}</Button>
          </form>
        </div>
      )}

      {manip.statut === 'invalide' && manip.motifInvalidation && (
        <div className="p-4 bg-danger/5 border border-danger/20 rounded-xl flex gap-3">
          <AlertTriangle size={15} className="text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-danger mb-0.5">{t('manipDetail.resultatInvalideTitle')}</p>
            <p className="text-sm text-fg">{manip.motifInvalidation}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] 2xl:grid-cols-[1fr_360px] gap-5 2xl:gap-8 items-start">

        {/* ── Colonne principale ── */}
        <div className="space-y-4">

          {/* Données scientifiques du module */}
          <Card padding="lg">
            <ModuleDetails manip={manip} />
          </Card>

          {/* Upload fichiers */}
          {(needsGel || needsFichier || needsMicro) && (
            <Card padding="lg">
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-4">{t('manipDetail.filesAttachedTitle')}</p>
              <div className="flex items-center gap-3 flex-wrap">
                {needsGel && (
                  <>
                    <UploadBtn subtype="gel" accept=".jpg,.jpeg,.png,.tif,.tiff"
                      hasFile={!!gelPath}
                      label={t('manipDetail.uploadGelLabel')} replaceLabel={t('manipDetail.replaceGelLabel')}
                      uploading={uploading} uploadingLabel={t('manipDetail.uploadingLabel')}
                      disabled={isLocked && !isAdmin} onUpload={handleUpload} />
                    {gelPath && <Badge tone="success" size="sm">{t('manipDetail.imagePresentBadge')}</Badge>}
                  </>
                )}
                {needsFichier && (
                  <>
                    <UploadBtn subtype="fichier" accept=".ab1,.fastq,.fq,.gz,.fasta,.fa,.seq"
                      hasFile={!!manip.sequencage?.fichierRawPath}
                      label={t('manipDetail.uploadFichierLabel')} replaceLabel={t('manipDetail.replaceFichierLabel')}
                      uploading={uploading} uploadingLabel={t('manipDetail.uploadingLabel')}
                      disabled={isLocked && !isAdmin} onUpload={handleUpload} />
                    {manip.sequencage?.fichierRawPath && <Badge tone="success" size="sm">{t('manipDetail.filePresentBadge')}</Badge>}
                  </>
                )}
                {needsMicro && (
                  <>
                    <UploadBtn subtype="micro" accept=".jpg,.jpeg,.png,.tif,.tiff"
                      hasFile={!!manip.microscopie?.imageMicroPath}
                      label={t('manipDetail.uploadPhotoLabel')} replaceLabel={t('manipDetail.replacePhotoLabel')}
                      uploading={uploading} uploadingLabel={t('manipDetail.uploadingLabel')}
                      disabled={isLocked && !isAdmin} onUpload={handleUpload} />
                    {manip.microscopie?.imageMicroPath && <Badge tone="success" size="sm">{t('manipDetail.photoPresentBadge')}</Badge>}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Notes */}
          {manip.notes && (
            <Card padding="lg">
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-3">{t('common.notes')}</p>
              <p className="text-sm text-fg whitespace-pre-wrap">{manip.notes}</p>
            </Card>
          )}

          {/* Timeline événements */}
          {manip.events?.length > 0 && (
            <Card padding="lg">
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-4">{t('manipDetail.historiqueTitle')}</p>
              <div className="space-y-3">
                {manip.events.map((ev) => {
                  const evCfg = getEventIcons(t)[ev.typeEvent] ?? { label: ev.typeEvent, color: 'bg-fg-muted' };
                  return (
                    <div key={ev.id} className="flex gap-3 items-start">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${evCfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-fg">{evCfg.label}</span>
                          <span className="text-[11px] text-fg-subtle">
                            {t('manipDetail.parPrefix')} {ev.operateur?.prenom} {ev.operateur?.nom}
                          </span>
                          <span className="text-[11px] text-fg-subtle ml-auto">
                            {new Date(ev.dateHeure).toLocaleString(t('common.locale'))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* ── Sidebar sticky ── */}
        <div className="xl:sticky xl:top-5 space-y-4">
          <Card padding="md">
            <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-3">{t('manipDetail.informationsTitle')}</p>
            <InfoRow label={t('manipDetail.protocoleSopLabel')}>{manip.protocole}</InfoRow>
            <InfoRow label={t('manipDetail.dateDebutLabel')}>{new Date(manip.dateDebut).toLocaleString(t('common.locale'))}</InfoRow>
            {manip.dateFin && (
              <InfoRow label={t('manipDetail.dateFinLabel')}>{new Date(manip.dateFin).toLocaleString(t('common.locale'))}</InfoRow>
            )}
          </Card>

          <Card padding="md">
            <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-3">{t('manipDetail.tracabiliteTitle')}</p>
            <InfoRow label={t('laboPage.colOperateur')}>
              <span className="flex items-center gap-1.5">
                <User size={12} className="text-fg-subtle" />
                {manip.operateur?.prenom} {manip.operateur?.nom}
              </span>
            </InfoRow>
            {manip.validePar && (
              <InfoRow label={t('manipDetail.valideParLabel')}>
                <span className="flex items-center gap-1.5 text-success">
                  <ShieldCheck size={12} />
                  {manip.validePar?.prenom} {manip.validePar?.nom}
                  {manip.valideLe && (
                    <span className="text-fg-subtle font-normal text-[10px] ml-1">
                      {new Date(manip.valideLe).toLocaleDateString(t('common.locale'))}
                    </span>
                  )}
                </span>
              </InfoRow>
            )}
            <InfoRow label={t('manipDetail.creeLeLabel')}>{new Date(manip.createdAt).toLocaleString(t('common.locale'))}</InfoRow>
          </Card>
        </div>

      </div>
    </div>
  );
}
