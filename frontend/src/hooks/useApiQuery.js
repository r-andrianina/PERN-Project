// useApiQuery — fetch + loading + data + refetch pour les listes.
//
// Usage :
//   const { data, loading, refetch } = useApiQuery('/projets');
//   const projets = data?.projets ?? [];
//
// Avec params dynamiques :
//   const { data, loading, refetch } = useApiQuery('/moustiques', { params: { methodeId: id } });
//
// Désactiver le fetch automatique :
//   const { data, refetch } = useApiQuery('/users', { immediate: false });
//   useEffect(() => { if (id) refetch({ params: { missionId: id } }); }, [id]);

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

/**
 * @param {string} url            Endpoint relatif (ex: '/projets')
 * @param {object} [opts]
 * @param {object}   [opts.params]     Paramètres de requête par défaut
 * @param {Array}    [opts.deps]       Dépendances supplémentaires pour le refetch auto
 * @param {boolean}  [opts.immediate]  Lancer le fetch au montage (défaut: true)
 * @param {function} [opts.select]     Transformer la réponse (ex: r => r.projets)
 */
export function useApiQuery(url, { params, deps = [], immediate = true, select } = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError]     = useState(null);

  // Strict Mode React 19 monte le composant deux fois (cleanup + remount).
  // On initialise à false et on le met à true DANS l'effet pour garantir
  // qu'il est correctement réinitialisé à chaque (re)mount.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetch = useCallback(async (overrideOpts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(url, { params: overrideOpts.params ?? params });
      if (!mountedRef.current) return null;
      const result = select ? select(r.data) : r.data;
      setData(result);
      return result;
    } catch (err) {
      if (!mountedRef.current) return null;
      const msg = err.response?.data?.error || 'Erreur de chargement';
      setError(msg);
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(params), ...deps]);

  useEffect(() => {
    if (immediate) fetch();
  }, [fetch, immediate]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Variante multi-requêtes en parallèle.
 *
 * Usage :
 *   const { results, loading } = useApiQueries([
 *     { url: '/projets', key: 'projets', select: r => r.projets },
 *     { url: '/users',   key: 'users',   select: r => r.actifs },
 *   ]);
 *   const { projets, users } = results;
 */
export function useApiQueries(queries) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors,  setErrors]  = useState({});

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const settled = await Promise.allSettled(
        queries.map(({ url, params, select }) =>
          api.get(url, { params }).then((r) => (select ? select(r.data) : r.data))
        )
      );
      if (!mounted) return;
      const nextResults = {};
      const nextErrors  = {};
      settled.forEach((s, i) => {
        const { key } = queries[i];
        if (s.status === 'fulfilled') nextResults[key] = s.value;
        else nextErrors[key] = s.reason?.response?.data?.error || 'Erreur';
      });
      setResults(nextResults);
      setErrors(nextErrors);
      setLoading(false);
    };
    run();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { results, loading, errors };
}
