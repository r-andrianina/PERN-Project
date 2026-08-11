import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, FolderOpen, Briefcase, Calendar, User, Info } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import AutocompleteUser from '../../components/AutocompleteUser';
import { Card } from '../../components/ui';
import { useFormSubmit } from '../../hooks';
import { useApiQuery } from '../../hooks';
import { useT, interpolate } from '../../lib/i18n';

const STATUT_CLS = {
  actif:    'bg-success/10 text-success border-success/20',
  termine:  'bg-surface-3 text-fg-muted border-border-strong',
  suspendu: 'bg-warning/10 text-warning border-warning/20',
};

export default function NouveauProjet() {
  const t = useT();
  const navigate = useNavigate();

  // Chargement des utilisateurs pour l'autocomplete
  const { data: usersData } = useApiQuery('/auth/users', {
    select: (r) => r.actifs || [],
  });
  const users = usersData ?? [];

  // Formulaire
  const { form, setField, handleChange, errors, isLoading, handleSubmit } = useFormSubmit({
    initial: {
      nom: '', porteur: '', posteAnalytique: '', responsableId: '',
      dateDebut: '', dateFin: '', statut: 'actif',
    },
    validate: (f) => ({
      nom:     !f.nom  && t('nouveauProjet.nameRequired'),
      dateFin: f.dateDebut && f.dateFin && f.dateFin < f.dateDebut && t('nouveauProjet.endAfterStart'),
    }),
    onSubmit: (f) => api.post('/projets', {
      ...f,
      responsableId: f.responsableId ? parseInt(f.responsableId) : null,
    }),
    onSuccess: (res) => navigate(`/projets/${res.data.projet.id}`),
  });

  const handlePorteurChange = (text, userId) => {
    setField('porteur', text);
    setField('responsableId', userId || '');
  };

  const matchedUser = form.responsableId ? users.find((u) => u.id === parseInt(form.responsableId)) : null;
  const dureeJours = form.dateDebut && form.dateFin
    ? Math.max(0, Math.round((new Date(form.dateFin) - new Date(form.dateDebut)) / (1000 * 60 * 60 * 24)))
    : null;

  const statutOptions = [
    { value: 'actif',    label: t('projetStatus.actif')    },
    { value: 'termine',  label: t('projetStatus.termine')  },
    { value: 'suspendu', label: t('projetStatus.suspendu') },
  ];

  return (
    <div className="space-y-5">
      <Link to="/projets" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> {t('nouveauProjet.backToList')}
      </Link>

      <form onSubmit={handleSubmit}>
        {errors.submit && (
          <div className="p-4 mb-5 bg-danger/10 border border-danger/20 rounded-2xl text-sm text-danger">
            {errors.submit}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-5">

          {/* Formulaire principal */}
          <Card padding="md">
            <h2 className="section-title">
              <FolderOpen size={17} className="text-primary" />
              {t('nouveauProjet.projectInfo')}
            </h2>
            <div className="space-y-5">
              <FormField label={t('nouveauProjet.projectName')} name="nom"
                value={form.nom} onChange={handleChange}
                placeholder={t('nouveauProjet.projectNamePlaceholder')} required
                error={errors.nom} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AutocompleteUser
                  label={t('nouveauProjet.projectLead')}
                  value={form.porteur}
                  onChange={handlePorteurChange}
                  users={users}
                  placeholder={t('nouveauProjet.leadPlaceholder')}
                  hint={matchedUser ? interpolate(t('nouveauProjet.linkedToUser'), { email: matchedUser.email }) : t('nouveauProjet.freeTextHint')}
                />
                <FormField label={t('nouveauProjet.status')} name="statut" type="select"
                  value={form.statut} onChange={handleChange} options={statutOptions} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('nouveauProjet.startDate')} name="dateDebut" type="date"
                  value={form.dateDebut} onChange={handleChange} />
                <FormField label={t('nouveauProjet.endDate')} name="dateFin" type="date"
                  value={form.dateFin} onChange={handleChange} error={errors.dateFin} />
              </div>

              <FormField label={t('nouveauProjet.analyticCode')} name="posteAnalytique"
                value={form.posteAnalytique} onChange={handleChange}
                placeholder="ex: PA-2026-014"
                hint={t('nouveauProjet.analyticCodeHint')} />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-border">
              <Link to="/projets" className="btn-secondary">{t('common.cancel')}</Link>
              <button type="submit" disabled={isLoading} className="btn-primary">
                {isLoading ? t('nouveauProjet.creating') : t('nouveauProjet.createProject')}
              </button>
            </div>
          </Card>

          {/* Sidebar aperçu */}
          <aside className="space-y-4 self-start">
            <Card tone="primary" padding="sm">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase size={14} className="text-primary" />
                <p className="text-xs font-semibold text-fg uppercase tracking-wider">{t('nouveauProjet.preview')}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">{t('nouveauProjet.name')}</span>
                  <p className="text-sm font-semibold text-fg mt-0.5">
                    {form.nom || <span className="text-fg-subtle font-normal italic">{t('nouveauProjet.undefined')}</span>}
                  </p>
                </div>
                {form.porteur && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User size={11} className="text-fg-subtle" />
                      <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">{t('nouveauProjet.lead')}</span>
                    </div>
                    <p className="text-xs text-fg">
                      {form.porteur}
                      {matchedUser && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{t('nouveauProjet.userTag')}</span>}
                    </p>
                  </div>
                )}
                {(form.dateDebut || form.dateFin) && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={11} className="text-fg-subtle" />
                      <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">{t('nouveauProjet.period')}</span>
                    </div>
                    <p className="text-xs text-fg">
                      {form.dateDebut ? new Date(form.dateDebut).toLocaleDateString(t('common.locale')) : '?'}
                      {' → '}
                      {form.dateFin   ? new Date(form.dateFin).toLocaleDateString(t('common.locale'))   : '?'}
                    </p>
                    {dureeJours !== null && (
                      <p className="text-[10px] text-fg-subtle mt-0.5">{dureeJours} {t('nouveauProjet.days')}</p>
                    )}
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">{t('nouveauProjet.status')}</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUT_CLS[form.statut]}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      {t(`projetStatus.${form.statut}`)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="sm">
              <div className="flex items-center gap-2 mb-2">
                <Info size={13} className="text-info" />
                <p className="text-xs font-semibold text-fg">{t('nouveauProjet.help')}</p>
              </div>
              <ul className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <li>• {t('nouveauProjet.helpLeadPrefix')} <strong>{t('nouveauProjet.leadWord')}</strong> {t('nouveauProjet.helpLeadSuffix')}</li>
                <li>• {t('nouveauProjet.helpMissions')}</li>
              </ul>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  );
}
