import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, PawPrint, Stethoscope, FileText, Info } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import IdTerrainField from '../../components/IdTerrainField';
import { Card } from '../../components/ui';
import { useFormSubmit, useApiQueries } from '../../hooks';
import { useT } from '../../lib/i18n';

export default function NouvelHote() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { results, loading: loadingRefs } = useApiQueries([
    { url: '/methodes', key: 'methodes', select: (r) => r.methodes ?? [] },
    { url: '/dictionnaire/taxonomie-hotes', params: { niveau: 'espece', actif: 'true' }, key: 'taxonomies', select: (r) => r.items ?? [] },
  ]);
  const methodes   = results.methodes   ?? [];
  const taxonomies = results.taxonomies ?? [];

  const { form, handleChange, setField, errors, isLoading, handleSubmit } = useFormSubmit({
    initial: {
      methodeId:       searchParams.get('methodeId') || '',
      idTerrain:       '',
      taxonomieHoteId: '',
      especeLocale:    '',
      age:             '',
      sexe:            'inconnu',
      etatSante:       '',
      vaccination:     '',
      notes:           '',
    },
    validate: (f) => ({
      methodeId:       !f.methodeId       && t('nouvelHote.methodeRequired'),
      taxonomieHoteId: !f.taxonomieHoteId && t('nouvelHote.taxonomieRequired'),
    }),
    onSubmit: (f) => api.post('/hotes', {
      methodeId:       parseInt(f.methodeId),
      idTerrain:       f.idTerrain || null,
      taxonomieHoteId: parseInt(f.taxonomieHoteId),
      especeLocale:    f.especeLocale || null,
      age:             f.age          || null,
      sexe:            f.sexe,
      etatSante:       f.etatSante    || null,
      vaccination:     f.vaccination  || null,
      notes:           f.notes        || null,
    }),
    onSuccess: () => navigate('/hotes'),
  });

  const methodeOptions   = methodes.map((m) => ({ value: m.id, label: `${m.typeMethode?.nom || t('nouvelHote.methodeFallback')} — ${m.localite?.nom || ''}` }));
  const taxonomieOptions = taxonomies.map((tax) => ({ value: tax.id, label: `${tax.parent ? tax.parent.nom + ' ' : ''}${tax.nom}${tax.nomCommun ? ' (' + tax.nomCommun + ')' : ''}` }));
  const sexeOptions  = [{ value: 'M', label: t('sexe.M') }, { value: 'F', label: t('sexe.F') }, { value: 'inconnu', label: t('sexe.inconnu') }];
  const etatOptions  = [
    { value: 'Bon', label: t('nouvelHote.etatBon') },
    { value: 'Moyen', label: t('nouvelHote.etatMoyen') },
    { value: 'Mauvais', label: t('nouvelHote.etatMauvais') },
    { value: 'Mort', label: t('nouvelHote.etatMort') },
  ];

  const selectedTaxo    = taxonomies.find((tax) => tax.id === parseInt(form.taxonomieHoteId));
  const selectedMethode = methodes.find((m) => m.id === parseInt(form.methodeId));

  return (
    <div className="space-y-5">
      <Link to="/hotes" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> {t('nouvelHote.backToHotes')}
      </Link>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,280px] gap-5 items-start">

          {/* ═══ Formulaire ═══ */}
          <div className="space-y-5">
            {errors.submit && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">{errors.submit}</div>
            )}

            <div className="card p-6">
              <h2 className="section-title"><PawPrint size={17} className="text-warning" /> {t('nouvelHote.identification')}</h2>
              <div className="space-y-4">
                <FormField label={t('nouvelHote.methodeLabel')} name="methodeId" type="select"
                  value={form.methodeId} onChange={handleChange}
                  options={methodeOptions} required error={errors.methodeId} disabled={loadingRefs} />
                <IdTerrainField
                  methodeId={form.methodeId}
                  value={form.idTerrain}
                  onChange={(v) => setField('idTerrain', v)}
                  error={errors.idTerrain}
                  buildPreviewUrl={(id) => `/methodes/${id}/preview-hote-id`}
                  label={t('nouvelHote.identifiantHote')}
                  formatHint="HOTE_<AAAAMM>_<n>"
                />
                <FormField label={t('nouvelHote.especeHoteRef')} name="taxonomieHoteId" type="select"
                  value={form.taxonomieHoteId} onChange={handleChange}
                  options={taxonomieOptions} required error={errors.taxonomieHoteId}
                  hint={t('nouvelHote.especeHint')} disabled={loadingRefs} />
                <FormField label={t('nouvelHote.especeLocaleLabel')} name="especeLocale"
                  value={form.especeLocale} onChange={handleChange}
                  placeholder={t('nouvelHote.especeLocalePlaceholder')} hint={t('nouvelHote.especeLocaleHint')} />
              </div>
            </div>

            <div className="card p-6">
              <h2 className="section-title"><Stethoscope size={17} className="text-success" /> {t('nouvelHote.caracteristiques')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label={t('nouvelHote.sexe')} name="sexe" type="select" value={form.sexe} onChange={handleChange} options={sexeOptions} />
                <FormField label={t('nouvelHote.age')} name="age" value={form.age} onChange={handleChange} placeholder={t('nouvelHote.agePlaceholder')} />
                <FormField label={t('nouvelHote.etatSante')} name="etatSante" type="select" value={form.etatSante} onChange={handleChange} options={etatOptions} />
              </div>
              <div className="mt-4">
                <FormField label={t('nouvelHote.vaccination')} name="vaccination" type="textarea"
                  value={form.vaccination} onChange={handleChange}
                  placeholder={t('nouvelHote.vaccinationPlaceholder')} />
              </div>
            </div>

            <div className="card p-6">
              <h2 className="section-title"><FileText size={17} className="text-fg-subtle" /> {t('nouvelHote.notes')}</h2>
              <FormField name="notes" type="textarea" value={form.notes} onChange={handleChange}
                placeholder={t('nouvelHote.notesPlaceholder')} />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Link to="/hotes" className="btn-secondary">{t('nouvelHote.cancel')}</Link>
              <button type="submit" disabled={isLoading || loadingRefs} className="btn-primary">
                {isLoading ? t('nouvelHote.saving') : t('nouvelHote.saveHote')}
              </button>
            </div>
          </div>

          {/* ═══ Sidebar ═══ */}
          <aside className="space-y-4 xl:sticky xl:top-4 self-start">

            <Card padding="sm" tone="primary">
              <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PawPrint size={13} className="text-primary" /> {t('nouvelHote.selectedSpecies')}
              </p>
              {selectedTaxo ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold italic text-fg">
                    {selectedTaxo.parent?.nom ? `${selectedTaxo.parent.nom} ` : ''}{selectedTaxo.nom}
                  </p>
                  {selectedTaxo.nomCommun && (
                    <p className="text-xs text-fg-muted">« {selectedTaxo.nomCommun} »</p>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium uppercase">
                    {selectedTaxo.niveau}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-fg-subtle italic">{t('nouvelHote.noSpeciesSelected')}</p>
              )}
            </Card>

            {selectedMethode && (
              <Card padding="sm">
                <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-2">{t('nouvelHote.collecte')}</p>
                <p className="text-xs font-medium text-fg">{selectedMethode.typeMethode?.nom}</p>
                <p className="text-xs text-fg-muted mt-0.5">{selectedMethode.localite?.nom}</p>
                {selectedMethode.localite?.mission?.ordreMission && (
                  <p className="text-[10px] font-mono text-fg-subtle mt-1">{selectedMethode.localite.mission.ordreMission}</p>
                )}
              </Card>
            )}

            <Card padding="sm">
              <p className="text-xs font-semibold text-fg mb-2 flex items-center gap-1.5">
                <Info size={13} className="text-info" /> {t('nouvelHote.help')}
              </p>
              <ul className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <li>• {t('nouvelHote.helpTaxoPrefix')} <strong>{t('nouvelHote.helpTaxoWord')}</strong> {t('nouvelHote.helpTaxoSuffix')}</li>
                <li>• {t('nouvelHote.helpVernPrefix')} <strong>{t('nouvelHote.helpVernWord')}</strong> {t('nouvelHote.helpVernSuffix')}</li>
                <li>• {t('nouvelHote.helpLinked')}</li>
              </ul>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  );
}
