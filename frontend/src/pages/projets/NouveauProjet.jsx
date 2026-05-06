import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, FolderOpen, Check, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import FormField from '../../components/FormField';

export default function NouveauProjet() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    code: '', nom: '', description: '',
    responsableId: '', dateDebut: '', dateFin: '', statut: 'actif',
  });
  const [users, setUsers]       = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors]     = useState({});

  useEffect(() => {
    api.get('/auth/users').then(r => setUsers(r.data.actifs)).catch(console.error);
  }, []);

  const handleChange = (e) => {
    setErrors({ ...errors, [e.target.name]: null });
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const errs = {};
    if (!form.code) errs.code = 'Le code est obligatoire';
    if (!form.nom)  errs.nom  = 'Le nom est obligatoire';
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

  const userOptions   = users.map(u => ({ value: u.id, label: `${u.prenom} ${u.nom}` }));
  const statutOptions = [
    { value: 'actif',    label: 'Actif'    },
    { value: 'termine',  label: 'Terminé'  },
    { value: 'suspendu', label: 'Suspendu' },
  ];

  return (
    <div className="max-w-2xl space-y-5">

      <Link to="/projets" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ChevronLeft size={16} /> Projets
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">
            {errors.submit}
          </div>
        )}

        <div className="card p-6">
          <h2 className="section-title">
            <FolderOpen size={17} className="text-primary-500" />
            Informations du projet
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Code projet" name="code"
                value={form.code} onChange={handleChange}
                placeholder="ex: PROJ-2025-01" required
                error={errors.code} hint="Lettres, chiffres et tirets"
              />
              <FormField
                label="Statut" name="statut" type="select"
                value={form.statut} onChange={handleChange}
                options={statutOptions}
              />
            </div>

            <FormField
              label="Nom du projet" name="nom"
              value={form.nom} onChange={handleChange}
              placeholder="ex: Surveillance vecteurs 2025" required
              error={errors.nom}
            />

            <FormField
              label="Description" name="description" type="textarea"
              value={form.description} onChange={handleChange}
              placeholder="Objectifs, contexte, équipes concernées..."
            />

            <FormField
              label="Responsable" name="responsableId" type="select"
              value={form.responsableId} onChange={handleChange}
              options={userOptions}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Date de début" name="dateDebut" type="date"
                value={form.dateDebut} onChange={handleChange}
              />
              <FormField
                label="Date de fin" name="dateFin" type="date"
                value={form.dateFin} onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/projets" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" /> Création...</>
              : <><Check size={15} /> Créer le projet</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
