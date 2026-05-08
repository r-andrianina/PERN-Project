import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, FolderOpen, Check, Loader2, Tag, Calendar, User, Info, Briefcase,
} from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';
import AutocompleteUser from '../../components/AutocompleteUser';

const STATUT_INFO = {
  actif:    { label: 'Actif',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  termine:  { label: 'Terminé',  cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  suspendu: { label: 'Suspendu', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function NouveauProjet() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    code: '', nom: '', description: '',
    porteur: '', responsableId: '',
    dateDebut: '', dateFin: '', statut: 'actif',
  });
  const [users, setUsers]       = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors]     = useState({});

  useEffect(() => {
    api.get('/auth/users').then(r => setUsers(r.data.actifs || [])).catch(console.error);
  }, []);

  const handleChange = (e) => {
    setErrors({ ...errors, [e.target.name]: null });
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePorteurChange = (text, userId) => {
    setForm({ ...form, porteur: text, responsableId: userId || '' });
  };

  const validate = () => {
    const errs = {};
    if (!form.code) errs.code = 'Le code est obligatoire';
    if (!form.nom)  errs.nom  = 'Le nom est obligatoire';
    if (form.dateDebut && form.dateFin && form.dateFin < form.dateDebut) {
      errs.dateFin = 'La date de fin doit être postérieure à la date de début';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await api.post('/projets', {
        ...form,
        responsableId: form.responsableId ? parseInt(form.responsableId) : null,
      });
      navigate(`/projets/${res.data.projet.id}`);
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setIsLoading(false);
    }
  };

  const statutOptions = [
    { value: 'actif',    label: 'Actif'    },
    { value: 'termine',  label: 'Terminé'  },
    { value: 'suspendu', label: 'Suspendu' },
  ];

  // Aperçu live
  const dureeJours = form.dateDebut && form.dateFin
    ? Math.max(0, Math.round((new Date(form.dateFin) - new Date(form.dateDebut)) / (1000 * 60 * 60 * 24)))
    : null;
  const matchedUser = form.responsableId
    ? users.find((u) => u.id === parseInt(form.responsableId))
    : null;

  return (
    <div className="space-y-5">
      <Link to="/projets" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ChevronLeft size={16} /> Projets
      </Link>

      <form onSubmit={handleSubmit}>
        {errors.submit && (
          <div className="p-4 mb-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">
            {errors.submit}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-5">

          {/* ═══ Colonne principale ═══ */}
          <div className="card p-6">
            <h2 className="section-title">
              <FolderOpen size={17} className="text-primary-500" />
              Informations du projet
            </h2>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <FormField
                    label="Code projet" name="code"
                    value={form.code} onChange={handleChange}
                    placeholder="ex: PROJ-2025-01" required
                    error={errors.code} hint="Lettres, chiffres et tirets"
                  />
                </div>
                <div className="md:col-span-2">
                  <FormField
                    label="Nom du projet" name="nom"
                    value={form.nom} onChange={handleChange}
                    placeholder="ex: Surveillance vecteurs Madagascar 2026" required
                    error={errors.nom}
                  />
                </div>
              </div>

              <FormField
                label="Description" name="description" type="textarea"
                value={form.description} onChange={handleChange}
                placeholder="Objectifs, contexte, équipes concernées, résultats attendus..."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AutocompleteUser
                  label="Porteur du projet"
                  value={form.porteur}
                  onChange={handlePorteurChange}
                  users={users}
                  placeholder="Saisir un nom ou choisir un utilisateur"
                  hint={matchedUser ? `Lié à l'utilisateur ${matchedUser.email}` : 'Champ libre — peut être un partenaire externe'}
                />
                <FormField
                  label="Statut" name="statut" type="select"
                  value={form.statut} onChange={handleChange}
                  options={statutOptions}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Date de début" name="dateDebut" type="date"
                  value={form.dateDebut} onChange={handleChange}
                />
                <FormField
                  label="Date de fin" name="dateFin" type="date"
                  value={form.dateFin} onChange={handleChange}
                  error={errors.dateFin}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
              <Link to="/projets" className="btn-secondary">Annuler</Link>
              <button type="submit" disabled={isLoading} className="btn-primary">
                {isLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Création...</>
                  : <><Check size={15} /> Créer le projet</>
                }
              </button>
            </div>
          </div>

          {/* ═══ Sidebar : aperçu live + aide ═══ */}
          <aside className="space-y-4 self-start">

            {/* Aperçu live */}
            <div className="card p-5 bg-gradient-to-br from-primary-50/50 to-white border-primary-100">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase size={14} className="text-primary-500" />
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Aperçu</p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Tag size={11} className="text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Code</span>
                  </div>
                  {form.code ? (
                    <p className="text-sm font-mono font-bold text-primary-700 bg-primary-50 inline-block px-2 py-0.5 rounded">
                      {form.code.toUpperCase()}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-300 italic">— à définir —</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Nom</span>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    {form.nom || <span className="text-gray-300 italic font-normal">— à définir —</span>}
                  </p>
                </div>

                {form.porteur && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User size={11} className="text-gray-400" />
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Porteur</span>
                    </div>
                    <p className="text-xs text-gray-700">
                      {form.porteur}
                      {matchedUser && (
                        <span className="ml-1.5 text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-medium">utilisateur</span>
                      )}
                    </p>
                  </div>
                )}

                {(form.dateDebut || form.dateFin) && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={11} className="text-gray-400" />
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Période</span>
                    </div>
                    <p className="text-xs text-gray-700">
                      {form.dateDebut ? new Date(form.dateDebut).toLocaleDateString('fr-FR') : '?'}
                      {' → '}
                      {form.dateFin ? new Date(form.dateFin).toLocaleDateString('fr-FR') : '?'}
                    </p>
                    {dureeJours !== null && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{dureeJours} jour{dureeJours > 1 ? 's' : ''}</p>
                    )}
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Statut</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUT_INFO[form.statut]?.cls}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      {STATUT_INFO[form.statut]?.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Aide */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Info size={13} className="text-blue-500" />
                <p className="text-xs font-semibold text-gray-700">Aide</p>
              </div>
              <ul className="text-[11px] text-gray-500 space-y-1.5 leading-relaxed">
                <li>• Le <strong>code</strong> identifiera ce projet dans tous les exports.</li>
                <li>• Le <strong>porteur</strong> peut être un utilisateur de la base ou un partenaire externe (texte libre).</li>
                <li>• Vous pourrez ajouter des missions une fois le projet créé.</li>
              </ul>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
