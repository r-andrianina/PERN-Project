import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bug, FlaskConical, FileText, Pencil, Trash2, Save, X, MapPin, Beaker, Plus, Minus, Microscope } from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, PageHeader, Spinner, Breadcrumb, DatePicker } from '../../components/ui';
import useAuthStore from '../../store/authStore';
import { taxoLabel } from '../../utils/taxoLabel';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { useT, interpolate } from '../../lib/i18n';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };

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
  const t = useT();
  const SEXE_LABEL = { M: t('sexe.M'), F: t('sexe.F'), inconnu: t('sexe.inconnu') };
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

  useEffect(() => {
    api.get(`/autres-specimens/${id}`)
      .then((r) => {
        setSpecimen(r.data.specimen);
        initEdit(r.data.specimen);
      })
      .catch(() => toast.error(t('autreSpecimenDetail.loadError')))
      .finally(() => setLoading(false));
  }, [id, t]);

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
      toast.success(t('autreSpecimenDetail.updateSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('autreSpecimenDetail.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title:   t('autreSpecimenDetail.deleteTitle'),
      message: t('autreSpecimenDetail.deleteMessage'),
      danger:  true,
    });
    if (!ok) return;
    try {
      await api.delete(`/autres-specimens/${id}`);
      toast.success(t('autreSpecimenDetail.deleteSuccess'));
      navigate('/specimens/autres');
    } catch (err) {
      toast.error(err.response?.data?.error || t('autreSpecimenDetail.deleteError'));
    }
  };

  const setAttrField = (i, field, val) =>
    setEditAttrs((p) => p.map((a, idx) => idx === i ? { ...a, [field]: val } : a));

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner /></div>;
  if (!specimen) return <div className="text-center text-fg-subtle py-16">{t('autreSpecimenDetail.notFound')}</div>;

  const s = specimen;
  const mission  = s.methode?.localite?.mission;
  const localite = s.methode?.localite;

  return (
    <div className="max-w-screen-2xl space-y-5">
      <Breadcrumb items={[
        { label: t('autreSpecimenDetail.breadcrumbLabel'), href: '/specimens/autres' },
        { label: s.idTerrain || `#${s.id}` },
      ]} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          icon={Bug} iconTone="primary"
          title={s.idTerrain || interpolate(t('autreSpecimenDetail.specimenN'), { id: s.id })}
          subtitle={s.typeSpecimen?.nom ?? t('autreSpecimenDetail.otherSpecimen')}
        />
        <div className="flex gap-2 flex-wrap">
          {canEdit && !editing && (
            <Button icon={Pencil} variant="secondary" onClick={() => setEditing(true)}>{t('autreSpecimenDetail.edit')}</Button>
          )}
          {editing && (
            <>
              <Button icon={Save} onClick={handleSave} disabled={saving}>{saving ? t('autreSpecimenDetail.saving') : t('autreSpecimenDetail.save')}</Button>
              <Button icon={X} variant="ghost" onClick={() => { setEditing(false); initEdit(s); }}>{t('autreSpecimenDetail.cancel')}</Button>
            </>
          )}
          {isAdmin && !editing && (
            <Button icon={Trash2} variant="danger" onClick={handleDelete}>{t('autreSpecimenDetail.delete')}</Button>
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
                <Bug size={15} className="text-primary" /> {t('autreSpecimenDetail.identification')}
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label={t('autreSpecimenDetail.typeSpecimen')}>{s.typeSpecimen?.nom}</Field>
              <Field label={t('autreSpecimenDetail.taxonomie')}>
                {s.taxonomie
                  ? <span className="italic">{taxoLabel(s.taxonomie)}</span>
                  : null}
              </Field>
              <Field label={t('autreSpecimenDetail.idTerrain')}>
                {s.idTerrain ? <Badge tone="primary" className="font-mono">{s.idTerrain}</Badge> : null}
              </Field>
            </div>
          </Card>

          {/* Morphologie */}
          <Card>
            <div className="p-5 border-b border-border">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Microscope size={15} className="text-blue-500" /> {t('autreSpecimenDetail.morphologie')}
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {editing ? (
                <>
                  <div><label className="text-xs text-fg-subtle block mb-1">{t('autreSpecimenDetail.nombre')}</label>
                    <input type="number" min={1} value={editForm.nombre}
                      onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                      className="input-base w-full text-sm" /></div>
                  <div><label className="text-xs text-fg-subtle block mb-1">{t('autreSpecimenDetail.stade')}</label>
                    <select value={editForm.stade} onChange={(e) => setEditForm((f) => ({ ...f, stade: e.target.value }))}
                      className="input-base w-full text-sm">
                      <option value="">—</option>
                      <option value="Ad">{t('autreSpecimenDetail.stadeAdulte')}</option>
                      <option value="L">{t('autreSpecimenDetail.stadeLarve')}</option>
                      <option value="N">{t('autreSpecimenDetail.stadeNymphe')}</option>
                      <option value="E">{t('autreSpecimenDetail.stadeOeuf')}</option>
                    </select></div>
                  <div><label className="text-xs text-fg-subtle block mb-1">{t('autreSpecimenDetail.sexe')}</label>
                    <select value={editForm.sexe} onChange={(e) => setEditForm((f) => ({ ...f, sexe: e.target.value }))}
                      className="input-base w-full text-sm">
                      <option value="inconnu">{t('sexe.inconnu')}</option>
                      <option value="M">{t('sexe.M')}</option>
                      <option value="F">{t('sexe.F')}</option>
                    </select></div>
                  <div><label className="text-xs text-fg-subtle block mb-1">{t('autreSpecimenDetail.dateCollecte')}</label>
                    <DatePicker value={editForm.dateCollecte}
                      onChange={(val) => setEditForm((f) => ({ ...f, dateCollecte: val }))} /></div>
                </>
              ) : (
                <>
                  <Field label={t('autreSpecimenDetail.nombre')}><Badge tone="default">{s.nombre}</Badge></Field>
                  <Field label={t('autreSpecimenDetail.stade')}>{s.stade || null}</Field>
                  <Field label={t('autreSpecimenDetail.sexe')}><Badge tone={SEXE_TONE[s.sexe]}>{SEXE_LABEL[s.sexe]}</Badge></Field>
                  <Field label={t('autreSpecimenDetail.dateCollecte')}>
                    {s.dateCollecte ? new Date(s.dateCollecte).toLocaleDateString(t('common.locale')) : null}
                  </Field>
                </>
              )}
            </div>
          </Card>

          {/* Attributs dynamiques */}
          <Card>
            <div className="p-5 border-b border-border">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <FileText size={15} className="text-warning" /> {t('autreSpecimenDetail.specificAttrs')}
              </h3>
            </div>
            <div className="p-5">
              {editing ? (
                <div className="space-y-2">
                  {editAttrs.map((attr, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" placeholder={t('autreSpecimenDetail.key')} value={attr.cle}
                        onChange={(e) => setAttrField(i, 'cle', e.target.value)}
                        className="input-base flex-1 text-sm" />
                      <input type="text" placeholder={t('autreSpecimenDetail.value')} value={attr.valeur}
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
                    <Plus size={13} /> {t('autreSpecimenDetail.addAttribute')}
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
                <p className="text-sm text-fg-subtle">{t('autreSpecimenDetail.noAttribute')}</p>
              )}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <div className="p-5 border-b border-border">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <FileText size={15} className="text-fg-subtle" /> {t('autreSpecimenDetail.observations')}
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
                <MapPin size={12} /> {t('autreSpecimenDetail.localisation')}
              </h3>
            </div>
            <div className="p-4 space-y-0">
              <SidebarRow label={t('autreSpecimenDetail.mission')}>{mission?.ordreMission}</SidebarRow>
              <SidebarRow label={t('autreSpecimenDetail.projet')}>{mission?.projet?.nom}</SidebarRow>
              <SidebarRow label={t('autreSpecimenDetail.localite')}>{localite?.nom}</SidebarRow>
              <SidebarRow label={t('autreSpecimenDetail.fokontany')}>{localite?.fokontany}</SidebarRow>
              <SidebarRow label={t('autreSpecimenDetail.methode')}>{s.methode?.typeMethode?.nom}</SidebarRow>
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b border-border">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-fg-subtle uppercase tracking-wider">
                <FlaskConical size={12} /> {t('autreSpecimenDetail.conservation')}
              </h3>
            </div>
            <div className="p-4 space-y-0">
              <SidebarRow label={t('autreSpecimenDetail.solution')}>{s.solution?.nom}</SidebarRow>
              <SidebarRow label={t('autreSpecimenDetail.container')}>{s.container?.code}</SidebarRow>
              <SidebarRow label={t('autreSpecimenDetail.position')}>{s.position}</SidebarRow>
            </div>
          </Card>

          <Card padding="sm">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate(`/labo/nouvelle?specimenType=autre&specimenId=${s.id}`)}
            >
              <Beaker size={14} /> {t('autreSpecimenDetail.createLaboManip')}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

