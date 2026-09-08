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
import { useT, interpolate } from '../../lib/i18n';

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

const getTypes = (t) => [
  { key: 'moustique', label: t('importPage.typeMoustiques'), validateEndpoint: '/import/moustiques/validate', importEndpoint: '/import/moustiques', available: true },
  { key: 'tique',     label: t('importPage.typeTiques'),     validateEndpoint: null, importEndpoint: null, available: false },
  { key: 'puce',      label: t('importPage.typePuces'),      validateEndpoint: null, importEndpoint: null, available: false },
];

const getCodeLabels = (t) => ({
  DOUBLON:                  t('importPage.codeDoublon'),
  TAXONOMIE_INTROUVABLE:    t('importPage.codeTaxoIntrouvable'),
  LOCALITE_INTROUVABLE:     t('importPage.codeLocaliteIntrouvable'),
  NOMBRE_INVALIDE:          t('importPage.codeNombreInvalide'),
  POSITION_OCCUPEE:         t('importPage.codePositionOccupee'),
  MISSION_MANQUANTE:        t('importPage.codeMissionManquante'),
  ERREUR_BDD:               t('importPage.codeErreurBdd'),
  PROJET_CREE:              t('importPage.codeProjetCree'),
  MISSION_CREEE:            t('importPage.codeMissionCreee'),
  LOCALITE_CREEE:           t('importPage.codeLocaliteCreee'),
  LOCALITE_MATCHEE_GPS:     t('importPage.codeLocaliteMatcheeGps'),
  LOCALITE_CREEE_SANS_CODE: t('importPage.codeLocaliteCreeeSansCode'),
  METHODE_CREEE:            t('importPage.codeMethodeCreee'),
  METHODE_MATCHEE_FUZZY:    t('importPage.codeMethodeMatcheeFuzzy'),
  TYPE_METHODE_INTROUVABLE: t('importPage.codeTypeMethodeIntrouvable'),
  ACCES_REFUSE:             t('importPage.codeAccesRefuse'),
  PARITE_INVALIDE:          t('importPage.codePariteInvalide'),
  DATE_MANQUANTE:           t('importPage.codeDateManquante'),
  FICHIER_DEJA_IMPORTE:     t('importPage.codeFichierDejaImporte'),
  TUBE_HORS_PROTOCOLE:      t('importPage.codeTubeHorsProtocole'),
  REPERES_PIEGES:           t('importPage.codeReperesPieges'),
  PIEGE_POSITION_DIVERGENTE:    t('importPage.codePiegePositionDivergente'),
  PIEGE_POSITION_DANS_CATCH_ID: t('importPage.codePiegePositionDansCatchId'),
  PIEGE_TYPE_DIVERGENT:         t('importPage.codePiegeTypeDivergent'),
  TRANCHE_HORAIRE_INVALIDE: t('importPage.codeTrancheHoraireInvalide'),
  POSITION_PIEGE_INVALIDE:  t('importPage.codePositionPiegeInvalide'),
  PARITE_HORS_FEMELLE:      t('importPage.codePariteHorsFemelle'),
  ERREUR_LIGNE:             t('importPage.codeErreurLigne'),
  TEMOIN_H12:               t('importPage.codeTemoinH12'),
  TAXO_NIVEAU_GENRE:        t('importPage.codeTaxoNiveauGenre'),
  TAXO_ESPECE_NON_DETERMINEE: t('importPage.codeTaxoEspeceNonDeterminee'),
  TAXO_SOURCES_DIVERGENTES: t('importPage.codeTaxoSourcesDivergentes'),
  SPLIT_PLAQUE:             t('importPage.codeSplitPlaque'),
  POSITION_INSUFFISANTE:    t('importPage.codePositionInsuffisante'),
});

// ── Composants utilitaires ───────────────────────────────────────

function DropZone({ onFile, disabled }) {
  const t = useT();
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
      <p className="text-sm font-semibold text-fg">{t('importPage.dropZoneTitle')}</p>
      <p className="text-xs text-fg-muted mt-1">{t('importPage.dropZoneOrPrefix')} <span className="text-primary underline">{t('importPage.dropZoneBrowse')}</span></p>
      <p className="text-[10px] text-fg-subtle mt-2">{t('importPage.dropZoneFormat')}</p>
    </div>
  );
}

// ── Tableau de logs filtrable ────────────────────────────────────
const getTabFilters = (t) => [
  { key: 'erreur',        label: t('importPage.tabErreurs'),        tone: 'danger'  },
  { key: 'avertissement', label: t('importPage.tabAvertissements'), tone: 'warning' },
  { key: 'info',          label: t('importPage.tabInfos'),          tone: 'success' },
  { key: 'all',           label: t('importPage.tabTout'),           tone: 'default' },
];

const NIVEAU_STYLE = {
  erreur:        'text-danger',
  avertissement: 'text-warning',
  info:          'text-success',
};

function LogTable({ logs, defaultTab = 'erreur' }) {
  const t = useT();
  const codeLabels = getCodeLabels(t);
  const tabFilters = getTabFilters(t);
  const [tab, setTab]           = useState(defaultTab);
  const [expanded, setExpanded] = useState(false);

  if (!logs?.length) return null;

  const filtered = tab === 'all' ? logs : logs.filter(l => l.niveau === tab);
  const preview  = expanded ? filtered : filtered.slice(0, 8);
  const countByNiveau = (n) => logs.filter(l => l.niveau === n).length;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1 mb-3">
        {tabFilters.map(tf => {
          const count = tf.key === 'all' ? logs.length : countByNiveau(tf.key);
          if (count === 0 && tf.key !== 'all') return null;
          return (
            <button key={tf.key} type="button"
              onClick={() => { setTab(tf.key); setExpanded(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === tf.key
                  ? 'bg-surface-3 text-fg shadow-sm'
                  : 'text-fg-muted hover:text-fg hover:bg-surface-2'
              }`}
            >
              {tf.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                tf.key === 'erreur'        ? 'bg-danger/10 text-danger' :
                tf.key === 'avertissement' ? 'bg-warning/10 text-warning' :
                tf.key === 'info'          ? 'bg-success/10 text-success' :
                'bg-surface-3 text-fg-muted'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-fg-subtle text-center py-3">{t('importPage.noItemsInCategory')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  {[t('importPage.colLigne'), t('importPage.colIdTerrain'), t('importPage.colType'), t('importPage.colDetail')].map(h => (
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
                      {codeLabels[e.code] ?? e.code}
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
              {expanded ? t('importPage.hideBtn') : interpolate(t('importPage.seeMoreEntries'), { n: filtered.length - 8 })}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Phase 1 — Sélection du fichier ──────────────────────────────

function PhaseSelect({ file, setFile, onAnalyse, loading, error, type, reset }) {
  const t = useT();
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
            ? <><Spinner size={16} /> {t('importPage.analyzingLabel')}</>
            : <><Search size={16} /> {t('importPage.analyzeFileBtn')}</>
          }
        </button>

        {loading && (
          <Card padding="sm" className="text-center">
            <Spinner.Block label={t('importPage.verifyingData')} height="h-16" />
          </Card>
        )}
      </div>
    </>
  );
}

// ── Mapping des colonnes ────────────────────────────────────────
// Affiché en tête du rapport : montre ce que l'import a compris de la ligne
// d'en-tête AVANT de parcourir les lignes. Sans ça, une colonne mal nommée ne
// se manifeste que par une avalanche d'avertissements ligne par ligne, sans
// que la cause (l'en-tête) soit jamais visible.
function ColumnMapping({ colonnes }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!colonnes) return null;

  const { reconnues = [], ignorees = [] } = colonnes;
  if (reconnues.length === 0 && ignorees.length === 0) return null;

  return (
    <div className="mb-4 border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface-2 hover:bg-surface-3 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-fg-muted">
          {t('importPage.columnMappingTitle')}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-semibold">
            {interpolate(t('importPage.columnsRecognized'), { n: reconnues.length })}
          </span>
          {ignorees.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-semibold">
              {interpolate(t('importPage.columnsIgnored'), { n: ignorees.length })}
            </span>
          )}
          <ChevronDown size={14} className={`text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-3 bg-surface">
          {reconnues.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wide mb-1.5">
                {t('importPage.columnsRecognizedLabel')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {reconnues.map(({ source, cible }) => (
                  <span key={source} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/8 text-success">
                    {source}{source !== cible && <span className="text-fg-subtle"> → {cible}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {ignorees.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wide mb-1.5">
                {t('importPage.columnsIgnoredLabel')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ignorees.map((c, i) => (
                  <span key={`${c}-${i}`} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-fg-subtle">
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-fg-subtle mt-1.5 italic">{t('importPage.columnsIgnoredHint')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Phase 2 — Rapport de validation ─────────────────────────────

function PhaseReport({ report, file, onBack, onConfirm, loading, error }) {
  const t = useT();
  const codeLabels = getCodeLabels(t);
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
              ? t('importPage.noValidLineTitle')
              : hasErrors
                ? interpolate(t('importPage.validationReportTitle'), { n: report.erreurs })
                : t('importPage.fileValidTitle')
            }
          </p>
          <p className="text-xs text-fg-muted mt-1">{file?.name}</p>

          {/* Compteurs */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs px-2 py-1 rounded-lg bg-surface-3 text-fg-muted font-semibold">
              {interpolate(t('importPage.totalLinesCount'), { n: report.total })}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-success/10 text-success font-semibold">
              {interpolate(t('importPage.validCount'), { n: report.valid })}
            </span>
            {report.erreurs > 0 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-danger/10 text-danger font-semibold">
                {interpolate(t('importPage.erreurCount'), { n: report.erreurs })}
              </span>
            )}
            {report.avertissements > 0 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-warning/10 text-warning font-semibold">
                {interpolate(t('importPage.avertissementCount'), { n: report.avertissements })}
              </span>
            )}
          </div>

          {/* Résumé erreurs par catégorie */}
          {report.resume && Object.keys(report.resume).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(report.resume).map(([code, n]) => (
                <span key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-danger/8 text-danger font-mono">
                  {codeLabels[code] ?? code}: {n}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ColumnMapping colonnes={report.colonnes} />

      {/* Bannière avertissement si erreurs */}
      {hasErrors && !allInvalid && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-warning/8 border border-warning/20 rounded-xl">
          <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-warning">
            {t('importPage.errorLinesWarningPrefix')} <strong>{report.erreurs} {t('importPage.errorLinesWord')}</strong> {t('importPage.errorLinesWarningMid')}{' '}
            <strong>{report.valid} {t('importPage.validLinesWord')}</strong> {t('importPage.errorLinesWarningSuffix')}
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
          <ArrowLeft size={14} /> {t('importPage.modifyFileBtn')}
        </button>

        {!allInvalid && (
          <button onClick={onConfirm} disabled={loading}
            className="btn-primary text-sm flex items-center gap-2">
            {loading
              ? <><Spinner size={14} /> {t('importPage.importingLabel')}</>
              : <><Upload size={14} /> {interpolate(t('importPage.confirmImportBtn'), { n: report.valid, s: report.valid > 1 ? 's' : '' })}</>
            }
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-3">
          <Spinner.Block label={t('importPage.importingHint')} height="h-12" />
        </div>
      )}
    </Card>
  );
}

// ── Phase 3 — Résultat d'import ──────────────────────────────────

function PhaseResult({ result, reset }) {
  const t = useT();
  const codeLabels = getCodeLabels(t);
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
              {interpolate(t('importPage.importedCount'), { n: result.imported })}
            </span>
            {result.skipped > 0 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-danger/10 text-danger font-semibold">
                {interpolate(t('importPage.skippedCount'), { n: result.skipped })}
              </span>
            )}
            <span className="text-xs text-fg-subtle">{interpolate(t('importPage.totalLinesShort'), { n: result.total })}</span>
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
                  <PlusCircle size={10} /> {interpolate(t('importPage.projetCreated'), { nom: p.nom })}
                </span>
              ))}
              {result.crees?.missions?.map((m, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
                  <PlusCircle size={10} /> {interpolate(t('importPage.missionCreated'), { nom: m.ordreMission })}
                </span>
              ))}
              {result.crees?.localites?.map((l, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
                  <PlusCircle size={10} /> {interpolate(t('importPage.localiteCreated'), { nom: l.nom })}
                </span>
              ))}
            </div>
          )}

          {result.resume && Object.keys(result.resume).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(result.resume).map(([code, n]) => (
                <span key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-danger/8 text-danger font-mono">
                  {codeLabels[code] ?? code}: {n}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ColumnMapping colonnes={result.colonnes} />

      <LogTable logs={allLogs} />

      <div className="flex gap-2 mt-4 pt-4 border-t border-border">
        <button onClick={reset} className="btn-secondary text-sm">{t('importPage.importAnotherFile')}</button>
        <a href="/specimens/moustiques" className="btn-primary text-sm">{t('importPage.seeSpecimens')}</a>
      </div>
    </Card>
  );
}

// ── Sidebar guide ────────────────────────────────────────────────

// Ordre et contenu alignés sur TEMPLATE_COLUMNS (import.controller.js).
// `req` reflète checkRequiredHeaders et RIEN D'AUTRE : WHAT_3_WORDS et
// COLLECTION_METHOD étaient annoncées obligatoires alors que le backend ne les
// exige pas, et 7 colonnes lisibles par l'import manquaient à cette liste.
const getCols = (t) => [
  { col: 'SERIES',                champ: t('importPage.colIdTerrain'),    req: true  },
  { col: 'MISSION_ORDER_NUMBER',  champ: t('importPage.colMission'),      req: true  },
  { col: 'SCIENTIFIC_NAME',       champ: t('importPage.colTaxonomie'),    req: true  },
  { col: 'GENUS',                 champ: t('importPage.colGenre'),        req: false },
  { col: 'SPECIES',               champ: t('importPage.colEspece'),       req: false },
  { col: 'PROJET',                champ: t('importPage.colProjet'),       req: false },
  { col: 'COLLECTION_LOCATION',   champ: t('importPage.colLieu'),         req: false },
  { col: 'WHAT_3_WORDS',          champ: t('importPage.colCodeLocalite'), req: false },
  { col: 'DECIMAL_LATITUDE',      champ: t('importPage.colLatitude'),     req: false },
  { col: 'DECIMAL_LONGITUDE',     champ: t('importPage.colLongitude'),    req: false },
  { col: 'ELEVATION',             champ: t('importPage.colAltitude'),     req: false },
  { col: 'DATE_OF_COLLECTION',    champ: t('importPage.colDateCollecte'), req: false },
  { col: 'COLLECTION_METHOD',     champ: t('importPage.colMethode'),      req: false },
  { col: 'CATCH_ID',              champ: t('importPage.colCatchId'),      req: false },
  { col: 'OUTDOORS_INDOORS',      champ: t('importPage.colIntExt'),       req: false },
  { col: 'TIME_OF_COLLECTION',    champ: t('importPage.colHeure'),        req: false },
  { col: 'NUMBER',                champ: t('importPage.colNombre'),       req: false },
  { col: 'SEX',                   champ: t('importPage.colSexe'),         req: false },
  { col: 'LIFESTAGE',             champ: t('importPage.colStade'),        req: false },
  { col: 'BLOOD_MEAL',            champ: t('importPage.colRepasSang'),    req: false },
  { col: 'PARITY',                champ: t('importPage.colParite'),       req: false },
  { col: 'ORGANISM_PART',         champ: t('importPage.colOrgane'),       req: false },
  { col: 'PRESERVATIVE_SOLUTION', champ: t('importPage.colSolution'),     req: false },
  { col: 'BOX_PLATE_ID',          champ: t('importPage.colContainer'),    req: false },
  { col: 'TUBE_OR_WELL_ID',       champ: t('importPage.colPosition'),     req: false },
  { col: 'REMARKS',               champ: t('importPage.colNotes'),        req: false },
];

// Colonnes lues mais volontairement absentes de la liste : ce sont des REPLIS
// d'autres colonnes (COLLECTOR_SAMPLE_ID pour SERIES, OTHER_INFORMATIONS et
// MISC_METADATA pour REMARKS). Les afficher laisserait croire à des champs
// distincts. Un test verrouille cette liste d'exceptions.

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
  const t = useT();
  const cols = getCols(t);
  return (
    <aside className="space-y-3 lg:sticky lg:top-4 self-start">
      <Card padding="sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider flex items-center gap-1.5">
            <FileSpreadsheet size={11} className="text-success" /> {t('importPage.excelColumnsTitle')}
          </p>
          <span className="text-[9px] text-danger font-semibold flex items-center gap-0.5">
            <span className="font-bold">✱</span> {t('importPage.requiredLabel')}
          </span>
        </div>

        <div className="space-y-0.5">
          {cols.map((c) => <ColRow key={c.col} {...c} />)}
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
            {t('importPage.downloadTemplate')}
          </button>
        )}
      </Card>

      <Card padding="sm">
        <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Info size={11} className="text-info" /> {t('importPage.behaviorTitle')}
        </p>
        <ul className="text-[10.5px] text-fg-muted space-y-1.5 leading-relaxed">
          <li>• {t('importPage.behaviorAutoCreate')} <span className="text-fg font-medium">{t('importPage.behaviorAutoCreateWord')}</span></li>
          <li>• {t('importPage.behaviorGps')}</li>
          <li>• {t('importPage.behaviorUnknownSpecies')}</li>
          <li>• {t('importPage.behaviorDuplicateId')}</li>
          <li>• {t('importPage.behaviorPositionOccupied')}</li>
          <li>• {t('importPage.behaviorIdempotentPrefix')} <span className="text-fg font-medium">{t('importPage.behaviorIdempotentWord')}</span> {t('importPage.behaviorIdempotentSuffix')}</li>
        </ul>
      </Card>
    </aside>
  );
}

// ── Page principale ──────────────────────────────────────────────
export default function ImportPage() {
  const t = useT();
  const types = getTypes(t);
  const [activeType, setActiveType] = useState('moustique');
  const [file, setFile]             = useState(null);

  // phase : 'select' | 'report' | 'done'
  const [phase, setPhase]           = useState('select');
  const [report, setReport]         = useState(null);
  const [result, setResult]         = useState(null);

  const [analyzing, setAnalyzing]   = useState(false);
  const [importing, setImporting]   = useState(false);
  const [error, setError]           = useState(null);

  const type = types.find(ty => ty.key === activeType);

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
      setError(err.response?.data?.error || t('importPage.analysisErrorGeneric'));
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
      setError(err.response?.data?.error || err.response?.data?.message || t('importPage.importErrorGeneric'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-screen-2xl">
      <PageHeader
        icon={Upload} iconTone="info"
        title={t('importPage.pageTitle')}
        subtitle={t('importPage.pageSubtitle')}
      />

      {/* Prérequis */}
      <Card padding="sm" className="border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="text-xs text-fg-muted space-y-1">
            <p className="font-semibold text-fg">{t('importPage.prereqTitle')}</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li><strong>{t('importPage.prereqProjet')}</strong> ({t('importPage.prereqProjetCol')} <code className="font-mono bg-surface-3 px-1 rounded">PROJET</code>)</li>
              <li><strong>{t('importPage.prereqMission')}</strong> ({t('importPage.prereqProjetCol')} <code className="font-mono bg-surface-3 px-1 rounded">MISSION_ORDER_NUMBER</code>)</li>
              <li><strong>{t('importPage.prereqLocalite')}</strong> {t('importPage.prereqLocaliteHint')} (<code className="font-mono bg-surface-3 px-1 rounded">WHAT_3_WORDS</code>) {t('importPage.prereqLocaliteHint2')}</li>
              <li><strong>{t('importPage.prereqMethode')}</strong> {t('importPage.prereqMethodeHint')} (<code className="font-mono bg-surface-3 px-1 rounded">COLLECTION_METHOD</code>) {t('importPage.prereqMethodeHint2')}</li>
              <li><strong>{t('importPage.prereqContainer')}</strong> (<code className="font-mono bg-surface-3 px-1 rounded">BOX_PLATE_ID</code>)</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Onglets type */}
      <div className="flex items-center gap-0.5 p-1 bg-surface-2 rounded-xl w-fit border border-border">
        {types.map(ty => (
          <button key={ty.key} onClick={() => { if (ty.available) { setActiveType(ty.key); reset(); } }}
            disabled={!ty.available}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeType === ty.key ? 'bg-surface text-fg shadow-card' : 'text-fg-subtle hover:text-fg-muted'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <SpecimenIcon type={ty.key} size={16} />
            {ty.label}
            {!ty.available && <Badge size="xs" tone="default">{t('importPage.soonBadge')}</Badge>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] 2xl:grid-cols-[1fr,380px] gap-5 2xl:gap-8 items-start">
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

