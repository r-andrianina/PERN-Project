// Page d'import de données spécimens depuis un fichier Excel au format IPM.
// Flux en 3 phases : sélection → rapport de validation → résultat d'import

import { useState, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Info, Clock, PlusCircle, Download,
  Search, ArrowLeft, ShieldCheck,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, PageHeader, Badge, Spinner } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';

const TEMPLATE_ENDPOINTS = {
  moustique: '/import/template/moustiques',
};

async function downloadTemplate(type) {
  const endpoint = TEMPLATE_ENDPOINTS[type];
  if (!endpoint) return;
  const res  = await api.get(endpoint, { responseType: 'blob' });
  const url  = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `template_import_${type}s.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

const TYPES = [
  { key: 'moustique', label: 'Moustiques', validateEndpoint: '/import/moustiques/validate', importEndpoint: '/import/moustiques', available: true },
  { key: 'tique',     label: 'Tiques',     validateEndpoint: null, importEndpoint: null, available: false },
  { key: 'puce',      label: 'Puces',      validateEndpoint: null, importEndpoint: null, available: false },
];

const CODE_LABELS = {
  DOUBLON:                  'Doublon',
  TAXONOMIE_INTROUVABLE:    'Taxonomie inconnue',
  LOCALITE_INTROUVABLE:     'Localité inconnue',
  METHODE_INTROUVABLE:      'Méthode inconnue',
  POSITION_OCCUPEE:         'Position occupée',
  MISSION_MANQUANTE:        'Mission manquante',
  ERREUR_BDD:               'Erreur base de données',
  PROJET_CREE:              'Projet créé auto',
  MISSION_CREEE:            'Mission créée auto',
  LOCALITE_CREEE:           'Localité créée auto',
  LOCALITE_MATCHEE_GPS:     'Localité trouvée par GPS',
  LOCALITE_CREEE_SANS_CODE: 'Localité créée (sans code)',
  METHODE_CREEE:            'Méthode créée auto',
  METHODE_MATCHEE_FUZZY:    'Méthode trouvée par nom',
  TYPE_METHODE_INTROUVABLE: 'Type méthode absent du référentiel',
  TEMOIN_H12:               'Témoin H12 (SOP)',
  TAXO_NIVEAU_GENRE:        'Espèce non trouvée (genre seul)',
  SPLIT_PLAQUE:             'Split plaque automatique',
  POSITION_INSUFFISANTE:    'Positions insuffisantes',
};

// ── Composants utilitaires ───────────────────────────────────────

function DropZone({ onFile, disabled }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
        ${drag ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border-strong hover:border-primary/50 hover:bg-surface-2'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ''; } }} />
      <Upload size={36} className={`mx-auto mb-3 ${drag ? 'text-primary' : 'text-fg-subtle'}`} />
      <p className="text-sm font-semibold text-fg">Glissez votre fichier Excel ici</p>
      <p className="text-xs text-fg-muted mt-1">ou <span className="text-primary underline">parcourir</span></p>
      <p className="text-[10px] text-fg-subtle mt-2">Format accepté : .xlsx — Max 50 MB</p>
    </div>
  );
}

// ── Tableau de logs filtrable ────────────────────────────────────
const TAB_FILTERS = [
  { key: 'erreur',        label: 'Erreurs',        tone: 'danger'  },
  { key: 'avertissement', label: 'Avertissements', tone: 'warning' },
  { key: 'info',          label: 'Infos',          tone: 'success' },
  { key: 'all',           label: 'Tout',           tone: 'default' },
];

const NIVEAU_STYLE = {
  erreur:        'text-danger',
  avertissement: 'text-warning',
  info:          'text-success',
};

function LogTable({ logs, defaultTab = 'erreur' }) {
  const [tab, setTab]           = useState(defaultTab);
  const [expanded, setExpanded] = useState(false);

  if (!logs?.length) return null;

  const filtered = tab === 'all' ? logs : logs.filter(l => l.niveau === tab);
  const preview  = expanded ? filtered : filtered.slice(0, 8);
  const countByNiveau = (n) => logs.filter(l => l.niveau === n).length;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1 mb-3">
        {TAB_FILTERS.map(t => {
          const count = t.key === 'all' ? logs.length : countByNiveau(t.key);
          if (count === 0 && t.key !== 'all') return null;
          return (
            <button key={t.key} type="button"
              onClick={() => { setTab(t.key); setExpanded(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.key
                  ? 'bg-surface-3 text-fg shadow-sm'
                  : 'text-fg-muted hover:text-fg hover:bg-surface-2'
              }`}
            >
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                t.key === 'erreur'        ? 'bg-danger/10 text-danger' :
                t.key === 'avertissement' ? 'bg-warning/10 text-warning' :
                t.key === 'info'          ? 'bg-success/10 text-success' :
                'bg-surface-3 text-fg-muted'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-fg-subtle text-center py-3">Aucun élément dans cette catégorie.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  {['Ligne', 'ID terrain', 'Type', 'Détail'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-fg-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((e, i) => (
                  <tr key={i} className="hover:bg-surface-2">
                    <td className="px-3 py-2 font-mono text-fg-subtle whitespace-nowrap">
                      {e.ligne > 0 ? `#${e.ligne}` : '—'}
                    </td>
                    <td className={`px-3 py-2 font-mono whitespace-nowrap ${NIVEAU_STYLE[e.niveau] ?? 'text-fg-muted'}`}>
                      {e.idTerrain ?? '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-fg-subtle">
                      {CODE_LABELS[e.code] ?? e.code}
                    </td>
                    <td className="px-3 py-2 text-fg-muted">{e.raison}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > 8 && (
            <button type="button" onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg mt-2">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {expanded ? 'Masquer' : `Voir les ${filtered.length - 8} entrée(s) suivante(s)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Phase 1 — Sélection du fichier ──────────────────────────────

function PhaseSelect({ file, setFile, onAnalyse, loading, error, type, activeType, setActiveType, reset }) {
  return (
    <>
      <div className="space-y-4">
        <DropZone onFile={setFile} disabled={loading} />

        {file && (
          <Card padding="sm" className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg truncate">{file.name}</p>
              <p className="text-xs text-fg-subtle">{(file.size / 1024).toFixed(0)} Ko</p>
            </div>
            <button onClick={reset} className="p-1 text-fg-subtle hover:text-danger rounded-lg">
              <XCircle size={16} />
            </button>
          </Card>
        )}

        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">
            {error}
          </div>
        )}

        <button
          onClick={onAnalyse}
          disabled={!file || loading || !type.available}
          className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? <><Spinner size={16} /> Analyse en cours…</>
            : <><Search size={16} /> Analyser le fichier</>
          }
        </button>

        {loading && (
          <Card padding="sm" className="text-center">
            <Spinner.Block label="Vérification des données — ne fermez pas la page…" height="h-16" />
          </Card>
        )}
      </div>
    </>
  );
}

// ── Phase 2 — Rapport de validation ─────────────────────────────

function PhaseReport({ report, file, onBack, onConfirm, loading, error }) {
  const hasErrors   = report.erreurs > 0;
  const allInvalid  = report.valid === 0;

  return (
    <Card padding="md">
      {/* En-tête rapport */}
      <div className="flex items-start gap-4 mb-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          allInvalid ? 'bg-danger/10' : hasErrors ? 'bg-warning/10' : 'bg-success/10'
        }`}>
          {allInvalid
            ? <XCircle size={24} className="text-danger" />
            : hasErrors
              ? <AlertTriangle size={24} className="text-warning" />
              : <ShieldCheck size={24} className="text-success" />
          }
        </div>
        <div className="flex-1">
          <p className="font-bold text-fg text-base">
            {allInvalid
              ? 'Aucune ligne valide — corrigez le fichier'
              : hasErrors
                ? `Rapport de validation — ${report.erreurs} erreur(s) détectée(s)`
                : 'Fichier valide — prêt à importer'
            }
          </p>
          <p className="text-xs text-fg-muted mt-1">{file?.name}</p>

          {/* Compteurs */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs px-2 py-1 rounded-lg bg-surface-3 text-fg-muted font-semibold">
              {report.total} ligne(s) au total
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-success/10 text-success font-semibold">
              ✓ {report.valid} valide(s)
            </span>
            {report.erreurs > 0 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-danger/10 text-danger font-semibold">
                ✗ {report.erreurs} erreur(s)
              </span>
            )}
            {report.avertissements > 0 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-warning/10 text-warning font-semibold">
                ⚠ {report.avertissements} avertissement(s)
              </span>
            )}
          </div>

          {/* Résumé erreurs par catégorie */}
          {report.resume && Object.keys(report.resume).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(report.resume).map(([code, n]) => (
                <span key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-danger/8 text-danger font-mono">
                  {CODE_LABELS[code] ?? code}: {n}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bannière avertissement si erreurs */}
      {hasErrors && !allInvalid && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-warning/8 border border-warning/20 rounded-xl">
          <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-warning">
            Les <strong>{report.erreurs} ligne(s) en erreur</strong> seront ignorées lors de l'import.
            Seules les <strong>{report.valid} ligne(s) valides</strong> seront enregistrées.
            Vous pouvez corriger le fichier ou confirmer l'import partiel.
          </p>
        </div>
      )}

      {/* Logs détaillés */}
      <LogTable logs={report.logs} defaultTab={report.erreurs > 0 ? 'erreur' : 'avertissement'} />

      {error && (
        <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-5 pt-4 border-t border-border">
        <button onClick={onBack} disabled={loading}
          className="btn-secondary text-sm flex items-center gap-2">
          <ArrowLeft size={14} /> Modifier le fichier
        </button>

        {!allInvalid && (
          <button onClick={onConfirm} disabled={loading}
            className="btn-primary text-sm flex items-center gap-2">
            {loading
              ? <><Spinner size={14} /> Import en cours…</>
              : <><Upload size={14} /> Confirmer l'import ({report.valid} ligne{report.valid > 1 ? 's' : ''})</>
            }
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-3">
          <Spinner.Block label="Import en cours — ne fermez pas la page…" height="h-12" />
        </div>
      )}
    </Card>
  );
}

// ── Phase 3 — Résultat d'import ──────────────────────────────────

function PhaseResult({ result, reset }) {
  const allLogs = result?.logs
    ?? result?.errors?.map(e => ({ ...e, niveau: 'erreur', code: 'ERREUR', raison: e.raison }))
    ?? [];

  const nbCrees = (result?.crees?.projets?.length ?? 0)
    + (result?.crees?.missions?.length ?? 0)
    + (result?.crees?.localites?.length ?? 0);

  return (
    <Card padding="md">
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${result.skipped === 0 ? 'bg-success/10' : 'bg-warning/10'}`}>
          {result.skipped === 0
            ? <CheckCircle2 size={24} className="text-success" />
            : <AlertTriangle size={24} className="text-warning" />
          }
        </div>
        <div className="flex-1">
          <p className="font-bold text-fg">{result.message}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs px-2 py-1 rounded-lg bg-success/10 text-success font-semibold">
              ✓ {result.imported} importé(s)
            </span>
            {result.skipped > 0 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-danger/10 text-danger font-semibold">
                ✗ {result.skipped} ignoré(s)
              </span>
            )}
            <span className="text-xs text-fg-subtle">{result.total} lignes au total</span>
            {result.dureeSec && (
              <span className="flex items-center gap-1 text-xs text-fg-subtle">
                <Clock size={11} /> {result.dureeSec}s
              </span>
            )}
          </div>

          {nbCrees > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.crees?.projets?.map((p, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
                  <PlusCircle size={10} /> Projet «{p.nom}» créé
                </span>
              ))}
              {result.crees?.missions?.map((m, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
                  <PlusCircle size={10} /> Mission «{m.ordreMission}» créée
                </span>
              ))}
              {result.crees?.localites?.map((l, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
                  <PlusCircle size={10} /> Localité «{l.nom}» créée
                </span>
              ))}
            </div>
          )}

          {result.resume && Object.keys(result.resume).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(result.resume).map(([code, n]) => (
                <span key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-danger/8 text-danger font-mono">
                  {CODE_LABELS[code] ?? code}: {n}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <LogTable logs={allLogs} />

      <div className="flex gap-2 mt-4 pt-4 border-t border-border">
        <button onClick={reset} className="btn-secondary text-sm">Importer un autre fichier</button>
        <a href="/specimens/moustiques" className="btn-primary text-sm">Voir les spécimens</a>
      </div>
    </Card>
  );
}

// ── Sidebar guide ────────────────────────────────────────────────

const COLS = [
  { col: 'SERIES',               champ: 'ID terrain',    req: true  },
  { col: 'MISSION_ORDER_NUMBER',  champ: 'Mission',       req: true  },
  { col: 'WHAT_3_WORDS',          champ: 'Code localité', req: true  },
  { col: 'SCIENTIFIC_NAME',        champ: 'Taxonomie',     req: true  },
  { col: 'COLLECTION_METHOD',     champ: 'Méthode',       req: true  },
  { col: 'PROJET',               champ: 'Projet',        req: false },
  { col: 'BOX_PLATE_ID',          champ: 'Container',     req: false },
  { col: 'TUBE_OR_WELL_ID',       champ: 'Position',      req: false },
  { col: 'SEX',                   champ: 'Sexe',          req: false },
  { col: 'LIFESTAGE',             champ: 'Stade',         req: false },
  { col: 'BLOOD_MEAL',            champ: 'Repas sang',    req: false },
  { col: 'PRESERVATIVE_SOLUTION', champ: 'Solution',      req: false },
  { col: 'DATE_OF_COLLECTION',    champ: 'Date collecte', req: false },
];

function ColRow({ col, champ, req }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${req ? 'bg-danger/5' : 'hover:bg-surface-2'} transition-colors`}>
      <code className="font-mono text-[9px] text-fg-muted leading-tight flex-1 min-w-0">{col}</code>
      <span className="text-[10px] text-fg-muted whitespace-nowrap shrink-0">{champ}</span>
      {req
        ? <span className="text-danger text-[10px] font-bold shrink-0">✱</span>
        : <span className="w-3 shrink-0" />
      }
    </div>
  );
}

function Sidebar({ activeType }) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-4 self-start">
      <Card padding="sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider flex items-center gap-1.5">
            <FileSpreadsheet size={11} className="text-success" /> Colonnes Excel
          </p>
          <span className="text-[9px] text-danger font-semibold flex items-center gap-0.5">
            <span className="font-bold">✱</span> obligatoire
          </span>
        </div>

        <div className="space-y-0.5">
          {COLS.map((c) => <ColRow key={c.col} {...c} />)}
        </div>

        {TEMPLATE_ENDPOINTS[activeType] && (
          <button
            type="button"
            onClick={() => downloadTemplate(activeType)}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                       border border-primary/30 bg-primary/5 text-primary text-[11px] font-semibold
                       hover:bg-primary/10 transition-colors"
          >
            <Download size={12} />
            Télécharger le template Excel
          </button>
        )}
      </Card>

      <Card padding="sm">
        <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Info size={11} className="text-info" /> Comportement
        </p>
        <ul className="text-[10.5px] text-fg-muted space-y-1.5 leading-relaxed">
          <li>• Projet / Mission / Localité / Méthode absents → <span className="text-fg font-medium">créés auto</span></li>
          <li>• Localité par code 3W, puis par GPS (≤ 2 km)</li>
          <li>• Espèce inconnue → ligne ignorée</li>
          <li>• ID terrain doublon → ligne ignorée</li>
          <li>• Position plaque occupée → ligne ignorée</li>
          <li>• Import <span className="text-fg font-medium">idempotent</span> — peut être relancé</li>
        </ul>
      </Card>
    </aside>
  );
}

// ── Page principale ──────────────────────────────────────────────
export default function ImportPage() {
  const [activeType, setActiveType] = useState('moustique');
  const [file, setFile]             = useState(null);

  // phase : 'select' | 'report' | 'done'
  const [phase, setPhase]           = useState('select');
  const [report, setReport]         = useState(null);
  const [result, setResult]         = useState(null);

  const [analyzing, setAnalyzing]   = useState(false);
  const [importing, setImporting]   = useState(false);
  const [error, setError]           = useState(null);

  const type = TYPES.find(t => t.key === activeType);

  const reset = () => {
    setFile(null);
    setReport(null);
    setResult(null);
    setError(null);
    setPhase('select');
  };

  // Phase 1 → 2 : analyse du fichier
  const handleAnalyse = async () => {
    if (!file || !type.available) return;
    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const r = await api.post(type.validateEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReport(r.data);
      setPhase('report');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'analyse du fichier');
    } finally {
      setAnalyzing(false);
    }
  };

  // Phase 2 → 3 : import confirmé
  const handleImport = async () => {
    if (!file || !type.available) return;
    setImporting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const r = await api.post(type.importEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data);
      setPhase('done');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        icon={Upload} iconTone="info"
        title="Import de données"
        subtitle="Importez vos données de collecte depuis un fichier Excel au format IPM"
      />

      {/* Prérequis */}
      <Card padding="sm" className="border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="text-xs text-fg-muted space-y-1">
            <p className="font-semibold text-fg">Ces éléments sont créés automatiquement si absents :</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li><strong>Projet</strong> (colonne <code className="font-mono bg-surface-3 px-1 rounded">PROJET</code>)</li>
              <li><strong>Mission</strong> (colonne <code className="font-mono bg-surface-3 px-1 rounded">MISSION_ORDER_NUMBER</code>)</li>
              <li><strong>Localité</strong> — cherchée par code (<code className="font-mono bg-surface-3 px-1 rounded">WHAT_3_WORDS</code>) puis par GPS (seuil 2 km)</li>
              <li><strong>Méthode de collecte</strong> — le type (<code className="font-mono bg-surface-3 px-1 rounded">COLLECTION_METHOD</code>) doit exister dans le référentiel</li>
              <li><strong>Container</strong> (<code className="font-mono bg-surface-3 px-1 rounded">BOX_PLATE_ID</code>)</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Onglets type */}
      <div className="flex items-center gap-0.5 p-1 bg-surface-2 rounded-xl w-fit border border-border">
        {TYPES.map(t => (
          <button key={t.key} onClick={() => { if (t.available) { setActiveType(t.key); reset(); } }}
            disabled={!t.available}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeType === t.key ? 'bg-surface text-fg shadow-card' : 'text-fg-subtle hover:text-fg-muted'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <SpecimenIcon type={t.key} size={16} />
            {t.label}
            {!t.available && <Badge size="xs" tone="default">Bientôt</Badge>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-5 items-start">
        <div className="space-y-4">
          {phase === 'select' && (
            <PhaseSelect
              file={file} setFile={setFile}
              onAnalyse={handleAnalyse}
              loading={analyzing}
              error={error}
              type={type}
              activeType={activeType} setActiveType={setActiveType}
              reset={reset}
            />
          )}

          {phase === 'report' && report && (
            <PhaseReport
              report={report}
              file={file}
              onBack={() => { setPhase('select'); setError(null); }}
              onConfirm={handleImport}
              loading={importing}
              error={error}
            />
          )}

          {phase === 'done' && result && (
            <PhaseResult result={result} reset={reset} />
          )}
        </div>

        <Sidebar activeType={activeType} />
      </div>
    </div>
  );
}
