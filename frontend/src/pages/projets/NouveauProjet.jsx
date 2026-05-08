import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, FolderOpen, Briefcase, Tag, Calendar, User, Info } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import AutocompleteUser from '../../components/AutocompleteUser';
import { Card } from '../../components/ui';
import { useFormSubmit } from '../../hooks';
import { useApiQuery } from '../../hooks';

const STATUT_INFO = {
  actif:    { label: 'Actif',    cls: 'bg-success/10 text-success border-success/20' },
  termine:  { label: 'Terminé',  cls: 'bg-surface-3 text-fg-muted border-border-strong' },
  suspendu: { label: 'Suspendu', cls: 'bg-warning/10 text-warning border-warning/20' },
};

export default function NouveauProjet() {
  const navigate = useNavigate();

  // Chargement des utilisateurs pour l'autocomplete
  const { data: usersData } = useApiQuery('/auth/users', {
    select: (r) => r.actifs || [],
  });
  const users = usersData ?? [];

  // Formulaire
  const { form, setForm, setField, handleChange, errors, isLoading, handleSubmit } = useFormSubmit({
    initial: {
      code: '', nom: '', description: '',
      porteur: '', responsableId: '',
      dateDebut: '', dateFin: '', statut: 'actif',
    },
    validate: (f) => ({
      code:    !f.code && 'Le code est obligatoire',
      nom:     !f.nom  && 'Le nom est obligatoire',
      dateFin: f.dateDebut && f.dateFin && f.dateFin < f.dateDebut && 'La date de fin doit être postérieure à la date de début',
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
    { value: 'actif',    label: 'Actif'    },
    { value: 'termine',  label: 'Terminé'  },
    { value: 'suspendu', label: 'Suspendu' },
  ];

  return (
    <div className="space-y-5">
      <Link to="/projets" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Projets
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
              Informations du projet
            </h2>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Code projet" name="code"
                  value={form.code} onChange={handleChange}
                  placeholder="ex: PROJ-2025-01" required
                  error={errors.code} hint="Lettres, chiffres et tirets" />
                <div className="md:col-span-2">
                  <FormField label="Nom du projet" name="nom"
                    value={form.nom} onChange={handleChange}
                    placeholder="ex: Surveillance vecteurs Madagascar 2026" required
                    error={errors.nom} />
                </div>
              </div>

              <FormField label="Description" name="description" type="textarea"
                value={form.description} onChange={handleChange}
                placeholder="Objectifs, contexte, équipes concernées..." />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AutocompleteUser
                  label="Porteur du projet"
                  value={form.porteur}
                  onChange={handlePorteurChange}
                  users={users}
                  placeholder="Nom ou choisir un utilisateur"
                  hint={matchedUser ? `Lié à l'utilisateur ${matchedUser.email}` : 'Champ libre — peut être un partenaire externe'}
                />
                <FormField label="Statut" name="statut" type="select"
                  value={form.statut} onChange={handleChange} options={statutOptions} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Date de début" name="dateDebut" type="date"
                  value={form.dateDebut} onChange={handleChange} />
                <FormField label="Date de fin" name="dateFin" type="date"
                  value={form.dateFin} onChange={handleChange} error={errors.dateFin} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-border">
              <Link to="/projets" className="btn-secondary">Annuler</Link>
              <button type="submit" disabled={isLoading} className="btn-primary">
                {isLoading ? 'Création…' : 'Créer le projet'}
              </button>
            </div>
          </Card>

          {/* Sidebar aperçu */}
          <aside className="space-y-4 self-start">
            <Card tone="primary" padding="sm">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase size={14} className="text-primary" />
                <p className="text-xs font-semibold text-fg uppercase tracking-wider">Aperçu</p>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Tag size={11} className="text-fg-subtle" />
                    <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">Code</span>
                  </div>
                  {form.code
                    ? <p className="text-sm font-mono font-bold text-primary bg-primary/10 inline-block px-2 py-0.5 rounded">{form.code.toUpperCase()}</p>
                    : <p className="text-sm text-fg-subtle italic">— à définir —</p>}
                </div>
                <div>
                  <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">Nom</span>
                  <p className="text-sm font-semibold text-fg mt-0.5">
                    {form.nom || <span className="text-fg-subtle font-normal italic">— à définir —</span>}
                  </p>
                </div>
                {form.porteur && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User size={11} className="text-fg-subtle" />
                      <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">Porteur</span>
                    </div>
                    <p className="text-xs text-fg">
                      {form.porteur}
                      {matchedUser && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">utilisateur</span>}
                    </p>
                  </div>
                )}
                {(form.dateDebut || form.dateFin) && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={11} className="text-fg-subtle" />
                      <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">Période</span>
                    </div>
                    <p className="text-xs text-fg">
                      {form.dateDebut ? new Date(form.dateDebut).toLocaleDateString('fr-FR') : '?'}
                      {' → '}
                      {form.dateFin   ? new Date(form.dateFin).toLocaleDateString('fr-FR')   : '?'}
                    </p>
                    {dureeJours !== null && (
                      <p className="text-[10px] text-fg-subtle mt-0.5">{dureeJours} jour{dureeJours > 1 ? 's' : ''}</p>
                    )}
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-medium text-fg-subtle uppercase tracking-wider">Statut</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUT_INFO[form.statut]?.cls}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      {STATUT_INFO[form.statut]?.label}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="sm">
              <div className="flex items-center gap-2 mb-2">
                <Info size={13} className="text-info" />
                <p className="text-xs font-semibold text-fg">Aide</p>
              </div>
              <ul className="text-[11px] text-fg-muted space-y-1.5 leading-relaxed">
                <li>• Le <strong>code</strong> identifiera ce projet dans tous les exports.</li>
                <li>• Le <strong>porteur</strong> peut être un utilisateur de la base ou un partenaire externe.</li>
                <li>• Les missions s'ajoutent après la création du projet.</li>
              </ul>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  );
}
