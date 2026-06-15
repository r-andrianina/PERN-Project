import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Microscope, MapPin, FlaskConical, FileText,
  Pencil, Trash2, Save, X,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, CardHeader, CardTitle, Badge, Button, PageHeader, Spinner, Select } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { STADE_OPTIONS_MOUSTIQUE, formatStade } from '../../utils/stade';
import { GORGEMENT_OPTIONS, formatGorgement } from '../../utils/gorgement';

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
      <Select
        value={value}
        onChange={(val) => onChange({ target: { value: val } })}
        disabled={disabled}
        options={options}
      />
    </div>
  );
}

export default function MoustiqueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [specimen, setSpecimen]   = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [taxonomies, setTaxonomies] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [editForm, setEditForm]   = useState({});

  useEffect(() => {
    Promise.all([
      api.get(`/moustiques/${id}`),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'moustique', niveau: 'espece', actif: 'true' } }),
    ])
      .then(([mRes, sRes, tRes]) => {
        setSpecimen(mRes.data.moustique);
        setSolutions(sRes.data.items || []);
        setTaxonomies(tRes.data.items || []);
      })
      .catch(() => setLoadError('Impossible de charger ce spécimen.'))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    const m = specimen;
    setEditForm({
      taxonomieId:   String(m.taxonomieId),
      nombre:        String(m.nombre),
      sexe:          m.sexe,
      stade:         m.stade || '',
      parite:        m.parite || '',
      repasSang:     m.repasSang,
      organePreleve: m.organePreleve || '',
      solutionId:    m.solutionId ? String(m.solutionId) : '',
      dateCollecte:  m.dateCollecte ? m.dateCollecte.split('T')[0] : '',
      notes:         m.notes || '',
    });
    setEditing(true);
  };

  const handleStadeChange = (stade) => {
    const immature = stade === 'L' || stade === 'E';
    setEditForm(f => ({
      ...f, stade,
      sexe:      immature ? 'inconnu' : f.sexe,
      parite:    immature ? '' : f.parite,
      repasSang: immature ? 'N' : f.repasSang,
    }));
  };

  const handleSexeChange = (sexe) => {
    setEditForm(f => ({
      ...f, sexe,
      parite:    sexe !== 'F' ? '' : f.parite,
      repasSang: sexe !== 'F' ? 'N' : f.repasSang,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/moustiques/${id}`, {
        ...editForm,
        taxonomieId: parseInt(editForm.taxonomieId),
        nombre:      parseInt(editForm.nombre),
        solutionId:  editForm.solutionId ? parseInt(editForm.solutionId) : null,
        repasSang:   editForm.repasSang,
        dateCollecte: editForm.dateCollecte || null,
        stade:       editForm.stade || null,
        parite:      editForm.parite || null,
        organePreleve: editForm.organePreleve || null,
      });
      setSpecimen(r.data.moustique);
      setEditing(false);
      toast.success('Moustique mis à jour avec succès.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer le moustique ${specimen.idTerrain || '#' + id} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/moustiques/${id}`);
      toast.success('Moustique supprimé.');
      navigate('/specimens/moustiques');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  if (loading) return <Spinner.Block label="Chargement…" height="h-40" />;

  if (loadError || !specimen) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-fg-muted">{loadError || 'Spécimen introuvable.'}</p>
      <Link to="/specimens/moustiques" className="text-primary text-sm hover:underline">
        ← Retour aux moustiques
      </Link>
    </div>
  );

  const m = specimen;
  const stadeImmature  = editForm.stade === 'L' || editForm.stade === 'E';
  const sexeForce      = stadeImmature ? 'inconnu' : editForm.sexe;
  const pariteDisabled = stadeImmature || sexeForce !== 'F';
  const repasSangOff   = stadeImmature || sexeForce !== 'F';

  const taxoOptions    = taxonomies.map(t => ({ value: String(t.id), label: t.parent ? `${t.parent.nom} ${t.nom}` : t.nom }));
  const solutionOptions = [{ value: '', label: '— Aucune —' }, ...solutions.map(s => ({ value: String(s.id), label: s.nom + (s.temperature ? ` (${s.temperature})` : '') }))];
  const stadeOptions   = [{ value: '', label: '—' }, ...STADE_OPTIONS_MOUSTIQUE];
  const sexeOptions    = [{ value: 'M', label: 'Mâle' }, { value: 'F', label: 'Femelle' }, { value: 'inconnu', label: 'Inconnu' }];
  const pariteOptions  = [{ value: '', label: '—' }, ...['Nulle','Paucie','Multi'].map(v => ({ value: v, label: v }))];
  const organeOptions  = [{ value: '', label: '—' }, ...['Tête','Thorax','Abdomen','Entier'].map(v => ({ value: v, label: v }))];

  return (
    <div className="space-y-5">
      <Link to="/specimens/moustiques" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Moustiques
      </Link>

      <PageHeader
        icon={() => <SpecimenIcon type="moustique" size={18} />}
        iconTone="specimen-moustique"
        title={<span className="italic">{taxoLabel(m.taxonomie)}</span>}
        subtitle={`Moustique · #${m.id}`}
        actions={
          <div className="flex items-center gap-2">
            {m.idTerrain && (
              <Badge tone="primary" className="font-mono font-bold">{m.idTerrain}</Badge>
            )}
            <Badge tone="specimen-moustique">Moustique</Badge>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-fg-subtle font-medium block mb-1">Nombre</label>
                    <input type="number" min="1"
                      value={editForm.nombre}
                      onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                    />
                  </div>
                  <EditSelect label="Stade" value={editForm.stade}
                    onChange={e => handleStadeChange(e.target.value)}
                    options={stadeOptions} />
                  <EditSelect label="Sexe" value={sexeForce}
                    onChange={e => handleSexeChange(e.target.value)}
                    options={sexeOptions} disabled={stadeImmature} />
                  <EditSelect label="Parité" value={editForm.parite}
                    onChange={e => setEditForm(f => ({ ...f, parite: e.target.value }))}
                    options={pariteOptions} disabled={pariteDisabled} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <EditSelect label="Organe prélevé" value={editForm.organePreleve}
                    onChange={e => setEditForm(f => ({ ...f, organePreleve: e.target.value }))}
                    options={organeOptions} />
                  <EditSelect label="Statut sanguin" value={editForm.repasSang}
                    onChange={e => setEditForm(f => ({ ...f, repasSang: e.target.value }))}
                    options={GORGEMENT_OPTIONS} disabled={repasSangOff} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <Field label="Espèce">
                    <span className="italic font-semibold text-specimen-moustique">{taxoLabel(m.taxonomie)}</span>
                  </Field>
                </div>
                <Field label="Sexe"><Badge tone={SEXE_TONE[m.sexe] ?? 'default'}>{SEXE_LABEL[m.sexe] ?? '—'}</Badge></Field>
                <Field label="Nombre">{m.nombre}</Field>
                {m.stade         && <Field label="Stade">{formatStade(m.stade)}</Field>}
                {m.parite        && <Field label="Parité">{m.parite}</Field>}
                {m.organePreleve && <Field label="Organe prélevé">{m.organePreleve}</Field>}
                <Field label="Statut sanguin">
                  <Badge tone={['G', 'Gr'].includes(m.repasSang) ? 'danger' : 'default'}>{formatGorgement(m.repasSang)}</Badge>
                </Field>
              </div>
            )}
          </Card>

          {/* Localisation */}
          <Card>
            <CardHeader>
              <CardTitle icon={MapPin}>Localisation</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                <span className="font-medium text-fg">
                  {m.methode?.localite?.mission?.projet?.nom || m.methode?.localite?.mission?.projet?.code}
                </span>
                <ChevronRight />
                <span>{m.methode?.localite?.mission?.ordreMission}</span>
                <ChevronRight />
                <span className="font-medium text-fg">{m.methode?.localite?.nom}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {m.methode?.localite?.region && (
                  <Field label="Région">{m.methode.localite.region}</Field>
                )}
                {m.methode?.typeMethode && (
                  <Field label="Méthode de collecte">
                    {m.methode.typeMethode.code} — {m.methode.typeMethode.nom}
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
                  <input type="date"
                    value={editForm.dateCollecte}
                    onChange={e => setEditForm(f => ({ ...f, dateCollecte: e.target.value }))}
                    className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Solution">{m.solution?.nom || '—'}</Field>
                {m.container && (
                  <Field label="Container">
                    <span className="font-mono">{m.container.code}</span>
                    {m.position && <span className="text-fg-muted"> — pos. {m.position}</span>}
                  </Field>
                )}
                <Field label="Date de collecte">
                  {m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString('fr-FR') : '—'}
                </Field>
              </div>
            )}
          </Card>

          {/* Notes */}
          {(m.notes || editing) && (
            <Card>
              <CardHeader>
                <CardTitle icon={FileText}>Notes et observations</CardTitle>
              </CardHeader>
              {editing ? (
                <textarea
                  rows={4}
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observations particulières…"
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg resize-none"
                />
              ) : (
                <p className="text-sm text-fg-muted whitespace-pre-line">{m.notes}</p>
              )}
            </Card>
          )}

        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4 xl:sticky xl:top-4 self-start">

          {/* Actions */}
          <Card padding="sm">
            <p className="text-xs font-semibold text-fg uppercase tracking-wider mb-3">Actions</p>
            <div className="space-y-2">
              {editing ? (
                <>
                  <Button variant="primary" className="w-full justify-center" icon={Save}
                    loading={saving} onClick={handleSave}>
                    Enregistrer
                  </Button>
                  <Button variant="secondary" className="w-full justify-center" icon={X}
                    onClick={() => setEditing(false)} disabled={saving}>
                    Annuler
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full justify-center" icon={Pencil} onClick={startEdit}>
                    Modifier
                  </Button>
                  {isAdmin && (
                    <Button variant="danger" className="w-full justify-center" icon={Trash2}
                      loading={deleting} onClick={handleDelete}>
                      Supprimer
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Métadonnées */}
          <Card padding="sm" tone="muted">
            <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-2">Métadonnées</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-fg-subtle">ID interne</span>
                <span className="font-mono text-fg">#{m.id}</span>
              </div>
              {m.idTerrain && (
                <div className="flex justify-between">
                  <span className="text-fg-subtle">ID terrain</span>
                  <span className="font-mono font-bold text-primary">{m.idTerrain}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-fg-subtle">Nombre</span>
                <span className="font-medium text-fg">{m.nombre}</span>
              </div>
            </div>
          </Card>

        </aside>
      </div>
    </div>
  );
}

function ChevronRight() {
  return <span className="text-fg-subtle">›</span>;
}
