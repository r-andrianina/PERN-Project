import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, FileSpreadsheet } from 'lucide-react';
import api from '../../api/axios';
import ReferentielSimplePage from './ReferentielSimplePage';
import useAuthStore from '../../store/authStore';
import { Button } from '../../components/ui';
import { useT, interpolate } from '../../lib/i18n';
import { hasMinRole } from '../../lib/roles';

const getConfig = (t, peutImporter) => ({
  endpoint:     'personnel',
  label:        t('personnel.label'),
  labelPluriel: t('personnel.titre'),
  fields: [
    { name: 'nom',      label: t('personnel.fieldNom'), required: true, hint: t('personnel.fieldNomHint') },
    { name: 'fonction', label: t('personnel.fieldFonction'), placeholder: t('personnel.fieldFonctionPlaceholder') },
    { name: 'equipe',   label: t('personnel.fieldEquipe') },
  ],
  listColumns: [
    { key: 'nom',      header: t('personnel.fieldNom') },
    { key: 'fonction', header: t('personnel.fieldFonction'),
      render: (i) => <span className="text-fg-muted text-xs">{i.fonction || '—'}</span> },
    { key: 'equipe',   header: t('personnel.fieldEquipe'),
      render: (i) => <span className="text-fg-muted text-xs">{i.equipe || '—'}</span> },
    { key: 'usage', header: t('personnel.colMissions'),
      render: (i) => (i._count?.missionsChef ?? 0) + (i._count?.missions ?? 0) },
  ],
  headerActions: peutImporter ? ({ refresh }) => <ImportAnnuaire onImported={refresh} /> : undefined,
});

// ── Import de l'annuaire ──────────────────────────────────────────
// Tout ou rien côté serveur : une ligne fautive bloque l'import et la liste
// des lignes à corriger s'affiche ici, pour renvoyer le fichier corrigé.
function ImportAnnuaire({ onImported }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const fermer = () => { setOpen(false); setFile(null); setResult(null); setError(null); };

  const envoyer = async () => {
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post('/dictionnaire/personnel/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data);
      onImported();
    } catch (err) {
      setError({ message: err.response?.data?.error || t('common.error'), erreurs: err.response?.data?.erreurs ?? [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="secondary" icon={Upload} onClick={() => setOpen(true)}>{t('personnel.importBtn')}</Button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-4 sm:mt-16">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-primary" /> {t('personnel.importTitle')}
              </h2>
              <button type="button" onClick={fermer} className="p-1 text-fg-subtle hover:text-fg"><X size={18} /></button>
            </div>
            <p className="text-xs text-fg-muted">{t('personnel.importHelp')}</p>

            <input
              type="file" accept=".xlsx"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
              className="block w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-medium"
            />

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger space-y-1.5">
                <p className="font-semibold">{error.message}</p>
                {error.erreurs.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto space-y-0.5">
                    {error.erreurs.map((e) => (
                      <li key={e.ligne}>{interpolate(t('personnel.importLigne'), { n: e.ligne })} — {e.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {result && (
              <div className="p-3 bg-success/10 border border-success/20 rounded-xl text-xs text-fg space-y-1.5">
                <p className="font-semibold text-success">
                  {interpolate(t('personnel.importDone'), { c: result.creees, m: result.misesAJour, i: result.inchangees })}
                </p>
                {result.absentes?.length > 0 && (
                  <>
                    <p className="text-fg-muted">{interpolate(t('personnel.importAbsentes'), { n: result.absentes.length })}</p>
                    <ul className="max-h-40 overflow-y-auto list-disc pl-4 text-fg-muted">
                      {result.absentes.map((nom) => <li key={nom}>{nom}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={fermer} className="btn-secondary">{t('personnel.close')}</button>
              {!result && (
                <Button icon={Upload} onClick={envoyer} disabled={!file} loading={loading}>{t('personnel.importRun')}</Button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default function PersonnelPage() {
  const t = useT();
  const { user } = useAuthStore();
  const peutImporter = hasMinRole(user?.role, 'superviseur');
  return <ReferentielSimplePage config={getConfig(t, peutImporter)} />;
}
