import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Microscope, FlaskConical, FileText,
  Pencil, Trash2, Save, X, MapPin, Beaker,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, PageHeader, Spinner, Select, Breadcrumb } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { STADE_OPTIONS_MOUSTIQUE, formatStade } from '../../utils/stade';
import { GORGEMENT_OPTIONS, formatGorgement } from '../../utils/gorgement';
import { taxoLabel as _taxoLabel } from '../../utils/taxoLabel';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };
const taxoLabel  = (t) => t ? _taxoLabel(t) : '—';

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-0.5">{label}</p>
      <div className="text-sm text-fg">{children}</div>
    </div>
  );
}

function SidebarRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-[11px] text-fg-subtle shrink-0">{label}</span>
      <span className="text-[11px] text-fg font-medium text-right leading-relaxed">{children}</span>
    </div>
  );
}

function SidebarSection({ icon: Icon, iconClass, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon size={12} className={iconClass ?? 'text-fg-subtle'} />}
        <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">{label}</p>
      </div>
      {children}
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

  const [specimen,   setSpecimen]   = useState(null);
  const [solutions,  setSolutions]  = useState([]);
  const [taxonomies, setTaxonomies] = useState([]);
  const [loadError,  setLoadError]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [editForm,   setEditForm]   = useState({});

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
        taxonomieId:   parseInt(editForm.taxonomieId),
        nombre:        parseInt(editForm.nombre),
        solutionId:    editForm.solutionId ? parseInt(editForm.solutionId) : null,
        repasSang:     editForm.repasSang,
        dateCollecte:  editForm.dateCollecte || null,
        stade:         editForm.stade || null,
        parite:        editForm.parite || null,
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
    const ok = await dialog.confirm({
      title: 'Supprimer ce moustique ?',
      message: `${specimen.idTerrain ? `« ${specimen.idTerrain} »` : `Le spécimen #${id}`} sera définitivement supprimé. Cette action est irréversible.`,
    });
    if (!ok) return;
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
      <Link to="/specimens/moustiques" className="text-primary text-sm hover:underline">← Retour aux moustiques</Link>
    </div>
  );

  const m = specimen;
  const stadeImmature  = editForm.stade === 'L' || editForm.stade === 'E';
  const sexeForce      = stadeImmature ? 'inconnu' : editForm.sexe;
  const pariteDisabled = stadeImmature || sexeForce !== 'F';
  const repasSangOff   = stadeImmature || sexeForce !== 'F';

  const taxoOptions     = taxonomies.map(t => ({ value: String(t.id), label: t.parent ? `${t.parent.nom} ${t.nom}` : t.nom }));
  const solutionOptions = [{ value: '', label: '— Aucune —' }, ...solutions.map(s => ({ value: String(s.id), label: s.nom + (s.temperature ? ` (${s.temperature})` : '') }))];
  const stadeOptions    = [{ value: '', label: '—' }, ...STADE_OPTIONS_MOUSTIQUE];
  const sexeOptions     = [{ value: 'M', label: 'Mâle' }, { value: 'F', label: 'Femelle' }, { value: 'inconnu', label: 'Inconnu' }];
  const pariteOptions   = [{ value: '', label: '—' }, ...['Nulle', 'Paucie', 'Multi'].map(v => ({ value: v, label: v }))];
  const organeOptions   = [{ value: '', label: '—' }, ...['Tête', 'Thorax', 'Abdomen', 'Entier'].map(v => ({ value: v, label: v }))];

  // Données de localisation
  const loc      = m.methode?.localite;
  const geoLabel = [loc?.region, loc?.district, loc?.commune].filter(Boolean).join(' · ');
  const methodeIdentifiant = m.methode?.typeMethode
    ? `${m.methode.typeMethode.code}_${m.methode.numero ?? 1}`
    : null;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Moustiques', to: '/specimens/moustiques' },
        { label: m.idTerrain ?? `#${m.id}` },
      ]} />

      <PageHeader
        icon={() => <SpecimenIcon type="moustique" size={18} />}
        iconTone="specimen-moustique"
        title={<span className="italic">{taxoLabel(m.taxonomie)}</span>}
        subtitle="Moustique"
        actions={null}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] gap-5 items-start">

        {/* ══ Colonne principale ══ */}
        <div className="space-y-4">

          {/* Identification */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
              <Microscope size={15} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-fg">Identification</h2>
            </div>

            {editing ? (
              <div className="space-y-4">
                <EditSelect label="Genre / Espèce" value={editForm.taxonomieId}
                  onChange={e => setEditForm(f => ({ ...f, taxonomieId: e.target.value }))}
                  options={taxoOptions} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-fg-subtle font-medium block mb-1">Nombre</label>
                    <input type="number" min="1" value={editForm.nombre}
                      onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                    />
                  </div>
                  <EditSelect label="Stade" value={editForm.stade}
                    onChange={e => handleStadeChange(e.target.value)} options={stadeOptions} />
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
                  <Field label="Genre / Espèce">
                    <span className="italic font-semibold text-specimen-moustique">{taxoLabel(m.taxonomie)}</span>
                  </Field>
                </div>
                <Field label="Sexe">
                  <Badge tone={SEXE_TONE[m.sexe] ?? 'default'}>{SEXE_LABEL[m.sexe] ?? '—'}</Badge>
                </Field>
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

          {/* Conservation — visible en mode édition uniquement */}
          {editing && (
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <FlaskConical size={15} className="text-purple-500" />
                <h2 className="text-sm font-semibold text-fg">Conservation</h2>
              </div>
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
            </Card>
          )}

          {/* Notes */}
          {(m.notes || editing) && (
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <FileText size={15} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-fg">Notes et observations</h2>
              </div>
              {editing ? (
                <textarea rows={4} value={editForm.notes}
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

        {/* ══ Sidebar ══ */}
        <aside className="space-y-3 xl:sticky xl:top-4 self-start">

          {/* Actions */}
          <Card padding="sm">
            <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-2.5">Actions</p>
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
                  <Button variant="outline" className="w-full justify-center" icon={Pencil}
                    onClick={startEdit}>Modifier</Button>
                  {isAdmin && (
                    <Button variant="danger" className="w-full justify-center" icon={Trash2}
                      loading={deleting} onClick={handleDelete}>Supprimer</Button>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* ID terrain */}
          {m.idTerrain && (
            <Card padding="sm" tone="primary">
              <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-1">ID terrain</p>
              <p className="font-mono font-bold text-primary text-sm">{m.idTerrain}</p>
            </Card>
          )}

          {/* Localisation */}
          <Card padding="sm">
            <SidebarSection icon={MapPin} iconClass="text-danger" label="Localisation">
              {/* Fil d'Ariane */}
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-fg-muted mb-2">
                <span className="font-semibold text-fg">
                  {loc?.mission?.projet?.nom || loc?.mission?.projet?.code || '—'}
                </span>
                <span className="text-fg-subtle">›</span>
                <span>{loc?.mission?.ordreMission || '—'}</span>
                <span className="text-fg-subtle">›</span>
                <span className="font-semibold text-fg">{loc?.fokontany || loc?.nom || '—'}</span>
              </div>
              {/* Région · District · Commune */}
              {geoLabel && (
                <p className="text-[11px] text-fg-subtle mb-3">{geoLabel}</p>
              )}
            </SidebarSection>

            <div className="border-t border-border my-2.5" />

            {/* Méthode de collecte */}
            <SidebarSection icon={Beaker} iconClass="text-info" label="Méthode de collecte">
              {m.methode?.typeMethode ? (
                <div className="text-[11px] text-fg font-medium">
                  <span>{m.methode.typeMethode.nom}</span>
                  {methodeIdentifiant && (
                    <>
                      <span className="text-fg-subtle mx-1.5">|</span>
                      <span className="font-mono text-primary">{methodeIdentifiant}</span>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-fg-subtle">—</span>
              )}
            </SidebarSection>
          </Card>

          {/* Conservation */}
          <Card padding="sm">
            <SidebarSection icon={FlaskConical} iconClass="text-purple-500" label="Conservation">
              <SidebarRow label="Solution">
                {m.solution?.nom || <span className="text-fg-subtle">—</span>}
              </SidebarRow>
              <SidebarRow label="Container">
                {m.container ? (
                  <span>
                    <span className="font-mono">{m.container.code}</span>
                    {m.position && (
                      <>
                        <span className="text-fg-subtle mx-1">|</span>
                        <span>Position : {m.position}</span>
                      </>
                    )}
                  </span>
                ) : <span className="text-fg-subtle">—</span>}
              </SidebarRow>
              <SidebarRow label="Date">
                {m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-fg-subtle">—</span>}
              </SidebarRow>
            </SidebarSection>
          </Card>


        </aside>
      </div>
    </div>
  );
}
