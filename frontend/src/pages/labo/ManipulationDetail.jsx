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

// ── Config ────────────────────────────────────────────────────

const TYPE_CONFIG = {
  identification_morpho: { label: 'Identification morphologique', Icon: Eye,          color: 'text-fg-muted',  bg: 'bg-surface-2'   },
  broyage_pool:          { label: 'Broyage / Pool',               Icon: Layers,       color: 'text-info',      bg: 'bg-info/10'     },
  dessication:           { label: 'Dessication',                   Icon: TestTube,     color: 'text-info',      bg: 'bg-info/10'     },
  extraction:            { label: 'Extraction ADN/ARN',            Icon: Dna,          color: 'text-success',   bg: 'bg-success/10'  },
  amplification_pcr:     { label: 'PCR Standard',                  Icon: Zap,          color: 'text-warning',   bg: 'bg-warning/10'  },
  qpcr:                  { label: 'qPCR / RT-qPCR',                Icon: Activity,     color: 'text-primary',   bg: 'bg-primary/10'  },
  nested_pcr:            { label: 'PCR Nichée (Nested)',            Icon: GitBranch,    color: 'text-warning',   bg: 'bg-warning/10'  },
  sequencage:            { label: 'Séquençage',                     Icon: Waves,        color: 'text-primary',   bg: 'bg-primary/10'  },
  microscopie:           { label: 'Microscopie',                    Icon: Microscope,   color: 'text-danger',    bg: 'bg-danger/10'   },
  autre:                 { label: 'Autre',                          Icon: FlaskConical, color: 'text-fg-muted',  bg: 'bg-surface-2'   },
};

const STATUT_CONFIG = {
  brut:     { label: 'Brut',     tone: 'default', Icon: FileEdit    },
  valide:   { label: 'Validé',   tone: 'success', Icon: ShieldCheck },
  invalide: { label: 'Invalide', tone: 'danger',  Icon: ShieldAlert },
};

const SPECIMEN_LABELS = {
  moustique: 'Moustique',
  tique:     'Tique',
  puce:      'Puce',
  autre:     'Autre spécimen',
};

const EVENT_ICONS = {
  CREATION:       { label: 'Créé',            color: 'bg-primary' },
  MODIFICATION:   { label: 'Modifié',         color: 'bg-info'    },
  VALIDATION:     { label: 'Validé',          color: 'bg-success' },
  INVALIDATION:   { label: 'Invalidé',        color: 'bg-danger'  },
  UPLOAD_GEL:     { label: 'Gel uploadé',     color: 'bg-warning' },
  UPLOAD_MICRO:   { label: 'Photo micro uploadée', color: 'bg-warning' },
  UPLOAD_FICHIER: { label: 'Fichier uploadé', color: 'bg-warning' },
};


// ── Helpers ───────────────────────────────────────────────────

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
  if (!path) return null;
  return (
    <div className="mt-4">
      <p className="text-xs text-fg-subtle mb-2">Image gel d'électrophorèse</p>
      <AuthImg src={`/uploads/${path}`} alt="Gel" className="max-h-64 rounded-lg border border-border object-contain" />
    </div>
  );
}

// ── ModuleDetails — 9 branches ────────────────────────────────

function ModuleDetails({ manip }) {
  const t = manip.typeManipulation;

  // — Identification morphologique
  if (t === 'identification_morpho' && manip.identificationMorpho) {
    const d = manip.identificationMorpho;
    return (
      <Section title="Identification morphologique">
        <InfoRow label="Clé dichotomique">{d.cleUtilisee}</InfoRow>
        <InfoRow label="Espèce identifiée">
          {d.especeIdentifiee && <em>{d.especeIdentifiee}</em>}
        </InfoRow>
        <InfoRow label="Niveau de confiance">
          {d.niveauConfiance && (
            <Badge tone={d.niveauConfiance === 'certain' ? 'success' : d.niveauConfiance === 'douteux' ? 'danger' : 'default'} size="sm">
              {d.niveauConfiance.charAt(0).toUpperCase() + d.niveauConfiance.slice(1)}
            </Badge>
          )}
        </InfoRow>
        <InfoRow label="Stade confirmé">{d.stadeConfirme}</InfoRow>
        <InfoRow label="Gorgement">{d.gorgement}</InfoRow>
        <InfoRow label="Méthode parité">{d.pariteMethode}</InfoRow>
        <InfoRow label="Résultat parité">{d.pariteResultat}</InfoRow>
        <InfoRow label="Parties prélevées">{d.partiesPrelevees}</InfoRow>
        {d.observations && (
          <div className="mt-3 p-3 bg-surface-2 rounded-lg text-sm text-fg">{d.observations}</div>
        )}
      </Section>
    );
  }

  // — Broyage / Pool
  if (t === 'broyage_pool' && manip.broyagePool) {
    const d = manip.broyagePool;
    return (
      <Section title="Broyage de pool">
        <InfoRow label="Méthode de broyage">{d.methodeBroyage}</InfoRow>
        <InfoRow label="Tampon utilisé">{d.tamponUtilise}</InfoRow>
        <InfoRow label="Volume tampon">{d.volumeTamponUl != null ? `${d.volumeTamponUl} µL` : null}</InfoRow>
        <InfoRow label="Paramètres broyeur">{d.parametresBroyeur}</InfoRow>
        <InfoRow label="Volume récupéré">{d.volumeRecupereUl != null ? `${d.volumeRecupereUl} µL` : null}</InfoRow>
        <InfoRow label="Aspect macroscopique">{d.aspectMacro}</InfoRow>
      </Section>
    );
  }

  // — Dessication
  if (t === 'dessication' && manip.dessication) {
    const d = manip.dessication;
    return (
      <Section title="Dessication">
        <InfoRow label="Méthode">{d.methode}</InfoRow>
        <InfoRow label="Température stockage">{d.temperatureStockage}</InfoRow>
        <InfoRow label="Durée dessication">{d.dureeDessicationH != null ? `${d.dureeDessicationH} h` : null}</InfoRow>
        <InfoRow label="Silica gel">{d.quantiteSilicaGelG != null ? `${d.quantiteSilicaGelG} g` : null}</InfoRow>
        <InfoRow label="Date conservation">
          {d.dateMiseConservation ? new Date(d.dateMiseConservation).toLocaleDateString('fr-FR') : null}
        </InfoRow>
        <InfoRow label="Partie du corps">{d.partieCorps}</InfoRow>
        <InfoRow label="Statut tissu">{d.statutTissu}</InfoRow>
        <InfoRow label="Emplacement">{d.emplacementCode}</InfoRow>
      </Section>
    );
  }

  // — Extraction ADN/ARN
  if (t === 'extraction' && manip.extraction) {
    const d = manip.extraction;
    return (
      <Section title="Extraction ADN/ARN">
        <InfoRow label="Type acide nucléique">
          {d.typeAcideNucleique ? d.typeAcideNucleique.toUpperCase().replace('_', '/') : null}
        </InfoRow>
        <InfoRow label="Kit">{d.typeKit}</InfoRow>
        <InfoRow label="Méthode extraction">{d.methodeExtraction === 'destructive' ? 'Destructive' : d.methodeExtraction === 'non_destructive' ? 'Non-destructive' : null}</InfoRow>
        <InfoRow label="Homogénéisation">{d.methodeHomogeneisation}</InfoRow>
        <InfoRow label="Quantité tissu">{d.quantiteTissuMg != null ? `${d.quantiteTissuMg} mg` : null}</InfoRow>
        <InfoRow label="N° lot kit">{d.numerotLot}</InfoRow>
        <InfoRow label="Volume élution">{d.volumeElutionUl != null ? `${d.volumeElutionUl} µL` : null}</InfoRow>
        <InfoRow label="Témoin négatif extraction">{d.controlExtraction ? <Badge tone="info" size="sm">Inclus</Badge> : null}</InfoRow>
        <InfoRow label="ID tube ADN/ARN">{d.idTubeAdn}</InfoRow>
        <InfoRow label="Concentration ADN">{d.concentrationAdn != null ? `${d.concentrationAdn} ng/µL` : null}</InfoRow>
        <InfoRow label="A260/A280">{d.pureteA260A280}</InfoRow>
        <InfoRow label="A260/A230">{d.pureteA260A230}</InfoRow>
        <InfoRow label="Volume final">{d.volumeFinalUl != null ? `${d.volumeFinalUl} µL` : null}</InfoRow>
      </Section>
    );
  }

  // — PCR Standard
  if (t === 'amplification_pcr' && manip.pcr) {
    const d = manip.pcr;
    return (
      <div className="space-y-5">
        <Section title="PCR Standard — protocole">
          {d.pathogeneCible && <InfoRow label="Pathogène ciblé"><Badge tone="default" size="sm">{d.pathogeneCible.nom}</Badge></InfoRow>}
          <InfoRow label="Gène cible">{d.geneCible}</InfoRow>
          <InfoRow label="Amorce Forward">{d.amorceForward && <Mono>{d.amorceForward}</Mono>}</InfoRow>
          <InfoRow label="Amorce Reverse">{d.amorceReverse && <Mono>{d.amorceReverse}</Mono>}</InfoRow>
          <InfoRow label="Enzyme / Master Mix">{d.enzyme}</InfoRow>
          <InfoRow label="Programme thermocycleur">{d.programmeThermo && <Mono>{d.programmeThermo}</Mono>}</InfoRow>
          <InfoRow label="Taille attendue">{d.tailleAttenduePb != null ? `${d.tailleAttenduePb} pb` : null}</InfoRow>
          <InfoRow label="Plaque PCR">{d.idPlaquePcr}</InfoRow>
          <InfoRow label="Puits">{d.puitsPcr && <Badge tone="default" size="sm">{d.puitsPcr}</Badge>}</InfoRow>
          <InfoRow label="Témoins">
            <span className="flex gap-2">
              {d.temoinPositif && <Badge tone="success" size="sm">Positif ✓</Badge>}
              {d.temoinNegatif && <Badge tone="info" size="sm">Négatif ✓</Badge>}
            </span>
          </InfoRow>
        </Section>
        <Section title="Résultat gel">
          <InfoRow label="Statut bande"><BandeBadge statut={d.statutBandeGel} /></InfoRow>
          <InfoRow label="Taille bande observée">{d.tailleBandePb != null ? `${d.tailleBandePb} pb` : null}</InfoRow>
          <GelImage path={d.imageGelPath} />
        </Section>
      </div>
    );
  }

  // — qPCR / RT-qPCR
  if (t === 'qpcr' && manip.qpcr) {
    const d = manip.qpcr;
    return (
      <div className="space-y-5">
        <Section title="qPCR — protocole">
          <InfoRow label="Type">{d.typePcr}</InfoRow>
          {d.pathogeneCible && <InfoRow label="Pathogène ciblé"><Badge tone="default" size="sm">{d.pathogeneCible.nom}</Badge></InfoRow>}
          <InfoRow label="Gène cible">{d.geneCible}</InfoRow>
          <InfoRow label="Gène référence interne">{d.geneReference}</InfoRow>
          <InfoRow label="Amorce Forward">{d.amorceForward && <Mono>{d.amorceForward}</Mono>}</InfoRow>
          <InfoRow label="Amorce Reverse">{d.amorceReverse && <Mono>{d.amorceReverse}</Mono>}</InfoRow>
          <InfoRow label="Sonde TaqMan">{d.sondeTaqman && <Mono>{d.sondeTaqman}</Mono>}</InfoRow>
          <InfoRow label="Master Mix">{d.masterMix}</InfoRow>
          <InfoRow label="Plaque / Puits">
            {[d.idPlaqueQpcr, d.puitsQpcr].filter(Boolean).join(' — ') || null}
          </InfoRow>
        </Section>
        <Section title="Résultats quantitatifs" accent="text-primary">
          <InfoRow label="Ct spécimen">{d.valeurCt != null ? <span className="font-mono text-lg">{d.valeurCt}</span> : null}</InfoRow>
          <InfoRow label="Ct témoin +">{d.ctTemoinPositif != null ? `${d.ctTemoinPositif}` : null}</InfoRow>
          <InfoRow label="Ct témoin −">{d.ctTemoinNegatif != null ? `${d.ctTemoinNegatif}` : null}</InfoRow>
          <InfoRow label="Ct contrôle interne">{d.ctControleInterne != null ? `${d.ctControleInterne}` : null}</InfoRow>
          <InfoRow label="Efficacité">{d.efficacitePct != null ? `${d.efficacitePct} %` : null}</InfoRow>
          <InfoRow label="Interprétation"><BandeBadge statut={d.interpretation} /></InfoRow>
        </Section>
      </div>
    );
  }

  // — Nested PCR
  if (t === 'nested_pcr' && manip.nestedPcr) {
    const d = manip.nestedPcr;
    return (
      <div className="space-y-5">
        {d.pathogeneCible && (
          <InfoRow label="Pathogène ciblé"><Badge tone="default" size="sm">{d.pathogeneCible.nom}</Badge></InfoRow>
        )}
        <InfoRow label="Gène cible">{d.geneCible}</InfoRow>
        <div className="rounded-xl border border-info/30 bg-info/5 p-4">
          <p className="text-xs font-bold text-info mb-3">Round 1 — Amorces externes</p>
          <InfoRow label="F1">{d.amorceF1 && <Mono>{d.amorceF1}</Mono>}</InfoRow>
          <InfoRow label="R1">{d.amorceR1 && <Mono>{d.amorceR1}</Mono>}</InfoRow>
          <InfoRow label="Taille attendue">{d.tailleAttendue1 != null ? `${d.tailleAttendue1} pb` : null}</InfoRow>
          <InfoRow label="Résultat Round 1"><BandeBadge statut={d.statutBande1} /></InfoRow>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-bold text-warning mb-3">Round 2 — Amorces internes</p>
          <InfoRow label="F2">{d.amorceF2 && <Mono>{d.amorceF2}</Mono>}</InfoRow>
          <InfoRow label="R2">{d.amorceR2 && <Mono>{d.amorceR2}</Mono>}</InfoRow>
          <InfoRow label="Taille attendue">{d.tailleAttendue2 != null ? `${d.tailleAttendue2} pb` : null}</InfoRow>
          <InfoRow label="Résultat Round 2"><BandeBadge statut={d.statutBande2} /></InfoRow>
        </div>
        <Section title="Résultat final" accent="text-warning">
          <InfoRow label="Statut final"><BandeBadge statut={d.resultatFinal} /></InfoRow>
          <InfoRow label="Plaque / ID">{d.idPlaque}</InfoRow>
          <InfoRow label="Témoins">
            <span className="flex gap-2">
              {d.temoinPositif && <Badge tone="success" size="sm">Positif ✓</Badge>}
              {d.temoinNegatif && <Badge tone="info" size="sm">Négatif ✓</Badge>}
            </span>
          </InfoRow>
          <GelImage path={d.imageGelPath} />
        </Section>
      </div>
    );
  }

  // — Séquençage
  if (t === 'sequencage' && manip.sequencage) {
    const d = manip.sequencage;
    return (
      <div className="space-y-5">
        <Section title="Séquençage — protocole">
          <InfoRow label="Méthode">{d.methodeSequencage}</InfoRow>
          <InfoRow label="Prestataire">{d.prestataire}</InfoRow>
          <InfoRow label="ID plaque/tube">{d.idPlaqueTube}</InfoRow>
          <InfoRow label="Amorce">{d.amorceSequencage}</InfoRow>
          {d.fichierRawPath && (
            <InfoRow label="Fichier raw">
              <button
                onClick={() => downloadAuthFile(`/uploads/${d.fichierRawPath}`, d.fichierRawPath.split('/').pop())}
                className="text-primary hover:underline text-xs"
              >
                Télécharger {d.fichierRawPath.split('/').pop()}
              </button>
            </InfoRow>
          )}
        </Section>
        {(d.organismeBlast || d.sequenceConsensus) && (
          <Section title="Résultats BLAST" accent="text-primary">
            {d.organismeBlast && <InfoRow label="Organisme le + proche"><em>{d.organismeBlast}</em></InfoRow>}
            {d.identiteBlastPct != null && <InfoRow label="Identité BLAST">{`${d.identiteBlastPct} %`}</InfoRow>}
            {d.couvertureBlastPct != null && <InfoRow label="Couverture BLAST">{`${d.couvertureBlastPct} %`}</InfoRow>}
            {d.accessionGenbank && (
              <InfoRow label="Accession GenBank"><Mono>{d.accessionGenbank}</Mono></InfoRow>
            )}
            {d.sequenceConsensus && (
              <div className="mt-3">
                <p className="text-xs text-fg-subtle mb-1.5">Séquence consensus</p>
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
  if (t === 'microscopie' && manip.microscopie) {
    const d = manip.microscopie;
    return (
      <div className="space-y-5">
        <Section title="Microscopie — paramètres">
          <InfoRow label="Type d'examen">{d.typeExamen?.replace(/_/g, ' ')}</InfoRow>
          <InfoRow label="Coloration">{d.coloration}</InfoRow>
          <InfoRow label="Grossissement">{d.grossissement}</InfoRow>
        </Section>
        <Section title="Résultats" accent="text-danger">
          <InfoRow label="Résultat"><BandeBadge statut={d.resultat} /></InfoRow>
          <InfoRow label="Stade observé">{d.stadeObserve}</InfoRow>
          <InfoRow label="Densité parasitaire">{d.densiteParasitaire}</InfoRow>
          {d.observations && <div className="mt-3 p-3 bg-surface-2 rounded-lg text-sm text-fg">{d.observations}</div>}
          {d.imageMicroPath && (
            <div className="mt-4">
              <p className="text-xs text-fg-subtle mb-2">Photo microscopique</p>
              <AuthImg src={`/uploads/${d.imageMicroPath}`} alt="Microscopie" className="max-h-64 rounded-lg border border-border object-contain" />
            </div>
          )}
        </Section>
      </div>
    );
  }

  return <p className="text-xs text-fg-subtle">Aucune donnée de module enregistrée.</p>;
}

// ── Composant principal ───────────────────────────────────────

export default function ManipulationDetail() {
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
        Manipulation introuvable —{' '}
        <Link to="/labo" className="text-primary hover:underline">retour</Link>
      </div>
    );
  }

  const cfg       = TYPE_CONFIG[manip.typeManipulation] ?? TYPE_CONFIG.autre;
  const statutCfg = STATUT_CONFIG[manip.statut] ?? STATUT_CONFIG.brut;
  const isLocked  = manip.statut === 'valide';

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
      title:   'Valider cette manipulation ?',
      message: 'Les données seront verrouillées. Seul un administrateur pourra les modifier.',
    });
    if (!ok) return;
    try {
      await api.post(`/labo/${id}/valider`);
      toast.success('Manipulation validée');
      refetch();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const handleInvalider = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/labo/${id}/invalider`, { motifInvalidation: motif });
      toast.success('Manipulation invalidée');
      setShowInvalidForm(false);
      setMotif('');
      refetch();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const handleUpload = async (e, subtype) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      await api.post(`/labo/${id}/upload/${subtype}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(subtype === 'fichier' ? 'Fichier uploadé' : 'Image uploadée');
      refetch();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur upload'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const UploadBtn = ({ subtype, accept, hasFile, label, replaceLabel }) => (
    <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-2 transition-colors cursor-pointer text-sm font-medium text-fg ${(isLocked && !isAdmin) ? 'opacity-40 pointer-events-none' : ''}`}>
      <Upload size={14} />
      {uploading ? 'Upload…' : hasFile ? replaceLabel : label}
      <input type="file" accept={accept} onChange={(e) => handleUpload(e, subtype)}
        className="hidden" disabled={uploading || (isLocked && !isAdmin)} />
    </label>
  );

  return (
    <div className="max-w-screen-2xl space-y-4">

      <Link to="/labo" className="inline-flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg transition-colors group">
        <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Laboratoire
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
              {SPECIMEN_LABELS[manip.specimenType] ?? manip.specimenType}
              {manip.specimenId ? ` #${manip.specimenId}` : ''}
              {manip.pool && ` — Pool #${manip.pool.id}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={statutCfg.tone}>{statutCfg.label}</Badge>
          {!isLocked && isChercheur && (
            <Button size="sm" icon={ShieldCheck} onClick={handleValider}>Valider</Button>
          )}
          {isLocked && isChercheur && (
            <Button size="sm" variant="danger" icon={ShieldAlert}
              onClick={() => setShowInvalidForm((v) => !v)}>
              Invalider
            </Button>
          )}
        </div>
      </div>

      {/* Formulaire invalidation */}
      {showInvalidForm && (
        <div className="card p-5 border border-danger/30">
          <form onSubmit={handleInvalider} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-danger mb-1.5">Motif d'invalidation</label>
              <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)}
                placeholder="Expliquez la raison…"
                className="input-base w-full text-sm border-danger/30" />
            </div>
            <Button type="submit" size="sm" variant="danger" icon={Check}>Confirmer</Button>
            <Button type="button" size="sm" variant="ghost" icon={X}
              onClick={() => setShowInvalidForm(false)}>Annuler</Button>
          </form>
        </div>
      )}

      {manip.statut === 'invalide' && manip.motifInvalidation && (
        <div className="p-4 bg-danger/5 border border-danger/20 rounded-xl flex gap-3">
          <AlertTriangle size={15} className="text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-danger mb-0.5">Résultat invalidé</p>
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
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-4">Fichiers attachés</p>
              <div className="flex items-center gap-3 flex-wrap">
                {needsGel && (
                  <>
                    <UploadBtn subtype="gel" accept=".jpg,.jpeg,.png,.tif,.tiff"
                      hasFile={!!gelPath}
                      label="Uploader image gel" replaceLabel="Remplacer image gel" />
                    {gelPath && <Badge tone="success" size="sm">Image présente</Badge>}
                  </>
                )}
                {needsFichier && (
                  <>
                    <UploadBtn subtype="fichier" accept=".ab1,.fastq,.fq,.gz,.fasta,.fa,.seq"
                      hasFile={!!manip.sequencage?.fichierRawPath}
                      label="Uploader .ab1 / .fastq" replaceLabel="Remplacer le fichier raw" />
                    {manip.sequencage?.fichierRawPath && <Badge tone="success" size="sm">Fichier présent</Badge>}
                  </>
                )}
                {needsMicro && (
                  <>
                    <UploadBtn subtype="micro" accept=".jpg,.jpeg,.png,.tif,.tiff"
                      hasFile={!!manip.microscopie?.imageMicroPath}
                      label="Uploader photo microscopique" replaceLabel="Remplacer la photo" />
                    {manip.microscopie?.imageMicroPath && <Badge tone="success" size="sm">Photo présente</Badge>}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Notes */}
          {manip.notes && (
            <Card padding="lg">
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-3">Notes</p>
              <p className="text-sm text-fg whitespace-pre-wrap">{manip.notes}</p>
            </Card>
          )}

          {/* Timeline événements */}
          {manip.events?.length > 0 && (
            <Card padding="lg">
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-4">Historique</p>
              <div className="space-y-3">
                {manip.events.map((ev) => {
                  const evCfg = EVENT_ICONS[ev.typeEvent] ?? { label: ev.typeEvent, color: 'bg-fg-muted' };
                  return (
                    <div key={ev.id} className="flex gap-3 items-start">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${evCfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-fg">{evCfg.label}</span>
                          <span className="text-[11px] text-fg-subtle">
                            par {ev.operateur?.prenom} {ev.operateur?.nom}
                          </span>
                          <span className="text-[11px] text-fg-subtle ml-auto">
                            {new Date(ev.dateHeure).toLocaleString('fr-FR')}
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
            <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-3">Informations</p>
            <InfoRow label="Protocole SOP">{manip.protocole}</InfoRow>
            <InfoRow label="Date début">{new Date(manip.dateDebut).toLocaleString('fr-FR')}</InfoRow>
            {manip.dateFin && (
              <InfoRow label="Date fin">{new Date(manip.dateFin).toLocaleString('fr-FR')}</InfoRow>
            )}
          </Card>

          <Card padding="md">
            <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-3">Traçabilité</p>
            <InfoRow label="Opérateur">
              <span className="flex items-center gap-1.5">
                <User size={12} className="text-fg-subtle" />
                {manip.operateur?.prenom} {manip.operateur?.nom}
              </span>
            </InfoRow>
            {manip.validePar && (
              <InfoRow label="Validé par">
                <span className="flex items-center gap-1.5 text-success">
                  <ShieldCheck size={12} />
                  {manip.validePar?.prenom} {manip.validePar?.nom}
                  {manip.valideLe && (
                    <span className="text-fg-subtle font-normal text-[10px] ml-1">
                      {new Date(manip.valideLe).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </span>
              </InfoRow>
            )}
            <InfoRow label="Créé le">{new Date(manip.createdAt).toLocaleString('fr-FR')}</InfoRow>
          </Card>
        </div>

      </div>
    </div>
  );
}
