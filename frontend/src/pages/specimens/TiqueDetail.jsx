import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Microscope, MapPin, FlaskConical, FileText,
  Pencil, Trash2, Save, X, Bird,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, CardHeader, CardTitle, Badge, Button, PageHeader, Spinner } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

function taxoLabel(t) {
  if (!t) return '—';
  return `${t.parent?.nom ? t.parent.nom + ' ' : ''}${t.nom}`;
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-0.5">{label}</p>
      <div className="text-sm text-fg">{children}</div>
    </div>
  );
}

function EditSelect({ label, value, onChange, options, disabled }) {
  return (
    <div>
      <label className="text-xs text-fg-subtle font-medium block mb-1">{label}</label>
      <select
        value={value} onChange={onChange} disabled={disabled}
        className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg disabled:opacity-40"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function TiqueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [specimen, setSpecimen]     = useState(null);
  const [solutions, setSolutions]   = useState([]);
  const [taxonomies, setTaxonomies] = useState([]);
  const [loadError, setLoadError]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [editForm, setEditForm]     = useState({});

  useEffect(() => {
    Promise.all([
      api.get(`/tiques/${id}`),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'tique', niveau: 'espece', actif: 'true' } }),
    ])
      .then(([tRes, sRes, txRes]) => {
        setSpecimen(tRes.data.tique);
        setSolutions(sRes.data.items || []);
        setTaxonomies(txRes.data.items || []);
      })
      .catch(() => setLoadError('Impossible de charger ce spécimen.'))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    const t = specimen;
    setEditForm({
      taxonomieId:      String(t.taxonomieId),
      nombre:           String(t.nombre),
      sexe:             t.sexe,
      stade:            t.stade || '',
      gorge:            t.gorge,
      partieCorpsHote:  t.partieCorpsHote || '',
      solutionId:       t.solutionId ? String(t.solutionId) : '',
      dateCollecte:     t.dateCollecte ? t.dateCollecte.split('T')[0] : '',
      notes:            t.notes || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/tiques/${id}`, {
        ...editForm,
        taxonomieId:     parseInt(editForm.taxonomieId),
        nombre:          parseInt(editForm.nombre),
        solutionId:      editForm.solutionId ? parseInt(editForm.solutionId) : null,
        gorge:           editForm.gorge,
        stade:           editForm.stade || null,
        partieCorpsHote: editForm.partieCorpsHote || null,
        dateCollecte:    editForm.dateCollecte || null,
      });
      setSpecimen(r.data.tique);
      setEditing(false);
      toast.success('Tique mise à jour avec succès.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer la tique ${specimen.idTerrain || '#' + id} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/tiques/${id}`);
      toast.success('Tique supprimée.');
      navigate('/specimens/tiques');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  if (loading) return <Spinner.Block label="Chargement…" height="h-40" />;

  if (loadError || !specimen) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-fg-muted">{loadError || 'Spécimen introuvable.'}</p>
      <Link to="/specimens/tiques" className="text-primary text-sm hover:underline">
        ← Retour aux tiques
      </Link>
    </div>
  );

  const t = specimen;

  const taxoOptions     = taxonomies.map(tx => ({ value: String(tx.id), label: tx.parent ? `${tx.parent.nom} ${tx.nom}` : tx.nom }));
  const solutionOptions = [{ value: '', label: '— Aucune —' }, ...solutions.map(s => ({ value: String(s.id), label: s.nom + (s.temperature ? ` (${s.temperature})` : '') }))];
  const stadeOptions    = [{ value: '', label: '—' }, ...['Adulte','Nymphe','Larve','Oeuf'].map(v => ({ value: v, label: v }))];
  const sexeOptions     = [{ value: 'M', label: 'Mâle' }, { value: 'F', label: 'Femelle' }, { value: 'inconnu', label: 'Inconnu' }];

  return (
    <div className="space-y-5">
      <Link to="/specimens/tiques" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Tiques
      </Link>

      <PageHeader
        icon={() => <SpecimenIcon type="tique" size={18} />}
        iconTone="specimen-tique"
        title={<span className="italic">{taxoLabel(t.taxonomie)}</span>}
        subtitle={`Tique · #${t.id}`}
        actions={
          <div className="flex items-center gap-2">
            {t.idTerrain && <Badge tone="primary" className="font-mono font-bold">{t.idTerrain}</Badge>}
            <Badge tone="specimen-tique">Tique</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,220px] gap-5 items-start">

        {/* ── Colonne principale ── */}
        <div className="space-y-4">

          {/* Identification */}
          <Card>
            <CardHeader>
              <CardTitle icon={Microscope}>Identification</CardTitle>
            </CardHeader>

            {editing ? (
              <div className="space-y-4">
                <EditSelect label="Espèce" value={editForm.taxonomieId}
                  onChange={e => setEditForm(f => ({ ...f, taxonomieId: e.target.value }))}
                  options={taxoOptions} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-fg-subtle font-medium block mb-1">Nombre</label>
                    <input type="number" min="1" value={editForm.nombre}
                      onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                    />
                  </div>
                  <EditSelect label="Stade" value={editForm.stade}
                    onChange={e => setEditForm(f => ({ ...f, stade: e.target.value }))}
                    options={stadeOptions} />
                  <EditSelect label="Sexe" value={editForm.sexe}
                    onChange={e => setEditForm(f => ({ ...f, sexe: e.target.value }))}
                    options={sexeOptions} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-fg-subtle font-medium block mb-1">Partie du corps (hôte)</label>
                    <input type="text" value={editForm.partieCorpsHote}
                      onChange={e => setEditForm(f => ({ ...f, partieCorpsHote: e.target.value }))}
                      placeholder="ex. Oreille, Cou…"
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="edit-gorge" checked={editForm.gorge}
                      onChange={e => setEditForm(f => ({ ...f, gorge: e.target.checked }))}
                      className="w-4 h-4 rounded border-border text-primary"
                    />
                    <label htmlFor="edit-gorge" className="text-sm text-fg">Gorgée de sang</label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <Field label="Espèce">
                    <span className="italic font-semibold text-specimen-tique">{taxoLabel(t.taxonomie)}</span>
                  </Field>
                </div>
                <Field label="Sexe"><Badge tone={SEXE_TONE[t.sexe] ?? 'default'}>{SEXE_LABEL[t.sexe] ?? '—'}</Badge></Field>
                <Field label="Nombre">{t.nombre}</Field>
                {t.stade && <Field label="Stade">{t.stade}</Field>}
                <Field label="Gorgée">
                  <Badge tone={t.gorge ? 'danger' : 'default'}>{t.gorge ? 'Oui' : 'Non'}</Badge>
                </Field>
                {t.partieCorpsHote && <Field label="Partie du corps (hôte)">{t.partieCorpsHote}</Field>}
              </div>
            )}
          </Card>

          {/* Hôte */}
          {t.hote && (
            <Card>
              <CardHeader>
                <CardTitle icon={Bird}>Hôte associé</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Espèce hôte">{t.hote.taxonomieHote?.nom || '—'}</Field>
                {t.hote.nom && <Field label="Identifiant hôte">{t.hote.nom}</Field>}
              </div>
            </Card>
          )}

          {/* Localisation */}
          <Card>
            <CardHeader>
              <CardTitle icon={MapPin}>Localisation</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                <span className="font-medium text-fg">
                  {t.methode?.localite?.mission?.projet?.code}
                </span>
                <span className="text-fg-subtle">›</span>
                <span>{t.methode?.localite?.mission?.ordreMission}</span>
                <span className="text-fg-subtle">›</span>
                <span className="font-medium text-fg">{t.methode?.localite?.nom}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {t.methode?.localite?.region && (
                  <Field label="Région">{t.methode.localite.region}</Field>
                )}
                {t.methode?.typeMethode && (
                  <Field label="Méthode de collecte">
                    {t.methode.typeMethode.code} — {t.methode.typeMethode.nom}
                  </Field>
                )}
              </div>
            </div>
          </Card>

          {/* Conservation */}
          <Card>
            <CardHeader>
              <CardTitle icon={FlaskConical}>Conservation</CardTitle>
            </CardHeader>
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditSelect label="Solution de conservation" value={editForm.solutionId}
                  onChange={e => setEditForm(f => ({ ...f, solutionId: e.target.value }))}
                  options={solutionOptions} />
                <div>
                  <label className="text-xs text-fg-subtle font-medium block mb-1">Date de collecte</label>
                  <input type="date" value={editForm.dateCollecte}
                    onChange={e => setEditForm(f => ({ ...f, dateCollecte: e.target.value }))}
                    className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Solution">{t.solution?.nom || '—'}</Field>
                {t.container && (
                  <Field label="Container">
                    <span className="font-mono">{t.container.code}</span>
                    {t.position && <span className="text-fg-muted"> — pos. {t.position}</span>}
                  </Field>
                )}
                <Field label="Date de collecte">
                  {t.dateCollecte ? new Date(t.dateCollecte).toLocaleDateString('fr-FR') : '—'}
                </Field>
              </div>
            )}
          </Card>

          {/* Notes */}
          {(t.notes || editing) && (
            <Card>
              <CardHeader>
                <CardTitle icon={FileText}>Notes et observations</CardTitle>
              </CardHeader>
              {editing ? (
                <textarea rows={4} value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observations particulières…"
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg resize-none"
                />
              ) : (
                <p className="text-sm text-fg-muted whitespace-pre-line">{t.notes}</p>
              )}
            </Card>
          )}

        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4 xl:sticky xl:top-4 self-start">

          <Card padding="sm">
            <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3">Actions</p>
            <div className="space-y-2">
              {editing ? (
                <>
                  <Button variant="primary" className="w-full justify-center" icon={Save}
                    loading={saving} onClick={handleSave}>Enregistrer</Button>
                  <Button variant="secondary" className="w-full justify-center" icon={X}
                    onClick={() => setEditing(false)} disabled={saving}>Annuler</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full justify-center" icon={Pencil} onClick={startEdit}>
                    Modifier
                  </Button>
                  {isAdmin && (
                    <Button variant="danger" className="w-full justify-center" icon={Trash2}
                      loading={deleting} onClick={handleDelete}>Supprimer</Button>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card padding="sm" tone="muted">
            <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-2">Métadonnées</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-fg-subtle">ID interne</span>
                <span className="font-mono text-fg">#{t.id}</span>
              </div>
              {t.idTerrain && (
                <div className="flex justify-between">
                  <span className="text-fg-subtle">ID terrain</span>
                  <span className="font-mono font-bold text-primary">{t.idTerrain}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-fg-subtle">Nombre</span>
                <span className="font-medium text-fg">{t.nombre}</span>
              </div>
            </div>
          </Card>

        </aside>
      </div>
    </div>
  );
}
