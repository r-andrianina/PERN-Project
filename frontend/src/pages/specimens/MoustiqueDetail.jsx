import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Microscope, FlaskConical, FileText,
  Pencil, Trash2, Save, X, MapPin, Beaker,
} from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, Button, PageHeader, Spinner, Select, Breadcrumb, DatePicker } from '../../components/ui';
import SpecimenIcon from '../../components/SpecimenIcon';
import useAuthStore from '../../store/authStore';
import { toast } from '../../lib/toast';
import { dialog } from '../../lib/dialog';
import { STADE_OPTIONS_MOUSTIQUE, formatStade } from '../../utils/stade';
import { GORGEMENT_OPTIONS, formatGorgement } from '../../utils/gorgement';
import { TRANCHE_HORAIRE_OPTIONS, formatTrancheHoraire } from '../../utils/trancheHoraire';
import { taxoLabel as _taxoLabel } from '../../utils/taxoLabel';
import { useT, interpolate } from '../../lib/i18n';

const SEXE_TONE  = { M: 'info', F: 'danger', inconnu: 'default' };
const taxoLabel  = (tx) => tx ? _taxoLabel(tx) : '—';

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
      api.get(`/moustiques/${id}`),
      api.get('/dictionnaire/solutions-conservation', { params: { actif: 'true' } }),
      api.get('/dictionnaire/taxonomie-specimens', { params: { type: 'moustique', niveau: 'espece', actif: 'true' } }),
    ])
      .then(([mRes, sRes, tRes]) => {
        setSpecimen(mRes.data.moustique);
        setSolutions(sRes.data.items || []);
        setTaxonomies(tRes.data.items || []);
      })
      .catch(() => setLoadError(t('specimenDetail.loadError')))
      .finally(() => setLoading(false));
  }, [id, t]);

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
      trancheHoraire: m.trancheHoraire || '',
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
        trancheHoraire: editForm.trancheHoraire || null,
      });
      setSpecimen(r.data.moustique);
      setEditing(false);
      toast.success(t('specimenDetail.moustiqueUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('specimenDetail.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: t('specimenDetail.deleteMoustiqueTitle'),
      message: `${specimen.idTerrain ? `« ${specimen.idTerrain} »` : interpolate(t('specimenDetail.specimenN'), { id })} ${t('specimenDetail.deleteConfirmSuffix')}`,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/moustiques/${id}`);
      toast.success(t('specimenDetail.moustiqueDeleted'));
      navigate('/specimens/moustiques');
    } catch (err) {
      toast.error(err.response?.data?.error || t('specimenDetail.deleteError'));
      setDeleting(false);
    }
  };

  if (loading) return <Spinner.Block label={t('specimenList.loading')} height="h-40" />;

  if (loadError || !specimen) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-fg-muted">{loadError || t('specimenDetail.notFound')}</p>
      <Link to="/specimens/moustiques" className="text-primary text-sm hover:underline">{t('specimenDetail.backToMoustiques')}</Link>
    </div>
  );

  const m = specimen;
  const stadeImmature  = editForm.stade === 'L' || editForm.stade === 'E';
  const sexeForce      = stadeImmature ? 'inconnu' : editForm.sexe;
  const pariteDisabled = stadeImmature || sexeForce !== 'F';
  const repasSangOff   = stadeImmature || sexeForce !== 'F';

  const taxoOptions     = taxonomies.map(tx => ({ value: String(tx.id), label: tx.parent ? `${tx.parent.nom} ${tx.nom}` : tx.nom }));
  const solutionOptions = [{ value: '', label: t('specimenDetail.none') }, ...solutions.map(s => ({ value: String(s.id), label: s.nom + (s.temperature ? ` (${s.temperature})` : '') }))];
  const stadeOptions    = [{ value: '', label: '—' }, ...STADE_OPTIONS_MOUSTIQUE];
  const sexeOptions     = [{ value: 'M', label: t('sexe.M') }, { value: 'F', label: t('sexe.F') }, { value: 'inconnu', label: t('sexe.inconnu') }];
  const pariteOptions   = [{ value: '', label: '—' }, ...['Nullipare', 'Pare'].map(v => ({ value: v, label: v }))];
  const trancheHoraireOptions = [{ value: '', label: '—' }, ...TRANCHE_HORAIRE_OPTIONS];
  const requiresTrancheHoraire = !!m.methode?.typeMethode?.requiresTrancheHoraire;
  const organeOptions   = [
    { value: '', label: '—' },
    { value: 'Tête',    label: t('specimenDetail.organeTete') },
    { value: 'Thorax',  label: t('specimenDetail.organeThorax') },
    { value: 'Abdomen', label: t('specimenDetail.organeAbdomen') },
    { value: 'Entier',  label: t('specimenDetail.organeEntier') },
  ];

  // Données de localisation
  const loc      = m.methode?.localite;
  const geoLabel = [loc?.region, loc?.district, loc?.commune].filter(Boolean).join(' · ');
  const methodeIdentifiant = m.methode?.typeMethode
    ? `${m.methode.typeMethode.code}_${m.methode.numero ?? 1}`
    : null;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: t('dashboard.moustiques'), to: '/specimens/moustiques' },
        { label: m.idTerrain ?? `#${m.id}` },
      ]} />

      <PageHeader
        icon={() => <SpecimenIcon type="moustique" size={18} />}
        iconTone="specimen-moustique"
        title={<span className="italic">{taxoLabel(m.taxonomie)}</span>}
        subtitle={t('specimenTypes.moustique')}
        actions={null}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] gap-5 items-start">

        {/* ══ Colonne principale ══ */}
        <div className="space-y-4">

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-fg-subtle font-medium block mb-1">{t('specimenDetail.nombre')}</label>
                    <input type="number" min="1" value={editForm.nombre}
                      onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface text-fg"
                    />
                  </div>
                  <EditSelect label={t('specimenDetail.stade')} value={editForm.stade}
                    onChange={e => handleStadeChange(e.target.value)} options={stadeOptions} />
                  <EditSelect label={t('specimenDetail.sexe')} value={sexeForce}
                    onChange={e => handleSexeChange(e.target.value)}
                    options={sexeOptions} disabled={stadeImmature} />
                  <EditSelect label={t('specimenDetail.parite')} value={editForm.parite}
                    onChange={e => setEditForm(f => ({ ...f, parite: e.target.value }))}
                    options={pariteOptions} disabled={pariteDisabled} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <EditSelect label={t('specimenDetail.organePreleve')} value={editForm.organePreleve}
                    onChange={e => setEditForm(f => ({ ...f, organePreleve: e.target.value }))}
                    options={organeOptions} />
                  <EditSelect label={t('specimenDetail.statutSanguin')} value={editForm.repasSang}
                    onChange={e => setEditForm(f => ({ ...f, repasSang: e.target.value }))}
                    options={GORGEMENT_OPTIONS} disabled={repasSangOff} />
                </div>
                {requiresTrancheHoraire && (
                  <EditSelect label={t('specimenDetail.trancheHoraire')} value={editForm.trancheHoraire}
                    onChange={e => setEditForm(f => ({ ...f, trancheHoraire: e.target.value }))}
                    options={trancheHoraireOptions} />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <Field label={t('specimenDetail.genreEspece')}>
                    <span className="italic font-semibold text-specimen-moustique">{taxoLabel(m.taxonomie)}</span>
                  </Field>
                </div>
                <Field label={t('specimenDetail.sexe')}>
                  <Badge tone={SEXE_TONE[m.sexe] ?? 'default'}>{SEXE_LABEL[m.sexe] ?? '—'}</Badge>
                </Field>
                <Field label={t('specimenDetail.nombre')}>{m.nombre}</Field>
                {m.stade         && <Field label={t('specimenDetail.stade')}>{formatStade(m.stade)}</Field>}
                {m.parite        && <Field label={t('specimenDetail.parite')}>{m.parite}</Field>}
                {m.organePreleve && <Field label={t('specimenDetail.organePreleve')}>{m.organePreleve}</Field>}
                {m.trancheHoraire && <Field label={t('specimenDetail.trancheHoraire')}>{formatTrancheHoraire(m.trancheHoraire)}</Field>}
                <Field label={t('specimenDetail.statutSanguin')}>
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
          {(m.notes || editing) && (
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
                <p className="text-sm text-fg-muted whitespace-pre-line">{m.notes}</p>
              )}
            </Card>
          )}

        </div>

        {/* ══ Sidebar ══ */}
        <aside className="space-y-3 xl:sticky xl:top-4 self-start">

          {/* Actions */}
          <Card padding="sm">
            <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider mb-2.5">{t('specimenDetail.actions')}</p>
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
          {m.idTerrain && (
            <Card padding="sm" tone="primary">
              <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-1">{t('specimenDetail.idTerrain')}</p>
              <p className="font-mono font-bold text-primary text-sm">{m.idTerrain}</p>
            </Card>
          )}

          {/* Localisation */}
          <Card padding="sm">
            <SidebarSection icon={MapPin} iconClass="text-danger" label={t('specimenDetail.localisation')}>
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
            <SidebarSection icon={Beaker} iconClass="text-info" label={t('specimenDetail.methodeCollecte')}>
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
            <SidebarSection icon={FlaskConical} iconClass="text-purple-500" label={t('specimenDetail.conservation')}>
              <SidebarRow label={t('specimenDetail.solution')}>
                {m.solution?.nom || <span className="text-fg-subtle">—</span>}
              </SidebarRow>
              <SidebarRow label={t('specimenDetail.container')}>
                {m.container ? (
                  <span>
                    <span className="font-mono">{m.container.code}</span>
                    {m.position && (
                      <>
                        <span className="text-fg-subtle mx-1">|</span>
                        <span>{t('specimenDetail.position')} {m.position}</span>
                      </>
                    )}
                  </span>
                ) : <span className="text-fg-subtle">—</span>}
              </SidebarRow>
              <SidebarRow label={t('specimenDetail.date')}>
                {m.dateCollecte ? new Date(m.dateCollecte).toLocaleDateString(t('common.locale')) : <span className="text-fg-subtle">—</span>}
              </SidebarRow>
            </SidebarSection>
          </Card>


        </aside>
      </div>
    </div>
  );
}
