import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  PawPrint, Stethoscope, FileText, Bug,
  Pencil, Trash2, Save, X, MapPin, Beaker,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, PageHeader, Spinner, Select, Breadcrumb } from '../../components/ui';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { taxoLabel as _taxoLabel } from '../../utils/taxoLabel';

const ROLES = { admin: 5, superviseur: 4, chercheur: 3, technicien: 2, lecteur: 1 };
const isMin = (r, m) => (ROLES[r] || 0) >= (ROLES[m] || 0);

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };
const taxoLabel   = (t) => t ? _taxoLabel(t) : '—';

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

export default function HoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canEdit   = isMin(user?.role, 'technicien');
  const canDelete = isMin(user?.role, 'chercheur');

  const [hote,       setHote]       = useState(null);
  const [taxonomies, setTaxonomies] = useState([]);
  const [loadError,  setLoadError]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [editForm,   setEditForm]   = useState({});

  useEffect(() => {
    Promise.all([
      api.get(`/hotes/${id}`),
      api.get('/dictionnaire/taxonomie-hotes', { params: { niveau: 'espece', actif: 'true' } }),
    ])
      .then(([hRes, tRes]) => {
        setHote(hRes.data.hote);
        setTaxonomies(tRes.data.items || []);
      })
      .catch(() => setLoadError('Impossible de charger cet hôte.'))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    const h = hote;
    setEditForm({
      taxonomieHoteId: String(h.taxonomieHoteId),
      especeLocale:    h.especeLocale || '',
      age:             h.age          || '',
      sexe:            h.sexe,
      etatSante:       h.etatSante    || '',
      vaccination:     h.vaccination  || '',
      notes:           h.notes        || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/hotes/${id}`, {
        ...editForm,
        taxonomieHoteId: parseInt(editForm.taxonomieHoteId),
        especeLocale:    editForm.especeLocale || null,
        age:             editForm.age          || null,
        etatSante:       editForm.etatSante    || null,
        vaccination:     editForm.vaccination  || null,
        notes:           editForm.notes        || null,
      });
      setHote(r.data.hote);
      setEditing(false);
      toast.success('Hôte mis à jour avec succès.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Supprimer cet hôte ?',
      message: `${hote.idTerrain ? `« ${hote.idTerrain} »` : `L'hôte #${id}`} sera définitivement supprimé. Cette action est irréversible.`,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/hotes/${id}`);
      toast.success('Hôte supprimé.');
      navigate('/hotes');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  if (loading) return <Spinner.Block label="Chargement…" height="h-40" />;

  if (loadError || !hote) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-fg-muted">{loadError || 'Hôte introuvable.'}</p>
      <Link to="/hotes" className="text-primary text-sm hover:underline">← Retour aux hôtes</Link>
    </div>
  );

  const h = hote;

  const taxoOptions = taxonomies.map(t => ({
    value: String(t.id),
    label: t.parent ? `${t.parent.nom} ${t.nom}` : t.nom,
  }));
  const sexeOptions = [{ value: 'M', label: 'Mâle' }, { value: 'F', label: 'Femelle' }, { value: 'inconnu', label: 'Inconnu' }];
  const etatOptions = [{ value: '', label: '—' }, ...['Bon', 'Moyen', 'Mauvais', 'Mort'].map(v => ({ value: v, label: v }))];

  // Données de localisation
  const loc      = h.methode?.localite;
  const geoLabel = [loc?.region, loc?.district, loc?.commune].filter(Boolean).join(' · ');
  const methodeIdentifiant = h.methode?.typeMethode
    ? `${h.methode.typeMethode.code}_${h.methode.numero ?? 1}`
    : null;
  const totalSpecimens = (h._count?.tiques || 0) + (h._count?.puces || 0);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Hôtes', to: '/hotes' },
        { label: h.idTerrain ?? `#${h.id}` },
      ]} />

      <PageHeader
        icon={() => <PawPrint size={18} className="text-warning" />}
        iconTone="warning"
        title={<span className="italic">{taxoLabel(h.taxonomieHote)}</span>}
        subtitle="Hôte"
        actions={null}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] gap-5 items-start">

        {/* ══ Colonne principale ══ */}
        <div className="space-y-4">

          {/* Identification */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
              <PawPrint size={15} className="text-warning" />
              <h2 className="text-sm font-semibold text-fg">Identification</h2>
            </div>

            {editing ? (
              <div className="space-y-4">
                <EditSelect label="Espèce hôte (référentiel)" value={editForm.taxonomieHoteId}
                  onChange={e => setEditForm(f => ({ ...f, taxonomieHoteId: e.target.value }))}
                  options={taxoOptions} />
                <div>
                  <label className="text-xs text-fg-subtle font-medium block mb-1">Espèce locale (nom vernaculaire)</label>
                  <input type="text" value={editForm.especeLocale}
                    onChange={e => setEditForm(f => ({ ...f, especeLocale: e.target.value }))}
                    placeholder="ex: Voalavo, Andriaka…"
                    className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <EditSelect label="Sexe" value={editForm.sexe}
                    onChange={e => setEditForm(f => ({ ...f, sexe: e.target.value }))}
                    options={sexeOptions} />
                  <div>
                    <label className="text-xs text-fg-subtle font-medium block mb-1">Âge</label>
                    <input type="text" value={editForm.age}
                      onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))}
                      placeholder="ex: Adulte, Juvénile"
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                    />
                  </div>
                  <EditSelect label="État de santé" value={editForm.etatSante}
                    onChange={e => setEditForm(f => ({ ...f, etatSante: e.target.value }))}
                    options={etatOptions} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <Field label="Espèce hôte">
                    <span className="italic font-semibold text-fg">{taxoLabel(h.taxonomieHote)}</span>
                    {h.taxonomieHote?.nomCommun && (
                      <span className="not-italic text-fg-subtle text-xs ml-1.5">({h.taxonomieHote.nomCommun})</span>
                    )}
                  </Field>
                </div>
                {h.especeLocale && <Field label="Espèce locale">{h.especeLocale}</Field>}
                <Field label="Sexe">
                  <Badge tone={SEXE_TONE[h.sexe] ?? 'default'}>{SEXE_LABEL[h.sexe] ?? '—'}</Badge>
                </Field>
                {h.age       && <Field label="Âge">{h.age}</Field>}
                {h.etatSante && <Field label="État de santé">{h.etatSante}</Field>}
              </div>
            )}
          </Card>

          {/* Vaccination */}
          {(h.vaccination || editing) && (
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <Stethoscope size={15} className="text-success" />
                <h2 className="text-sm font-semibold text-fg">Vaccination</h2>
              </div>
              {editing ? (
                <textarea rows={3} value={editForm.vaccination}
                  onChange={e => setEditForm(f => ({ ...f, vaccination: e.target.value }))}
                  placeholder="Vaccins reçus, date du dernier rappel, etc."
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg resize-none"
                />
              ) : (
                <p className="text-sm text-fg-muted whitespace-pre-line">{h.vaccination}</p>
              )}
            </Card>
          )}

          {/* Notes */}
          {(h.notes || editing) && (
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <FileText size={15} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-fg">Notes et observations</h2>
              </div>
              {editing ? (
                <textarea rows={4} value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Conditions de capture, comportement, observations particulières…"
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg resize-none"
                />
              ) : (
                <p className="text-sm text-fg-muted whitespace-pre-line">{h.notes}</p>
              )}
            </Card>
          )}

        </div>

        {/* ══ Sidebar ══ */}
        <aside className="space-y-3 xl:sticky xl:top-4 self-start">

          {/* Actions */}
          {canEdit && (
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
                    {canDelete && (
                      <Button variant="danger" className="w-full justify-center" icon={Trash2}
                        loading={deleting} onClick={handleDelete}>Supprimer</Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* ID terrain */}
          {h.idTerrain && (
            <Card padding="sm" tone="primary">
              <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-1">Identifiant hôte</p>
              <p className="font-mono font-bold text-primary text-sm">{h.idTerrain}</p>
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
              {geoLabel && (
                <p className="text-[11px] text-fg-subtle mb-3">{geoLabel}</p>
              )}
            </SidebarSection>

            <div className="border-t border-border my-2.5" />

            <SidebarSection icon={Beaker} iconClass="text-info" label="Méthode de collecte">
              {h.methode?.typeMethode ? (
                <div className="text-[11px] text-fg font-medium">
                  <span>{h.methode.typeMethode.nom}</span>
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

          {/* Spécimens liés */}
          <Card padding="sm">
            <SidebarSection icon={Bug} iconClass="text-primary" label="Spécimens collectés">
              <SidebarRow label="Tiques">{h._count?.tiques || 0}</SidebarRow>
              <SidebarRow label="Puces">{h._count?.puces || 0}</SidebarRow>
              <SidebarRow label="Total">
                <Badge tone={totalSpecimens > 0 ? 'success' : 'default'}>{totalSpecimens}</Badge>
              </SidebarRow>
            </SidebarSection>
          </Card>

        </aside>
      </div>
    </div>
  );
}
