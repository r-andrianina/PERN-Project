// Analyses de laboratoire d'un spécimen, en tête de la colonne principale des
// quatre fiches de détail (moustique, tique, puce, autre spécimen).
//
// Pourquoi en tête, et non dans la colonne latérale (déplacé le 2026-09-16) :
// pour un institut qui collecte des vecteurs AFIN de les tester, « qu'a-t-on
// cherché, et qu'a-t-on trouvé ? » est la question centrale de la fiche. Le
// bloc occupait la dernière section de la dernière carte d'une colonne de
// 300 px, en 10-11 px, replié derrière un chevron — et sous 1280 px la grille
// se replie, ce qui l'envoyait tout en bas de page.
//
// Composant unique plutôt qu'un bloc recopié dans chaque page : les quatre
// fiches viennent d'être défactorisées de leurs doublons (cf.
// SpecimenDetailParts.jsx), inutile d'en recréer.

import { Link, useNavigate } from 'react-router-dom';
import { FlaskConical, Beaker, Clock, CircleAlert, Check } from 'lucide-react';
import { Card, Badge, Button } from './ui';
import { useApiQuery } from '../hooks';
import { getTypeConfig } from '../utils/laboConfig';
import { useT, interpolate } from '../lib/i18n';

// Verdict d'une manipulation, quel que soit le module qui le porte : PCR et
// nested-PCR concluent par une bande de gel, la microscopie par une lecture.
// Le Ct d'une qPCR n'est PAS un verdict — son interprétation dépend d'un seuil
// propre au protocole — il est donc rendu comme une mesure, jamais coloré en
// positif.
function lireResultat(manip) {
  const { pcr, qpcr, nestedPcr, microscopie } = manip;
  if (pcr?.statutBandeGel)      return { cle: pcr.statutBandeGel };
  if (nestedPcr?.resultatFinal) return { cle: nestedPcr.resultatFinal };
  if (microscopie?.resultat)    return { cle: microscopie.resultat };
  if (qpcr?.valeurCt != null)   return { cle: null, ct: qpcr.valeurCt };
  return null;
}

const pathogeneDe = (manip) => (manip.pcr ?? manip.qpcr ?? manip.nestedPcr)?.pathogeneCible ?? null;

const TON_RESULTAT = { positif: 'danger', negatif: 'success', inconclusif: 'warning' };
const GRAVITE      = { positif: 3, inconclusif: 2, negatif: 1 };

/**
 * Un verdict par pathogène recherché, pour le bandeau de tête.
 *
 * Quand un même pathogène a été cherché plusieurs fois, on retient le résultat
 * le PLUS GRAVE, pas le plus récent : une PCR positive suivie d'une négative
 * reste une information qu'on ne peut pas masquer derrière la dernière en date.
 */
function verdictsParPathogene(analyses) {
  const parId = new Map();
  for (const m of analyses) {
    const pathogene = pathogeneDe(m);
    const resultat  = lireResultat(m);
    if (!pathogene || !resultat?.cle) continue;

    const courant = parId.get(pathogene.id);
    if (courant && GRAVITE[courant.cle] >= GRAVITE[resultat.cle]) continue;
    parId.set(pathogene.id, {
      pathogene,
      cle:     resultat.cle,
      origine: m.origine,
      poolN:   m.pool?.nombreIndividus ?? null,
    });
  }
  return [...parId.values()].sort((a, b) => (GRAVITE[b.cle] ?? 0) - (GRAVITE[a.cle] ?? 0));
}

const CLASSES_VERDICT = {
  positif:     'bg-danger/[0.06] border-danger/20 text-danger',
  inconclusif: 'bg-warning/[0.06] border-warning/20 text-warning',
  negatif:     'bg-success/[0.06] border-success/20 text-success',
};

function Verdict({ v, t }) {
  const Icone = v.cle === 'negatif' ? Check : CircleAlert;
  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-token border ${CLASSES_VERDICT[v.cle] ?? CLASSES_VERDICT.inconclusif}`}>
      <Icone size={16} className="shrink-0" />
      <div>
        <p className="text-sm font-semibold">
          {v.pathogene.nom} — {t(`analysesLabo.resultat_${v.cle}`)}
        </p>
        <p className="text-xs text-fg-muted mt-px">
          {v.origine === 'pool'
            // Distinction essentielle : un pool positif dit « au moins un des
            // N », il ne désigne pas cet individu. Écrit en toutes lettres
            // plutôt que suggéré par une icône, parce que présenter les deux
            // comme équivalents serait une erreur d'interprétation.
            ? interpolate(t('analysesLabo.resultatDePool'), { n: v.poolN ?? '?' })
            : t('analysesLabo.analyseIndividuelle')}
        </p>
      </div>
    </div>
  );
}

const COLONNES = 'grid grid-cols-[150px_100px_1fr_150px_110px] gap-3';

function Ligne({ manip, t, typeCfg }) {
  const resultat = lireResultat(manip);
  const cfg      = typeCfg[manip.typeManipulation];
  const Icone    = cfg?.Icon ?? FlaskConical;
  const statut   = manip.statut;

  return (
    <div className={`${COLONNES} items-center py-3 border-b border-border last:border-0`}>
      <Link to={`/labo/${manip.id}`} className="flex items-center gap-2 text-[13px] font-medium text-fg hover:text-primary-600">
        <Icone size={15} className={`${cfg?.color ?? 'text-fg-muted'} shrink-0`} />
        <span className="truncate">{cfg?.label ?? manip.typeManipulation}</span>
      </Link>

      <span className="text-[13px] text-fg-muted">
        {manip.dateDebut ? new Date(manip.dateDebut).toLocaleDateString(t('common.locale')) : '—'}
      </span>

      <span className="flex items-center gap-2 min-w-0">
        {manip.origine === 'pool' ? (
          <>
            <Badge tone="info" size="sm">{manip.pool?.code}</Badge>
            <span className="text-xs text-fg-muted truncate">
              {interpolate(t('analysesLabo.porteePoolIndividus'), { n: manip.pool?.nombreIndividus ?? '?' })}
            </span>
          </>
        ) : (
          <span className="text-[13px] text-fg-muted">{t('analysesLabo.porteeIndividuelle')}</span>
        )}
      </span>

      <span>
        {resultat?.cle
          ? <Badge tone={TON_RESULTAT[resultat.cle] ?? 'default'}>{t(`analysesLabo.resultat_${resultat.cle}`)}</Badge>
          : resultat?.ct != null
            ? <Badge tone="default">{interpolate(t('analysesLabo.ct'), { v: resultat.ct })}</Badge>
            : <span className="text-[13px] text-fg-subtle">—</span>}
      </span>

      <span>
        <Badge tone={statut === 'valide' ? 'success' : statut === 'invalide' ? 'danger' : 'default'}>
          {t(`laboPage.statut${statut === 'valide' ? 'Valide' : statut === 'invalide' ? 'Invalide' : 'Brut'}`)}
        </Badge>
      </span>
    </div>
  );
}

/**
 * @param {string} specimenType  moustique | tique | puce | autre
 * @param {number} specimenId
 */
export default function AnalysesLabo({ specimenType, specimenId }) {
  const t        = useT();
  const navigate = useNavigate();
  const typeCfg  = getTypeConfig(t);

  const { data, loading } = useApiQuery(
    `/labo/specimen/${specimenType}/${specimenId}`,
    { immediate: Boolean(specimenId) },
  );

  const creer = () => navigate(`/labo/nouvelle?specimenType=${specimenType}&specimenId=${specimenId}`);

  const BoutonCreer = (
    <Button variant="secondary" size="sm" icon={Beaker} onClick={creer}>
      {t('analysesLabo.creerManipulation')}
    </Button>
  );

  if (loading) {
    return (
      <Card padding="none" className="px-5 py-3.5">
        <p className="text-[13px] text-fg-muted">{t('common.loading')}</p>
      </Card>
    );
  }

  const analyses = data?.analyses ?? [];
  const resume   = data?.resume;

  // Le module labo est encore peu utilisé : l'immense majorité des spécimens
  // n'a aucune analyse. Un bandeau pleine hauteur y serait un grand bloc creux
  // — il tombe donc à une seule ligne. Mais il ne disparaît pas : c'est le
  // seul endroit d'où lancer une manipulation depuis la fiche (le bouton
  // n'existait auparavant que sur « autre spécimen »).
  if (analyses.length === 0) {
    return (
      <Card padding="none" className="px-5 py-3.5 flex items-center gap-3">
        <FlaskConical size={16} className="text-fg-subtle shrink-0" />
        <span className="text-[13px] text-fg-muted">{t('analysesLabo.aucuneAnalyse')}</span>
        <span className="ml-auto shrink-0">{BoutonCreer}</span>
      </Card>
    );
  }

  const verdicts = verdictsParPathogene(analyses);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2.5 mb-3.5">
          <FlaskConical size={16} className="text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-fg">{t('analysesLabo.titre')}</h2>
          <Badge tone="default">
            {interpolate(t('analysesLabo.nManipulations'), { n: resume?.total ?? analyses.length })}
          </Badge>
          <span className="ml-auto shrink-0">{BoutonCreer}</span>
        </div>

        {verdicts.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {verdicts.map((v) => <Verdict key={v.pathogene.id} v={v} t={t} />)}
          </div>
        )}

        {resume?.enAttenteValidation > 0 && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-token bg-warning/[0.07]">
            <Clock size={14} className="text-warning shrink-0" />
            <span className="text-[13px] text-warning">
              <strong className="font-semibold">
                {interpolate(t('analysesLabo.enAttenteValidation'), { n: resume.enAttenteValidation })}
              </strong>
              {' — '}{t('analysesLabo.nonConfirme')}
            </span>
          </div>
        )}
      </div>

      <div className="px-6 pt-1 pb-4 overflow-x-auto">
        <div className={`${COLONNES} pt-3 pb-2 border-b border-border`}>
          <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">{t('analysesLabo.colManipulation')}</span>
          <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">{t('analysesLabo.colDate')}</span>
          <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">{t('analysesLabo.colPortee')}</span>
          <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">{t('analysesLabo.colResultat')}</span>
          <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">{t('analysesLabo.colStatut')}</span>
        </div>
        {analyses.map((m) => <Ligne key={m.id} manip={m} t={t} typeCfg={typeCfg} />)}
      </div>
    </Card>
  );
}
