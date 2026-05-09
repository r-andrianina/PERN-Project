// Page d'import de données spécimens depuis un fichier Excel au format IPM.
// Actuellement supporté : Moustiques (feuille 1 = données, feuille 2 = GPS).

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
         ChevronDown, ChevronRight, Info, Download } from 'lucide-react';
import api from '../../api/axios';
import { Card, PageHeader, Badge, Spinner } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';

const TYPES = [
  { key: 'moustique', label: 'Moustiques', endpoint: '/import/moustiques', available: true },
  { key: 'tique',     label: 'Tiques',     endpoint: '/import/tiques',     available: false },
  { key: 'puce',      label: 'Puces',      endpoint: '/import/puces',      available: false },
];

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

function ResultTable({ errors }) {
  const [expanded, setExpanded] = useState(false);
  if (!errors?.length) return null;
  const preview = expanded ? errors : errors.slice(0, 5);
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-fg-muted hover:text-fg mb-2">
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {expanded ? 'Masquer' : 'Voir'} les {errors.length} ligne(s) ignorée(s)
      </button>
      {expanded && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 border-b border-border">
              <tr>
                {['Ligne', 'ID terrain', 'Raison'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-fg-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preview.map((e, i) => (
                <tr key={i} className="hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono text-fg-subtle">#{e.ligne}</td>
                  <td className="px-3 py-2 font-mono text-danger">{e.idTerrain}</td>
                  <td className="px-3 py-2 text-fg-muted">{e.raison}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  const [activeType, setActiveType] = useState('moustique');
  const [file, setFile]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);

  const type = TYPES.find(t => t.key === activeType);

  const handleImport = async () => {
    if (!file || !type.available) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const r = await api.post(type.endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFile(null); setResult(null); setError(null); };

  return (
    <div className="space-y-6 max-w-4xl">
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
            <p className="font-semibold text-fg">Avant d'importer, vérifiez que ces éléments existent dans SpécimenManager :</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>La <strong>mission</strong> (colonne <code className="font-mono bg-surface-3 px-1 rounded">MISSION_ORDER_NUMBER</code>) avec son ordre de mission exact</li>
              <li>La <strong>localité</strong> (code 3 lettres depuis colonne <code className="font-mono bg-surface-3 px-1 rounded">WHAT_3_WORDS</code>) dans cette mission</li>
              <li>La <strong>méthode de collecte</strong> (colonne <code className="font-mono bg-surface-3 px-1 rounded">COLLECTION_METHOD</code>) dans cette localité</li>
            </ul>
            <p className="mt-1">Le <strong>container</strong> (BOX_PLATE_ID) est créé automatiquement si absent.</p>
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

        {/* Zone upload + résultats */}
        <div className="space-y-4">

          {result ? (
            <Card padding="md">
              {/* Succès */}
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${result.skipped === 0 ? 'bg-success/10' : 'bg-warning/10'}`}>
                  {result.skipped === 0
                    ? <CheckCircle2 size={24} className="text-success" />
                    : <AlertTriangle size={24} className="text-warning" />
                  }
                </div>
                <div>
                  <p className="font-bold text-fg">{result.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs px-2 py-1 rounded-lg bg-success/10 text-success font-semibold">
                      ✓ {result.imported} importé(s)
                    </span>
                    {result.skipped > 0 && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-danger/10 text-danger font-semibold">
                        ✗ {result.skipped} ignoré(s)
                      </span>
                    )}
                    <span className="text-xs text-fg-subtle">{result.total} lignes au total</span>
                  </div>
                </div>
              </div>

              <ResultTable errors={result.errors} />

              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <button onClick={reset} className="btn-secondary text-sm">Importer un autre fichier</button>
                <a href="/specimens/moustiques" className="btn-primary text-sm">Voir les spécimens</a>
              </div>
            </Card>
          ) : (
            <>
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
                onClick={handleImport}
                disabled={!file || loading || !type.available}
                className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><Spinner size={16} /> Analyse en cours…</>
                  : <><Upload size={16} /> Lancer l'import</>
                }
              </button>

              {loading && (
                <Card padding="sm" className="text-center">
                  <Spinner.Block label="Import en cours — ne fermez pas la page…" height="h-16" />
                </Card>
              )}
            </>
          )}
        </div>

        {/* Sidebar guide */}
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
          <Card padding="sm">
            <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileSpreadsheet size={13} className="text-success" /> Colonnes utilisées
            </p>
            <div className="space-y-1.5 text-[11px]">
              {[
                { col: 'SERIES',                  champ: 'ID terrain',    req: true  },
                { col: 'MISSION_ORDER_NUMBER',     champ: 'Mission',       req: true  },
                { col: 'WHAT_3_WORDS',             champ: 'Code localité', req: true  },
                { col: 'SCIENTIFIC_NAME',          champ: 'Taxonomie',     req: true  },
                { col: 'COLLECTION_METHOD',        champ: 'Méthode',       req: true  },
                { col: 'BOX_PLATE_ID',             champ: 'Container',     req: false },
                { col: 'TUBE_OR_WELL_ID',          champ: 'Position',      req: false },
                { col: 'SEX',                      champ: 'Sexe',          req: false },
                { col: 'LIFESTAGE',                champ: 'Stade',         req: false },
                { col: 'BLOOD_MEAL',               champ: 'Repas sang',    req: false },
                { col: 'PRESERVATIVE_SOLUTION',    champ: 'Solution',      req: false },
                { col: 'DATE_OF_COLLECTION',       champ: 'Date collecte', req: false },
              ].map(({ col, champ, req }) => (
                <div key={col} className="flex items-center justify-between gap-2">
                  <code className="font-mono text-fg-subtle bg-surface-3 px-1 rounded truncate">{col}</code>
                  <span className="text-fg-muted whitespace-nowrap">→ {champ}</span>
                  {req && <span className="text-danger font-bold flex-shrink-0">*</span>}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-fg-subtle mt-2">* obligatoire</p>
          </Card>

          <Card padding="sm">
            <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-2">Comportement</p>
            <ul className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
              <li>• Espèce inconnue → ligne ignorée (listée dans les erreurs)</li>
              <li>• Container absent → créé automatiquement</li>
              <li>• idTerrain déjà présent → ligne ignorée (doublon)</li>
              <li>• Position plaque déjà occupée → ligne ignorée</li>
              <li>• L'import peut être relancé sans risque si interrompu</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
