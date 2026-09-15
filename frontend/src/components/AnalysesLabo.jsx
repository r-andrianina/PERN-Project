// Historique des analyses de laboratoire d'un spécimen, pour les quatre pages
// de détail (moustique, tique, puce, autre spécimen).
//
// Jusqu'ici, ces fiches n'affichaient RIEN du laboratoire : on ne pouvait pas
// savoir, en ouvrant un spécimen, s'il avait été analysé, ce qu'on avait
// cherché ni ce qu'on avait trouvé. Pour un institut qui collecte des vecteurs
// afin de les tester, c'était la question centrale sans réponse.
//
// Composant unique plutôt qu'un bloc recopié dans chaque page : les quatre
// fiches viennent justement d'être défactorisées de leurs doublons
// (cf. SpecimenDetailParts.jsx), inutile d'en recréer.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Layers, CircleDot } from 'lucide-react';
import { Badge } from './ui';
import { useApiQuery } from '../hooks';
import { getTypeConfig, getStatutConfig } from '../utils/laboConfig';
import { useT, interpolate } from '../lib/i18n';

// Verdict d'une manipulation, quel que soit le module qui le porte : PCR et
// nested-PCR concluent par une bande de gel, la qPCR par une valeur de Ct.
function lireResultat(manip) {
  const { pcr, qpcr, nestedPcr, microscopie } = manip;
  if (pcr?.statutBandeGel)        return { texte: pcr.statutBandeGel,        cle: pcr.statutBandeGel };
  if (nestedPcr?.resultatFinal)   return { texte: nestedPcr.resultatFinal,   cle: nestedPcr.resultatFinal };
  if (microscopie?.resultat)      return { texte: microscopie.resultat,      cle: microscopie.resultat };
  // Le Ct n'est pas un verdict : l'interprétation dépend d'un seuil propre au
  // protocole. On l'affiche comme une mesure, sans le colorer en positif.
  if (qpcr?.valeurCt != null)     return { texte: `Ct ${qpcr.valeurCt}`,     cle: null };
  return null;
}

const TON_RESULTAT = { positif: 'danger', negatif: 'success', inconclusif: 'warning' };

function pathogeneDe(manip) {
  return (manip.pcr ?? manip.qpcr ?? manip.nestedPcr)?.pathogeneCible ?? null;
}

function LigneAnalyse({ manip, t, typeCfg, statutCfg }) {
  const [ouvert, setOuvert] = useState(false);
  const resultat  = lireResultat(manip);
  const pathogene = pathogeneDe(manip);
  const viaPool   = manip.origine === 'pool';

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="w-full flex items-center gap-2 py-2 text-left hover:bg-bg-subtle rounded px-1 -mx-1"
        aria-expanded={ouvert}
      >
        {ouvert ? <ChevronDown size={13} className="text-fg-subtle shrink-0" />
                : <ChevronRight size={13} className="text-fg-subtle shrink-0" />}

        <span className="text-xs font-medium text-fg">
          {typeCfg[manip.typeManipulation]?.label ?? manip.typeManipulation}
        </span>

        {viaPool && (
          // Distinction essentielle : un résultat de pool vaut pour le POOL,
          // pas pour l'individu. Un pool positif dit « au moins un des N ».
          <span className="inline-flex items-center gap-1 text-[10px] text-fg-subtle">
            <Layers size={10} />
            {manip.pool?.code}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {resultat && (
            <Badge tone={TON_RESULTAT[resultat.cle] ?? 'default'}>{resultat.texte}</Badge>
          )}
          <Badge tone={statutCfg[manip.statut]?.tone ?? 'default'}>
            {statutCfg[manip.statut]?.label ?? manip.statut}
          </Badge>
        </span>
      </button>

      {ouvert && (
        <dl className="pb-2 pl-6 pr-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          {pathogene && (
            <>
              <dt className="text-fg-subtle">{t('analysesLabo.pathogeneRecherche')}</dt>
              <dd className="text-fg">{pathogene.nom}</dd>
            </>
          )}
          <dt className="text-fg-subtle">{t('analysesLabo.operateur')}</dt>
          <dd className="text-fg">{manip.operateur ? `${manip.operateur.prenom} ${manip.operateur.nom}` : '—'}</dd>

          <dt className="text-fg-subtle">{t('analysesLabo.dateDebut')}</dt>
          <dd className="text-fg">
            {manip.dateDebut ? new Date(manip.dateDebut).toLocaleDateString(t('common.locale')) : '—'}
          </dd>

          {manip.validePar && (
            <>
              <dt className="text-fg-subtle">{t('analysesLabo.validePar')}</dt>
              <dd className="text-fg">{`${manip.validePar.prenom} ${manip.validePar.nom}`}</dd>
            </>
          )}

          {viaPool && (
            <>
              <dt className="text-fg-subtle">{t('analysesLabo.portee')}</dt>
              <dd className="text-fg">
                {interpolate(t('analysesLabo.resultatDePool'), { n: manip.pool?.nombreIndividus ?? '?' })}
              </dd>
            </>
          )}

          <dt className="sr-only">{t('analysesLabo.fiche')}</dt>
          <dd className="col-span-2 pt-1">
            <Link to={`/labo/${manip.id}`} className="text-primary-600 hover:underline">
              {t('analysesLabo.voirManipulation')}
            </Link>
          </dd>
        </dl>
      )}
    </div>
  );
}

/**
 * @param {string} specimenType  moustique | tique | puce | autre
 * @param {number} specimenId
 */
export default function AnalysesLabo({ specimenType, specimenId }) {
  const t = useT();
  const typeCfg   = getTypeConfig(t);
  const statutCfg = getStatutConfig(t);
  const { data, loading } = useApiQuery(
    `/labo/specimen/${specimenType}/${specimenId}`,
    { immediate: Boolean(specimenId) },
  );

  if (loading) return <p className="text-[11px] text-fg-subtle">{t('common.loading')}</p>;

  const analyses = data?.analyses ?? [];
  const resume   = data?.resume;

  // Le module labo est encore peu utilisé : l'immense majorité des spécimens
  // n'a aucune analyse. On le dit en une ligne discrète plutôt qu'avec un
  // grand bloc vide — mais on le dit, pour que la section reste découvrable.
  if (analyses.length === 0) {
    return <p className="text-[11px] text-fg-subtle italic">{t('analysesLabo.aucuneAnalyse')}</p>;
  }

  return (
    <div>
      {resume?.enAttenteValidation > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-warning mb-1.5">
          <CircleDot size={11} />
          {interpolate(t('analysesLabo.enAttenteValidation'), { n: resume.enAttenteValidation })}
        </p>
      )}
      {analyses.map((m) => <LigneAnalyse key={m.id} manip={m} t={t} typeCfg={typeCfg} statutCfg={statutCfg} />)}
    </div>
  );
}
