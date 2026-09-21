// Coque commune des listes de spécimens.
//
// TiquesPage et PucesPage étaient identiques à 92 % (38 lignes divergentes sur
// 482) : mêmes colonnes, même recherche débounçée, même export, même pagination.
// Les seules vraies différences tenaient au type de spécimen, à une colonne
// supplémentaire côté tiques, et à une largeur de tableau.
//
// Le dépôt avait déjà ce motif pour les référentiels (_referentielFactory.js /
// ReferentielSimplePage.jsx) ; les pages spécimens ne l'avaient jamais adopté.
//
// Hors périmètre volontairement : MoustiquesPage. Elle porte une suppression en
// masse réservée aux admins (~120 lignes : sélection, « tout ce qui correspond
// au filtre », dialogues de confirmation, colonne de cases à cocher). Ce n'est
// pas de la répétition, c'est une fonctionnalité — la plier ici en option
// rendrait la coque plus difficile à lire que les deux pages qu'elle remplace.
// Elle pourra adopter cette coque en passant son bloc en slot, revu à part.
// AutresSpecimensPage est aussi à part : 176 lignes, d'une autre forme.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, X } from 'lucide-react';
import { Card, Button, EmptyState, PageHeader, Spinner, Pagination, DataTable } from './ui';
import { useApiQuery } from '../hooks';
import { exportBlob, exportDate } from '../api/exportBlob';
import SpecimenIcon from './SpecimenIcon';
import { useT, interpolate } from '../lib/i18n';
import { sortRows } from '../utils/specimenSort';


/**
 * @param {string}   type       'tique' | 'puce' — pour l'icône et sa teinte
 * @param {string}   pluriel    segment d'URL et clé du tableau renvoyé par l'API
 * @param {string}   titreCle   clé i18n du titre de page
 * @param {string}   videCle    clé i18n de l'état « aucun spécimen »
 * @param {Function} colonnes   (t) => tableau de colonnes DataTable
 * @param {string}   largeurMin largeur minimale du tableau avant défilement
 *
 * Les clés i18n sont passées explicitement, et non fabriquées par concaténation
 * depuis `pluriel` : une clé construite à la volée ne se retrouve plus par une
 * recherche texte, ce qui casse l'audit des traductions.
 */
export default function SpecimenListPage({ type, pluriel, titreCle, videCle, colonnes, largeurMin }) {
  const t        = useT();
  const navigate = useNavigate();

  const [search,    setSearch]    = useState('');
  const [debounced, setDebounced] = useState('');
  const [page,      setPage]      = useState(1);
  const [limit,     setLimit]     = useState(50);
  const [sort,      setSort]      = useState(null);
  const [exporting, setExporting] = useState(false);

  const routeListe = `/specimens/${pluriel}`;

  const handleExport = async () => {
    setExporting(true);
    try { await exportBlob(`/${pluriel}/export`, {}, `${pluriel}_${exportDate()}.xlsx`); }
    finally { setExporting(false); }
  };

  useEffect(() => {
    const tid = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(tid);
  }, [search]);

  const { data, loading } = useApiQuery(`/${pluriel}`, {
    params: { page, limit, search: debounced || undefined },
    deps: [page, limit, debounced],
  });

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const rows    = useMemo(() => sortRows(data?.[pluriel] ?? [], sort, t('common.locale')), [data, sort, t, pluriel]);
  const COLUMNS = useMemo(() => colonnes(t), [colonnes, t]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={() => <SpecimenIcon type={type} size={18} />}
        iconTone={`specimen-${type}`}
        title={t(titreCle)}
        subtitle={interpolate(t('specimenList.total'), { n: total })}
        actions={
          <>
            <Button variant="secondary" icon={Download}
              onClick={handleExport} disabled={exporting}>
              {exporting ? t('specimenList.exporting') : t('specimenList.exportExcel')}
            </Button>
            <Button icon={Plus} onClick={() => navigate(`${routeListe}/nouveau`)}>
              {t('specimenList.add')}
            </Button>
          </>
        }
      />

      {loading && !data ? (
        <Spinner.Block label={t('specimenList.loading')} />
      ) : total === 0 && !debounced ? (
        <EmptyState
          icon={() => <SpecimenIcon type={type} size={40} />}
          title={t(videCle)}
          action={{
            label: t('specimenList.addFirst'),
            icon: Plus,
            onClick: () => navigate(`${routeListe}/nouveau`),
          }}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">

          {/* Barre de recherche */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 border border-border-strong rounded-xl px-3.5 py-2 bg-surface-2 focus-within:bg-surface focus-within:border-primary transition-all">
              <Search size={14} className="text-fg-subtle flex-shrink-0" />
              <input
                type="text"
                placeholder={t('specimenList.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none text-fg placeholder-fg-subtle"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-muted">
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-xs text-fg-subtle whitespace-nowrap font-medium">
              {interpolate(t('specimenList.resultsCount'), { n: total })}
            </span>
          </div>

          <DataTable
            columns={COLUMNS}
            rows={rows}
            loading={loading}
            skeletonRows={Math.min(limit, 10)}
            sort={sort}
            onSort={(key, dir) => setSort({ key, dir })}
            onRowClick={(r) => navigate(`${routeListe}/${r.id}`)}
            minWidth={largeurMin}
            empty={
              <span className="text-fg-subtle text-sm">
                {interpolate(t('specimenList.noResultsFor'), { query: debounced })}
              </span>
            }
          />

          <Pagination
            page={page} pages={pages} total={total} limit={limit}
            onChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1); }}
          />
        </Card>
      )}
    </div>
  );
}
