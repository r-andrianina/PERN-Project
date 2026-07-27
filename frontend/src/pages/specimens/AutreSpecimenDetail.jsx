import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Bug, FlaskConical, FileText, Pencil, Trash2, Save, X, MapPin, Beaker, Plus, Minus, Microscope } from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, PageHeader, Spinner, Breadcrumb, DatePicker } from '../../components/ui';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const SEXE_LABEL = { M: 'Mâle', F: 'Femelle', inconnu: 'Inconnu' };

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-0.5">{label}</p>
      <div className="text-sm text-fg">{children || <span className="text-fg-subtle">—</span>}</div>
    </div>
  );
}

function SidebarRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-[11px] text-fg-subtle shrink-0">{label}</span>
      <span className="text-[11px] text-fg font-medium text-right leading-relaxed">{children || '—'}</span>
    </div>
  );
}

export default function AutreSpecimenDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canEdit  = ['admin', 'superviseur', 'chercheur', 'technicien'].includes(user?.role);
  const isAdmin  = user?.role === 'admin';

  const [specimen,  setSpecimen]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editForm,  setEditForm]  = useState({});
  const [editAttrs, setEditAttrs] = useState([]);

  useEffect(() => {
    api.get(`/autres-specimens/${id}`)
      .then((r) => {
        setSpecimen(r.data.specimen);
        initEdit(r.data.specimen);
      })
      .catch(() => toast.error('Spécimen introuvable'))
      .finally(() => setLoading(false));
  }, [id]);

  const initEdit = (s) => {
    setEditForm({
      notes:       s.notes       || '',
      nombre:      s.nombre      || 1,
      sexe:        s.sexe        || 'inconnu',
      stade:       s.stade       || '',
      dateCollecte: s.dateCollecte ? s.dateCollecte.split('T')[0] : '',
    });
    const attrs = s.attributs ? Object.entries(s.attributs).map(([cle, valeur]) => ({ cle, valeur: String(valeur) })) : [];
    setEditAttrs(attrs.length ? attrs : [{ cle: '', valeur: '' }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const attrsObj = {};
      editAttrs.forEach(({ cle, valeur }) => { if (cle.trim()) attrsObj[cle.trim()] = valeur; });
      const payload = {
        ...editForm,
        dateCollecte: editForm.dateCollecte || null,
        attributs:    Object.keys(attrsObj).length ? attrsObj : null,
      };
      const r = await api.put(`/autres-specimens/${id}`, payload);
      setSpecimen(r.data.specimen);
      initEdit(r.data.specimen);
      setEditing(false);
      toast.success('Spécimen mis à jour');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title:   'Supprimer ce spécimen ?',
      message: 'Cette action est irréversible.',
      danger:  true,
    });
    if (!ok) return;
    try {
      await api.delete(`/autres-specimens/${id}`);
      toast.success('Spécimen supprimé');
      navigate('/specimens/autres');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur suppression');
    }
  };

  const setAttrField = (i, field, val) =>
    setEditAttrs((p) => p.map((a, idx) => idx === i ? { ...a, [field]: val } : a));

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner /></div>;
  if (!specimen) return <div className="text-center text-fg-subtle py-16">Spécimen introuvable</div>;

  const s = specimen;
  const mission  = s.methode?.localite?.mission;
  const localite = s.methode?.localite;

  return (
    <div className="max-w-screen-2xl space-y-5">
      <Breadcrumb items={[
        { label: 'Autres spécimens', href: '/specimens/autres' },
        { label: s.idTerrain || `#${s.id}` },
      ]} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          icon={Bug} iconTone="primary"
          title={s.idTerrain || `Spécimen #${s.id}`}
          subtitle={s.typeSpecimen?.nom ?? 'Autre spécimen'}
        />
        <div className="flex gap-2 flex-wrap">
          {canEdit && !editing && (
            <Button icon={Pencil} variant="secondary" onClick={() => setEditing(true)}>Modifier</Button>
          )}
          {editing && (
            <>
              <Button icon={Save} onClick={handleSave} disabled={saving}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</Button>
              <Button icon={X} variant="ghost" onClick={() => { setEditing(false); initEdit(s); }}>Annuler</Button>
            </>
          )}
          {isAdmin && !editing && (
            <Button icon={Trash2} variant="danger" onClick={handleDelete}>Supprimer</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] 2xl:grid-cols-[1fr,380px] gap-5 2xl:gap-8">
        {/* Contenu principal */}
        <div className="space-y-5">
          {/* Identification */}
          <Card>
            <div className="p-5 border-b border-border">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Bug size={15} className="text-primary" /> Identification
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Type de spécimen">{s.typeSpecimen?.nom}</Field>
              <Field label="Taxonomie">
                {s.taxonomie
                  ? <span className="italic">{s.taxonomie.parent ? `${s.taxonomie.parent.nom} ${s.taxonomie.nom}` : s.taxonomie.nom}</span>
                  : null}
              </Field>
              <Field label="ID terrain">
                {s.idTerrain ? <Badge tone="primary" className="font-mono">{s.idTerrain}</Badge> : null}
              </Field>
            </div>
          </Card>

          {/* Morphologie */}
          <Card>
            <div className="p-5 border-b border-border">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Microscope size={15} className="text-blue-500" /> Morphologie
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {editing ? (
                <>
                  <div><label className="text-xs text-fg-subtle block mb-1">Nombre</label>
                    <input type="number" min={1} value={editForm.nombre}
                      onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                      className="input-base w-full text-sm" /></div>
                  <div><label className="text-xs text-fg-subtle block mb-1">Stade</label>
                    <select value={editForm.stade} onChange={(e) => setEditForm((f) => ({ ...f, stade: e.target.value }))}
                      className="input-base w-full text-sm">
                      <option value="">—</option>
                      <option value="Ad">Adulte</option>
                      <option value="L">Larve</option>
                      <option value="N">Nymphe</option>
                      <option value="E">Œuf</option>
                    </select></div>
                  <div><label className="text-xs text-fg-subtle block mb-1">Sexe</label>
                    <select value={editForm.sexe} onChange={(e) => setEditForm((f) => ({ ...f, sexe: e.target.value }))}
                      className="input-base w-full text-sm">
                      <option value="inconnu">Inconnu</option>
                      <option value="M">Mâle</option>
                      <option value="F">Femelle</option>
                    </select></div>
                  <div><label className="text-xs text-fg-subtle block mb-1">Date collecte</label>
                    <DatePicker value={editForm.dateCollecte}
                      onChange={(val) => setEditForm((f) => ({ ...f, dateCollecte: val }))} /></div>
                </>
              ) : (
                <>
                  <Field label="Nombre"><Badge tone="default">{s.nombre}</Badge></Field>
                  <Field label="Stade">{s.stade || null}</Field>
                  <Field label="Sexe"><Badge tone={SEXE_TONE[s.sexe]}>{SEXE_LABEL[s.sexe]}</Badge></Field>
                  <Field label="Date collecte">
                    {s.dateCollecte ? new Date(s.dateCollecte).toLocaleDateString('fr-FR') : null}
                  </Field>
                </>
              )}
            </div>
          </Card>

          {/* Attributs dynamiques */}
          <Card>
            <div className="p-5 border-b border-border">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <FileText size={15} className="text-warning" /> Attributs spécifiques
              </h3>
            </div>
            <div className="p-5">
              {editing ? (
                <div className="space-y-2">
                  {editAttrs.map((attr, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" placeholder="Clé" value={attr.cle}
                        onChange={(e) => setAttrField(i, 'cle', e.target.value)}
                        className="input-base flex-1 text-sm" />
                      <input type="text" placeholder="Valeur" value={attr.valeur}
                        onChange={(e) => setAttrField(i, 'valeur', e.target.value)}
                        className="input-base flex-1 text-sm" />
                      <button type="button" onClick={() => setEditAttrs((p) => p.filter((_, idx) => idx !== i))}
                        className="p-2 text-fg-subtle hover:text-danger rounded-lg">
                        <Minus size={14} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditAttrs((p) => [...p, { cle: '', valeur: '' }])}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
                    <Plus size={13} /> Ajouter un attribut
                  </button>
                </div>
              ) : s.attributs && Object.keys(s.attributs).length > 0 ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {Object.entries(s.attributs).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] text-fg-subtle uppercase tracking-wider">{k}</dt>
                      <dd className="text-sm text-fg font-medium">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-fg-subtle">Aucun attribut spécifique enregistré.</p>
              )}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <div className="p-5 border-b border-border">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <FileText size={15} className="text-fg-subtle" /> Observations
              </h3>
            </div>
            <div className="p-5">
              {editing ? (
                <textarea rows={3} value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input-base w-full text-sm resize-none" />
              ) : (
                <p className="text-sm text-fg whitespace-pre-wrap">{s.notes || <span className="text-fg-subtle">—</span>}</p>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <div className="p-4 border-b border-border">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-fg-subtle uppercase tracking-wider">
                <MapPin size={12} /> Localisation
              </h3>
            </div>
            <div className="p-4 space-y-0">
              <SidebarRow label="Mission">{mission?.ordreMission}</SidebarRow>
              <SidebarRow label="Projet">{mission?.projet?.nom}</SidebarRow>
              <SidebarRow label="Localité">{localite?.nom}</SidebarRow>
              <SidebarRow label="Fokontany">{localite?.fokontany}</SidebarRow>
              <SidebarRow label="Méthode">{s.methode?.typeMethode?.nom}</SidebarRow>
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b border-border">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-fg-subtle uppercase tracking-wider">
                <FlaskConical size={12} /> Conservation
              </h3>
            </div>
            <div className="p-4 space-y-0">
              <SidebarRow label="Solution">{s.solution?.nom}</SidebarRow>
              <SidebarRow label="Container">{s.container?.code}</SidebarRow>
              <SidebarRow label="Position">{s.position}</SidebarRow>
            </div>
          </Card>

          <Card padding="sm">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate(`/labo/nouvelle?specimenType=autre&specimenId=${s.id}`)}
            >
              <Beaker size={14} /> Créer une manipulation labo
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

