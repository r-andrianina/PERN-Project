import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Microscope, FlaskConical, FileText,
  Pencil, Trash2, Save, X, MapPin, Beaker, Bird,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, PageHeader, Spinner, Breadcrumb, DatePicker } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { STADE_OPTIONS_TIQUE, formatStade } from '../../utils/stade';
import { GORGEMENT_OPTIONS, formatGorgement } from '../../utils/gorgement';
import { taxoLabel as _taxoLabel } from '../../utils/taxoLabel';
import { useT, interpolate } from '../../lib/i18n';
import { Field, SidebarRow, SidebarSection, EditSelect } from '../../components/SpecimenDetailParts';
import AnalysesLabo from '../../components/AnalysesLabo';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const taxoLabel  = (tx) => tx ? _taxoLabel(tx) : '—';

export default function TiqueDetail() {
  const t = useT();
  const SEXE_LABEL = { M: t('sexe.M'), F: t('sexe.F'), inconnu: t('sexe.inconnu') };
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
      api.get(`/tiques/${id}`),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'tique', niveau: 'espece', actif: 'true' } }),
    ])
      .then(([tRes, sRes, txRes]) => {
        setSpecimen(tRes.data.tique);
        setSolutions(sRes.data.items || []);
        setTaxonomies(txRes.data.items || []);
      })
      .catch(() => setLoadError(t('specimenDetail.loadError')))
      .finally(() => setLoading(false));
  }, [id, t]);

  const startEdit = () => {
    const tq = specimen;
    setEditForm({
      taxonomieId:     String(tq.taxonomieId),
      nombre:          String(tq.nombre),
      sexe:            tq.sexe,
      stade:           tq.stade || '',
      gorge:           tq.gorge,
      partieCorpsHote: tq.partieCorpsHote || '',
      solutionId:      tq.solutionId ? String(tq.solutionId) : '',
      dateCollecte:    tq.dateCollecte ? tq.dateCollecte.split('T')[0] : '',
      notes:           tq.notes || '',
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
      toast.success(t('specimenDetail.tiqueUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('specimenDetail.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: t('specimenDetail.deleteTiqueTitle'),
      message: `${specimen.idTerrain ? `« ${specimen.idTerrain} »` : interpolate(t('specimenDetail.specimenN'), { id })} ${t('specimenDetail.deleteConfirmSuffix')}`,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/tiques/${id}`);
      toast.success(t('specimenDetail.tiqueDeleted'));
      navigate('/specimens/tiques');
    } catch (err) {
      toast.error(err.response?.data?.error || t('specimenDetail.deleteError'));
      setDeleting(false);
    }
  };

  if (loading) return <Spinner.Block label={t('specimenList.loading')} height="h-40" />;

  if (loadError || !specimen) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-fg-muted">{loadError || t('specimenDetail.notFound')}</p>
      <Link to="/specimens/tiques" className="text-primary text-sm hover:underline">{t('specimenDetail.backToTiques')}</Link>
    </div>
  );

  const tq = specimen;

  const taxoOptions     = taxonomies.map(tx => ({ value: String(tx.id), label: tx.parent ? `${tx.parent.nom} ${tx.nom}` : tx.nom }));
  const solutionOptions = [{ value: '', label: t('specimenDetail.none') }, ...solutions.map(s => ({ value: String(s.id), label: s.nom + (s.temperature ? ` (${s.temperature})` : '') }))];
  const stadeOptions    = [{ value: '', label: '—' }, ...STADE_OPTIONS_TIQUE];
  const sexeOptions     = [{ value: 'M', label: t('sexe.M') }, { value: 'F', label: t('sexe.F') }, { value: 'inconnu', label: t('sexe.inconnu') }];

  const loc                = tq.methode?.localite;
  const geoLabel           = [loc?.region, loc?.district, loc?.commune].filter(Boolean).join(' · ');
  const methodeIdentifiant = tq.methode?.typeMethode
    ? `${tq.methode.typeMethode.code}_${tq.methode.numero ?? 1}`
    : null;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: t('dashboard.tiques'), to: '/specimens/tiques' },
        { label: tq.idTerrain ?? `#${tq.id}` },
      ]} />

      <PageHeader
        icon={() => <SpecimenIcon type="tique" size={18} />}
        iconTone="specimen-tique"
        title={<span className="italic">{taxoLabel(tq.taxonomie)}</span>}
        subtitle={t('specimenTypes.tique')}
        actions={null}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] gap-5 items-start">

        {/* ══ Colonne principale ══ */}
        <div className="space-y-4">

          {/* Analyses de laboratoire — en tete : c'est la question centrale
              d'une fiche specimen pour un institut qui collecte des vecteurs
              afin de les tester. */}
          <AnalysesLabo specimenType="tique" specimenId={tq.id} />

          {/* Identification */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
              <Microscope size={15} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-fg">{t('specimenDetail.identification')}</h2>
            </div>

            {editing ? (
              <div className="space-y-4">
                <EditSelect label={t('specimenDetail.genreEspece')} value={editForm.taxonomieId}
                  onChange={e => setEditForm(f => ({ ...f, taxonomieId: e.target.value }))}
                  options={taxoOptions} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-fg-subtle font-medium block mb-1">{t('specimenDetail.nombre')}</label>
                    <input type="number" min="1" value={editForm.nombre}
                      onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                    />
                  </div>
                  <EditSelect label={t('specimenDetail.stade')} value={editForm.stade}
                    onChange={e => setEditForm(f => ({ ...f, stade: e.target.value }))}
                    options={stadeOptions} />
                  <EditSelect label={t('specimenDetail.sexe')} value={editForm.sexe}
                    onChange={e => setEditForm(f => ({ ...f, sexe: e.target.value }))}
                    options={sexeOptions} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-fg-subtle font-medium block mb-1">{t('tiqueDetail.partieCorpsHote')}</label>
                    <input type="text" value={editForm.partieCorpsHote}
                      onChange={e => setEditForm(f => ({ ...f, partieCorpsHote: e.target.value }))}
                      placeholder={t('tiqueDetail.partieCorpsHotePlaceholder')}
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                    />
                  </div>
                  <EditSelect label={t('specimenDetail.statutSanguin')} value={editForm.gorge}
                    onChange={e => setEditForm(f => ({ ...f, gorge: e.target.value }))}
                    options={GORGEMENT_OPTIONS} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <Field label={t('specimenDetail.genreEspece')}>
                    <span className="italic font-semibold text-specimen-tique">{taxoLabel(tq.taxonomie)}</span>
                  </Field>
                </div>
                <Field label={t('specimenDetail.sexe')}><Badge tone={SEXE_TONE[tq.sexe] ?? 'default'}>{SEXE_LABEL[tq.sexe] ?? '—'}</Badge></Field>
                <Field label={t('specimenDetail.nombre')}>{tq.nombre}</Field>
                {tq.stade && <Field label={t('specimenDetail.stade')}>{formatStade(tq.stade)}</Field>}
                <Field label={t('specimenDetail.statutSanguin')}>
                  <Badge tone={['G', 'Gr'].includes(tq.gorge) ? 'danger' : 'default'}>{formatGorgement(tq.gorge)}</Badge>
                </Field>
                {tq.partieCorpsHote && <Field label={t('tiqueDetail.partieCorpsHote')}>{tq.partieCorpsHote}</Field>}
              </div>
            )}
          </Card>

          {/* Hôte associé */}
          {tq.hote && (
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <Bird size={15} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-fg">{t('tiqueDetail.hoteAssocie')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('tiqueDetail.especeHote')}>{tq.hote.taxonomieHote?.nom || '—'}</Field>
                {tq.hote.nom && <Field label={t('tiqueDetail.identifiantHote')}>{tq.hote.nom}</Field>}
              </div>
            </Card>
          )}

          {/* Conservation — mode édition uniquement */}
          {editing && (
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <FlaskConical size={15} className="text-purple-500" />
                <h2 className="text-sm font-semibold text-fg">{t('specimenDetail.conservation')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditSelect label={t('specimenDetail.solutionConservation')} value={editForm.solutionId}
                  onChange={e => setEditForm(f => ({ ...f, solutionId: e.target.value }))}
                  options={solutionOptions} />
                <div>
                  <label className="text-xs text-fg-subtle font-medium block mb-1">{t('specimenDetail.dateCollecte')}</label>
                  <DatePicker value={editForm.dateCollecte}
                    onChange={val => setEditForm(f => ({ ...f, dateCollecte: val }))}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Notes */}
          {(tq.notes || editing) && (
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <FileText size={15} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-fg">{t('specimenDetail.notesObservations')}</h2>
              </div>
              {editing ? (
                <textarea rows={4} value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('specimenDetail.notesPlaceholder')}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg resize-none"
                />
              ) : (
                <p className="text-sm text-fg-muted whitespace-pre-line">{tq.notes}</p>
              )}
            </Card>
          )}

        </div>

        {/* ══ Sidebar ══ */}
        <aside className="space-y-3 xl:sticky xl:top-4 self-start">

          {/* Actions */}
          <Card padding="sm">
            <p className="text-2xs font-semibold text-fg-subtle uppercase tracking-wider mb-2.5">{t('specimenDetail.actions')}</p>
            <div className="space-y-2">
              {editing ? (
                <>
                  <Button variant="primary" className="w-full justify-center" icon={Save}
                    loading={saving} onClick={handleSave}>{t('common.save')}</Button>
                  <Button variant="secondary" className="w-full justify-center" icon={X}
                    onClick={() => setEditing(false)} disabled={saving}>{t('common.cancel')}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full justify-center" icon={Pencil}
                    onClick={startEdit}>{t('common.edit')}</Button>
                  {isAdmin && (
                    <Button variant="danger" className="w-full justify-center" icon={Trash2}
                      loading={deleting} onClick={handleDelete}>{t('common.delete')}</Button>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* ID terrain */}
          {tq.idTerrain && (
            <Card padding="sm" tone="primary">
              <p className="text-2xs text-fg-subtle uppercase tracking-wider font-medium mb-1">{t('specimenDetail.idTerrain')}</p>
              <p className="font-mono font-bold text-primary text-sm">{tq.idTerrain}</p>
            </Card>
          )}

          {/* Localisation */}
          <Card padding="sm">
            <SidebarSection icon={MapPin} iconClass="text-danger" label={t('specimenDetail.localisation')}>
              <div className="flex flex-wrap items-center gap-1 text-xs text-fg-muted mb-2">
                <span className="font-semibold text-fg">
                  {loc?.mission?.projet?.nom || loc?.mission?.projet?.code || '—'}
                </span>
                <span className="text-fg-subtle">›</span>
                <span>{loc?.mission?.ordreMission || '—'}</span>
                <span className="text-fg-subtle">›</span>
                <span className="font-semibold text-fg">{loc?.fokontany || loc?.nom || '—'}</span>
              </div>
              {geoLabel && <p className="text-xs text-fg-subtle mb-3">{geoLabel}</p>}
            </SidebarSection>

            <div className="border-t border-border my-2.5" />

            <SidebarSection icon={Beaker} iconClass="text-info" label={t('specimenDetail.methodeCollecte')}>
              {tq.methode?.typeMethode ? (
                <div className="text-xs text-fg font-medium">
                  <span>{tq.methode.typeMethode.nom}</span>
                  {methodeIdentifiant && (
                    <>
                      <span className="text-fg-subtle mx-1.5">|</span>
                      <span className="font-mono text-primary">{methodeIdentifiant}</span>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-xs text-fg-subtle">—</span>
              )}
            </SidebarSection>
          </Card>

          {/* Conservation */}
          <Card padding="sm">
            <SidebarSection icon={FlaskConical} iconClass="text-purple-500" label={t('specimenDetail.conservation')}>
              <SidebarRow label={t('specimenDetail.solution')}>
                {tq.solution?.nom || <span className="text-fg-subtle">—</span>}
              </SidebarRow>
              <SidebarRow label={t('specimenDetail.container')}>
                {tq.container ? (
                  <span>
                    <span className="font-mono">{tq.container.code}</span>
                    {tq.position && (
                      <>
                        <span className="text-fg-subtle mx-1">|</span>
                        <span>{t('specimenDetail.position')} {tq.position}</span>
                      </>
                    )}
                  </span>
                ) : <span className="text-fg-subtle">—</span>}
              </SidebarRow>
              <SidebarRow label={t('specimenDetail.date')}>
                {tq.dateCollecte ? new Date(tq.dateCollecte).toLocaleDateString(t('common.locale')) : <span className="text-fg-subtle">—</span>}
              </SidebarRow>
            </SidebarSection>
          </Card>


        </aside>
      </div>
    </div>
  );
}
