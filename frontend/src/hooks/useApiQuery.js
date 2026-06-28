// useApiQuery — wrapper autour de @tanstack/react-query.
// API externe identique à l'ancienne implémentation : les pages consommatrices
// n'ont rien à modifier. On gagne le cache entre navigations, la déduplication
// des requêtes parallèles et le background-refetch gratuits.
//
// Usage :
//   const { data, loading, error, refetch } = useApiQuery('/projets');
//   const { data, loading } = useApiQuery('/moustiques', {
//     params: { page, limit }, deps: [page, limit],
//   });
//   const { results, loading } = useApiQueries([
//     { url: '/localites', key: 'localites', select: r => r.localites ?? [] },
//   ]);

import { useQuery, useQueries } from '@tanstack/react-query';
import api from '../api/axios';

// 30 s : données considérées fraîches. Au-delà, un refetch en arrière-plan
// est déclenché si la fenêtre reprend le focus ou si le composant remonte.
const STALE_MS = 30_000;

function extractError(err) {
  return err?.response?.data?.error ?? err?.message ?? 'Erreur de chargement';
}

/**
 * Fetch simple avec cache TanStack Query.
 *
 * @param {string} url            Endpoint relatif (ex: '/projets')
 * @param {object} [opts]
 * @param {object}   [opts.params]    Paramètres de requête
 * @param {Array}    [opts.deps]      Valeurs supplémentaires incluses dans la clé de cache
 *                                    (déclenche un nouveau fetch quand elles changent)
 * @param {boolean}  [opts.immediate] false → query désactivée jusqu'au premier refetch() (défaut: true)
 * @param {function} [opts.select]    Transforme la réponse avant mise en cache
 */
export function useApiQuery(url, { params, deps = [], immediate = true, select } = {}) {
  const queryKey = [url, params ?? null, ...deps];

  const { data, isPending, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await api.get(url, { params });
      return select ? select(r.data) : r.data;
    },
    enabled:   immediate,
    staleTime: STALE_MS,
    retry:     1,
  });

  return {
    data:    data ?? null,
    loading: isPending,
    error:   error ? extractError(error) : null,
    refetch,
  };
}

/**
 * Fetch multiple requêtes en parallèle avec cache indépendant par clé.
 *
 * @param {Array<{ url, key, params?, select? }>} queries
 * @returns {{ results: Record<key, data>, loading: boolean, errors: Record<key, string> }}
 */
export function useApiQueries(queries) {
  const queryResults = useQueries({
    queries: queries.map(({ url, params, select }) => ({
      queryKey: [url, params ?? null],
      queryFn: async () => {
        const r = await api.get(url, { params });
        return select ? select(r.data) : r.data;
      },
      staleTime: STALE_MS,
      retry:     1,
    })),
  });

  const results = {};
  const errors  = {};
  const loading = queryResults.some(r => r.isPending);

  queries.forEach(({ key }, i) => {
    results[key] = queryResults[i].data ?? null;
    if (queryResults[i].error) {
      errors[key] = extractError(queryResults[i].error);
    }
  });

  return { results, loading, errors };
}
