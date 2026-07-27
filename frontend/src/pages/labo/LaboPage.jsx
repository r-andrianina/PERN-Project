import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, FlaskConical, ShieldCheck, ShieldAlert, FileEdit,
  Dna, TestTube, Waves, Zap, GitBranch, Layers, Eye, Microscope, Activity,
  ChevronDown, Check, SlidersHorizontal,
} from 'lucide-react';
import { Card, Button, Badge, EmptyState, PageHeader, Spinner, Pagination, DataTable } from '../../components/ui';
import { useApiQuery } from '../../hooks';

// ── Config ────────────────────────────────────────────────────

const TYPE_CONFIG = {
  identification_morpho: { label: 'Morphologie',          Icon: Eye,          color: 'text-fg-muted'  },
  broyage_pool:          { label: 'Broyage / Pool',       Icon: Layers,       color: 'text-info'      },
  dessication:           { label: 'Dessication',           Icon: TestTube,     color: 'text-info'      },
  extraction:            { label: 'Extraction ADN/ARN',    Icon: Dna,          color: 'text-success'   },
  amplification_pcr:     { label: 'PCR Standard',          Icon: Zap,          color: 'text-warning'   },
  qpcr:                  { label: 'qPCR / RT-qPCR',        Icon: Activity,     color: 'text-primary'   },
  nested_pcr:            { label: 'Nested PCR',             Icon: GitBranch,    color: 'text-warning'   },
  sequencage:            { label: 'Séquençage',             Icon: Waves,        color: 'text-primary'   },
  microscopie:           { label: 'Microscopie',            Icon: Microscope,   color: 'text-danger'    },
  autre:                 { label: 'Autre',                  Icon: FlaskConical, color: 'text-fg-muted'  },
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

// ── FilterSelect — dropdown custom ───────────────────────────

function FilterSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);
  const isActive = !!value;

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium
          transition-all duration-150 select-none outline-none
          focus-visible:ring-2 focus-visible:ring-primary/30
          ${isActive
            ? 'border-primary/40 bg-primary/8 text-primary shadow-card'
            : 'border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg hover:border-border-strong hover:shadow-card'
          }
        `}
      >
        {selected?.Icon
          ? <selected.Icon size={13} className={isActive ? (selected.color ?? 'text-primary') : 'text-fg-subtle'} />
          : <span className="w-[13px]" />
        }
        <span className={isActive ? 'text-primary' : 'text-fg-muted'}>
          {isActive ? selected?.label : label}
        </span>
        <ChevronDown
          size={13}
          className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isActive ? 'text-primary/60' : 'text-fg-subtle'}`}
        />
      </button>

      {/* Panel */}
      {open && (
        <div className="
          absolute top-full mt-2 left-0 z-40
          bg-surface border border-border rounded-2xl
          shadow-card-lg overflow-hidden
          min-w-[200px] py-1.5
        ">
          {/* En-tête discret */}
          <p className="px-3.5 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-fg-subtle border-b border-border mb-1">
            {label}
          </p>
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`
                  w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors duration-100
                  ${isSel
                    ? 'bg-primary/8 text-primary font-semibold'
                    : 'text-fg hover:bg-surface-2'
                  }
                `}
              >
                {opt.Icon
                  ? <opt.Icon size={13} className={isSel ? (opt.color ?? 'text-primary') : 'text-fg-subtle'} />
                  : <span className="w-[13px]" />
                }
                <span className="flex-1">{opt.label}</span>
                {isSel && <Check size={12} className="text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── StatutPills ───────────────────────────────────────────────

const STATUT_PILLS = [
  { value: '',         label: 'Tous',     cls: '' },
  { value: 'brut',     label: 'Brut',     cls: 'valide-brut' },
  { value: 'valide',   label: 'Validé',   cls: 'valide-ok' },
  { value: 'invalide', label: 'Invalide', cls: 'valide-ko' },
];

const PILL_ACTIVE = {
  '':         'bg-surface shadow-card text-fg',
  'brut':     'bg-fg/8 shadow-card text-fg',
  'valide':   'bg-success/10 shadow-card text-success',
  'invalide': 'bg-danger/10 shadow-card text-danger',
};

function StatutPills({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 p-1 bg-surface-2 rounded-xl border border-border">
      {STATUT_PILLS.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 select-none
            ${value === s.value
              ? PILL_ACTIVE[s.value]
              : 'text-fg-subtle hover:text-fg-muted hover:bg-surface-3'
            }
          `}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Badges tableau ────────────────────────────────────────────

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, Icon: FlaskConical, color: 'text-fg-muted' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${cfg.color}`}>
      <cfg.Icon size={13} />
      {cfg.label}
    </span>
  );
}

function StatutBadge({ statut }) {
  const cfg = STATUT_CONFIG[statut] ?? { label: statut, tone: 'default' };
  return <Badge tone={cfg.tone} size="sm">{cfg.label}</Badge>;
}

function BandeBadge({ statut }) {
  if (!statut) return null;
  const tone = statut === 'positif' ? 'success' : statut === 'negatif' ? 'danger' : 'default';
  return <Badge tone={tone} size="sm">{statut.charAt(0).toUpperCase() + statut.slice(1)}</Badge>;
}

// ── ModuleResume ──────────────────────────────────────────────

function ModuleResume({ m }) {
  if (m.identificationMorpho) {
    const n = m.identificationMorpho;
    return <span className="text-xs text-fg-subtle">{n.especeIdentifiee || n.cleUtilisee || '—'}</span>;
  }
  if (m.broyagePool) {
    const n = m.broyagePool;
    return <span className="text-xs text-fg-subtle">{n.aspectMacro ? `Aspect : ${n.aspectMacro}` : n.methodeBroyage || '—'}</span>;
  }
  if (m.dessication) {
    const n = m.dessication;
    return <span className="text-xs text-fg-subtle">{n.emplacementCode || n.statutTissu || n.temperatureStockage || '—'}</span>;
  }
  if (m.extraction) {
    const n = m.extraction;
    if (n.concentrationAdn != null) return <span className="text-xs text-fg-subtle">{n.concentrationAdn} ng/µL{n.idTubeAdn ? ` · ${n.idTubeAdn}` : ''}</span>;
    return <span className="text-xs text-fg-subtle">{n.typeKit || n.typeAcideNucleique || '—'}</span>;
  }
  if (m.pcr) return <BandeBadge statut={m.pcr.statutBandeGel} />;
  if (m.qpcr) {
    const n = m.qpcr;
    return n.valeurCt != null
      ? <span className="text-xs text-fg-subtle">Ct = {n.valeurCt}</span>
      : <BandeBadge statut={n.interpretation} />;
  }
  if (m.nestedPcr) return <BandeBadge statut={m.nestedPcr.resultatFinal} />;
  if (m.sequencage) {
    const n = m.sequencage;
    return n.organismeBlast
      ? <span className="text-xs text-fg-subtle italic">{n.organismeBlast}{n.identiteBlastPct ? ` (${n.identiteBlastPct}%)` : ''}</span>
      : <span className="text-xs text-fg-subtle">{n.prestataire || n.methodeSequencage || '—'}</span>;
  }
  if (m.microscopie) return <BandeBadge statut={m.microscopie.resultat} />;
  return null;
}

// ── Colonnes tableau ──────────────────────────────────────────

const COLUMNS = [
  {
    key: 'type',
    label: 'Protocole',
    render: (m) => <TypeBadge type={m.typeManipulation} />,
  },
  {
    key: 'specimen',
    label: 'Spécimen',
    render: (m) => (
      <div className="text-xs">
        <p className="font-medium text-fg">
          {SPECIMEN_LABELS[m.specimenType] ?? m.specimenType}
          {' '}<span className="text-fg-subtle">#{m.specimenId}</span>
        </p>
      </div>
    ),
  },
  {
    key: 'resume',
    label: 'Résultat principal',
    render: (m) => <ModuleResume m={m} />,
  },
  {
    key: 'statut',
    label: 'Statut',
    width: '100px',
    render: (m) => <StatutBadge statut={m.statut} />,
  },
  {
    key: 'operateur',
    label: 'Opérateur',
    render: (m) => m.operateur
      ? <span className="text-sm text-fg">{m.operateur.prenom} {m.operateur.nom}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'pathogene',
    label: 'Pathogène ciblé',
    className: 'hidden 2xl:table-cell',
    render: (m) => {
      const p = m.pcr?.pathogeneCible ?? m.qpcr?.pathogeneCible ?? m.nestedPcr?.pathogeneCible;
      return p
        ? <span className="text-xs text-fg-subtle italic">{p.nom}</span>
        : <span className="text-fg-subtle text-xs">—</span>;
    },
  },
  {
    key: 'dateDebut',
    label: 'Date',
    width: '100px',
    render: (m) => <span className="text-xs text-fg-muted">{new Date(m.dateDebut).toLocaleDateString('fr-FR')}</span>,
  },
];

// ── Page ──────────────────────────────────────────────────────

export default function LaboPage() {
  const navigate = useNavigate();

  const [page,         setPage]         = useState(1);
  const [statut,       setStatut]       = useState('');
  const [specimenType, setSpecimenType] = useState('');
  const [typeManip,    setTypeManip]    = useState('');

  const params = {
    page, limit: 50,
    ...(statut       ? { statut }                   : {}),
    ...(specimenType ? { specimenType }             : {}),
    ...(typeManip    ? { typeManipulation: typeManip } : {}),
  };
  const { data, loading } = useApiQuery('/labo', { params });

  const manipulations = data?.manipulations ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const hasFilter = statut || specimenType || typeManip;
  const activeCount = [statut, specimenType, typeManip].filter(Boolean).length;

  return (
    <div className="max-w-screen-2xl space-y-5">
      <PageHeader
        icon={FlaskConical} iconTone="warning"
        title="Laboratoire"
        subtitle="9 protocoles — Morphologie · Extraction · PCR · qPCR · Nested · Séquençage · Microscopie"
        actions={
          <Button icon={Plus} onClick={() => navigate('/labo/nouvelle')}>
            Nouvelle manipulation
          </Button>
        }
      />

      {/* ── Barre de filtres ── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Icône filtres */}
        <div className={`
          flex items-center gap-1.5 mr-1 px-2.5 py-2 rounded-xl text-xs font-semibold
          transition-colors select-none
          ${activeCount > 0
            ? 'text-primary bg-primary/8'
            : 'text-fg-subtle bg-surface-2 border border-border'
          }
        `}>
          <SlidersHorizontal size={13} />
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-primary text-fg-on-primary text-[10px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </div>

        {/* Séparateur */}
        <div className="w-px h-6 bg-border flex-shrink-0" />

        {/* Protocole — custom dropdown */}
        <FilterSelect
          label="Protocole"
          value={typeManip}
          onChange={(v) => { setTypeManip(v); setPage(1); }}
          options={[
            { value: '', label: 'Tous les protocoles', Icon: FlaskConical, color: 'text-fg-subtle' },
            ...Object.entries(TYPE_CONFIG).map(([v, c]) => ({ value: v, label: c.label, Icon: c.Icon, color: c.color })),
          ]}
        />

        {/* Spécimen — custom dropdown */}
        <FilterSelect
          label="Spécimen"
          value={specimenType}
          onChange={(v) => { setSpecimenType(v); setPage(1); }}
          options={[
            { value: '',          label: 'Tous les types' },
            { value: 'moustique', label: 'Moustique' },
            { value: 'tique',     label: 'Tique' },
            { value: 'puce',      label: 'Puce' },
            { value: 'autre',     label: 'Autre spécimen' },
          ]}
        />

        {/* Séparateur */}
        <div className="w-px h-6 bg-border flex-shrink-0" />

        {/* Statut — pills segmentées */}
        <StatutPills
          value={statut}
          onChange={(v) => { setStatut(v); setPage(1); }}
        />

        {/* Effacer */}
        {hasFilter && (
          <button
            type="button"
            onClick={() => { setStatut(''); setSpecimenType(''); setTypeManip(''); setPage(1); }}
            className="
              flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
              text-fg-subtle border border-transparent
              hover:text-danger hover:bg-danger/8 hover:border-danger/20
              transition-all duration-150
            "
          >
            <X size={13} />
            Effacer
          </button>
        )}

        {/* Compteur à droite */}
        {!loading && (
          <span className="ml-auto text-xs text-fg-subtle hidden sm:block">
            {total} manipulation{total > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Tableau ── */}
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : manipulations.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="Aucune manipulation"
            description={hasFilter ? 'Aucun résultat pour ces filtres.' : 'Enregistrez la première manipulation laboratoire.'}
            action={!hasFilter
              ? { label: 'Nouvelle manipulation', icon: Plus, onClick: () => navigate('/labo/nouvelle') }
              : undefined
            }
          />
        ) : (
          <>
            <DataTable
              columns={COLUMNS}
              rows={manipulations}
              onRowClick={(m) => navigate(`/labo/${m.id}`)}
            />
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-fg-subtle">{total} manipulation{total > 1 ? 's' : ''}</p>
              <Pagination page={page} pages={pages} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
