import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Microscope, FlaskConical, FileText,
  Pencil, Trash2, Save, X, MapPin, Beaker, Bird,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, PageHeader, Spinner, Select, Breadcrumb, DatePicker } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { STADE_OPTIONS_PUCE, formatStade } from '../../utils/stade';
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

function EditSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs text-fg-subtle font-medium block mb-1">{label}</label>
      <Select
        value={value}
        onChange={(val) => onChange({ target: { value: val } })}
        options={options}
      />
    </div>
  );
}

export default function PuceDetail() {
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
      api.get(`/puces/${id}`),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'puce', niveau: 'espece', actif: 'true' } }),
    ])
      .then(([pRes, sRes, txRes]) => {
        setSpecimen(pRes.data.puce);
        setSolutions(sRes.data.items || []);
        setTaxonomies(txRes.data.items || []);
      })
      .catch(() => setLoadError('Impossible de charger ce spécimen.'))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    const p = specimen;
    setEditForm({
      taxonomieId:  String(p.taxonomieId),
      nombre:       String(p.nombre),
      sexe:         p.sexe,
      stade:        p.stade || '',
      solutionId:   p.solutionId ? String(p.solutionId) : '',
      dateCollecte: p.dateCollecte ? p.dateCollecte.split('T')[0] : '',
      notes:        p.notes || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/puces/${id}`, {
        ...editForm,
        taxonomieId:  parseInt(editForm.taxonomieId),
        nombre:       parseInt(editForm.nombre),
        solutionId:   editForm.solutionId ? parseInt(editForm.solutionId) : null,
        stade:        editForm.stade || null,
        dateCollecte: editForm.dateCollecte || null,
      });
      setSpecimen(r.data.puce);
      setEditing(false);
      toast.success('Puce mise à jour avec succès.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Supprimer cette puce ?',
      message: `${specimen.idTerrain ? `« ${specimen.idTerrain} »` : `La puce #${id}`} sera définitivement supprimée. Cette action est irréversible.`,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/puces/${id}`);
      toast.success('Puce supprimée.');
      navigate('/specimens/puces');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  if (loading) return <Spinner.Block label="Chargement…" height="h-40" />;

  if (loadError || !specimen) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-fg-muted">{loadError || 'Spécimen introuvable.'}</p>
      <Link to="/specimens/puces" className="text-primary text-sm hover:underline">← Retour aux puces</Link>
    </div>
  );

  const p = specimen;

  const taxoOptions     = taxonomies.map(tx => ({ value: String(tx.id), label: tx.parent ? `${tx.parent.nom} ${tx.nom}` : tx.nom }));
  const solutionOptions = [{ value: '', label: '— Aucune —' }, ...solutions.map(s => ({ value: String(s.id), label: s.nom + (s.temperature ? ` (${s.temperature})` : '') }))];
  const stadeOptions    = [{ value: '', label: '—' }, ...STADE_OPTIONS_PUCE];
  const sexeOptions     = [{ value: 'M', label: 'Mâle' }, { value: 'F', label: 'Femelle' }, { value: 'inconnu', label: 'Inconnu' }];

  const loc                = p.methode?.localite;
  const geoLabel           = [loc?.region, loc?.district, loc?.commune].filter(Boolean).join(' · ');
  const methodeIdentifiant = p.methode?.typeMethode
    ? `${p.methode.typeMethode.code}_${p.methode.numero ?? 1}`
    : null;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Puces', to: '/specimens/puces' },
        { label: p.idTerrain ?? `#${p.id}` },
      ]} />

      <PageHeader
        icon={() => <SpecimenIcon type="puce" size={18} />}
        iconTone="specimen-puce"
        title={<span className="italic">{taxoLabel(p.taxonomie)}</span>}
        subtitle="Puce"
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
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <Field label="Genre / Espèce">
                    <span className="italic font-semibold text-specimen-puce">{taxoLabel(p.taxonomie)}</span>
                  </Field>
                </div>
                <Field label="Sexe"><Badge tone={SEXE_TONE[p.sexe] ?? 'default'}>{SEXE_LABEL[p.sexe] ?? '—'}</Badge></Field>
                <Field label="Nombre">{p.nombre}</Field>
                {p.stade && <Field label="Stade">{formatStade(p.stade)}</Field>}
              </div>
            )}
          </Card>

          {/* Hôte associé */}
          {p.hote && (
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <Bird size={15} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-fg">Hôte associé</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Espèce hôte">{p.hote.taxonomieHote?.nom || '—'}</Field>
                {p.hote.nom && <Field label="Identifiant hôte">{p.hote.nom}</Field>}
              </div>
            </Card>
          )}

          {/* Conservation — mode édition uniquement */}
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
                  <DatePicker value={editForm.dateCollecte}
                    onChange={val => setEditForm(f => ({ ...f, dateCollecte: val }))}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Notes */}
          {(p.notes || editing) && (
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
                <p className="text-sm text-fg-muted whitespace-pre-line">{p.notes}</p>
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
          {p.idTerrain && (
            <Card padding="sm" tone="primary">
              <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-1">ID terrain</p>
              <p className="font-mono font-bold text-primary text-sm">{p.idTerrain}</p>
            </Card>
          )}

          {/* Localisation */}
          <Card padding="sm">
            <SidebarSection icon={MapPin} iconClass="text-danger" label="Localisation">
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-fg-muted mb-2">
                <span className="font-semibold text-fg">
                  {loc?.mission?.projet?.nom || loc?.mission?.projet?.code || '—'}
                </span>
                <span className="text-fg-subtle">›</span>
                <span>{loc?.mission?.ordreMission || '—'}</span>
                <span className="text-fg-subtle">›</span>
                <span className="font-semibold text-fg">{loc?.fokontany || loc?.nom || '—'}</span>
              </div>
              {geoLabel && <p className="text-[11px] text-fg-subtle mb-3">{geoLabel}</p>}
            </SidebarSection>

            <div className="border-t border-border my-2.5" />

            <SidebarSection icon={Beaker} iconClass="text-info" label="Méthode de collecte">
              {p.methode?.typeMethode ? (
                <div className="text-[11px] text-fg font-medium">
                  <span>{p.methode.typeMethode.nom}</span>
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
                {p.solution?.nom || <span className="text-fg-subtle">—</span>}
              </SidebarRow>
              <SidebarRow label="Container">
                {p.container ? (
                  <span>
                    <span className="font-mono">{p.container.code}</span>
                    {p.position && (
                      <>
                        <span className="text-fg-subtle mx-1">|</span>
                        <span>Position : {p.position}</span>
                      </>
                    )}
                  </span>
                ) : <span className="text-fg-subtle">—</span>}
              </SidebarRow>
              <SidebarRow label="Date">
                {p.dateCollecte ? new Date(p.dateCollecte).toLocaleDateString('fr-FR') : <span className="text-fg-subtle">—</span>}
              </SidebarRow>
            </SidebarSection>
          </Card>


        </aside>
      </div>
    </div>
  );
}
