// Regroupement des rechargements déclenchés par le flux SSE.
//
// Le hook a deux comportements qui se contredisent en apparence — attendre une
// pause, mais ne jamais attendre trop longtemps — et c'est justement leur
// interaction qui compte : sur un écran de surveillance, un debounce nu
// échangerait un excès de requêtes contre un affichage qui ment pendant toute
// la durée d'une activité soutenue. Les tests du second bloc portent là-dessus.

import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useAppelTemporise } from './useAppelTemporise';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const avancer = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe('Regroupement', () => {
  it('n’appelle rien avant la fin du délai', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useAppelTemporise(fn, { delai: 800 }));

    act(() => result.current());
    avancer(799);

    expect(fn).not.toHaveBeenCalled();
  });

  it('appelle une seule fois après une rafale', () => {
    // Le cœur du correctif : 50 saisies successives déclenchaient 50
    // rechargements, chacun valant une quinzaine de requêtes Prisma.
    const fn = vi.fn();
    const { result } = renderHook(() => useAppelTemporise(fn, { delai: 800, maxAttente: 4000 }));

    for (let i = 0; i < 50; i++) {
      act(() => result.current());
      avancer(50);          // 50 événements espacés de 50 ms : 2 500 ms au total
    }
    avancer(800);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rouvre une fenêtre pour une rafale ultérieure', () => {
    // Sans remise à zéro de l'origine, la deuxième rafale hériterait du
    // plafond déjà consommé par la première et partirait immédiatement.
    const fn = vi.fn();
    const { result } = renderHook(() => useAppelTemporise(fn, { delai: 800, maxAttente: 4000 }));

    act(() => result.current());
    avancer(800);
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => result.current());
    avancer(799);
    expect(fn).toHaveBeenCalledTimes(1);   // pas encore
    avancer(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('Plafond d’attente', () => {
  it('appelle malgré une activité continue', () => {
    // Le cas que le debounce nu rate : des événements plus rapprochés que
    // `delai` repoussent l'appel indéfiniment. Ici on en émet un toutes les
    // 100 ms sans discontinuer — l'écran doit tout de même se rafraîchir.
    const fn = vi.fn();
    const { result } = renderHook(() => useAppelTemporise(fn, { delai: 800, maxAttente: 4000 }));

    for (let i = 0; i < 60; i++) {      // 6 000 ms d'activité ininterrompue
      act(() => result.current());
      avancer(100);
    }

    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('n’appelle pas avant le plafond', () => {
    // Contre-épreuve du test précédent : un hook qui appellerait à chaque
    // événement le satisferait aussi. On borne donc par le haut.
    const fn = vi.fn();
    const { result } = renderHook(() => useAppelTemporise(fn, { delai: 800, maxAttente: 4000 }));

    for (let i = 0; i < 30; i++) {      // 3 000 ms, sous le plafond
      act(() => result.current());
      avancer(100);
    }

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('Cycle de vie', () => {
  it('utilise la dernière version de la fonction', () => {
    // `fn` est recréé à chaque rendu par l'appelant. Sans la ref, on
    // appellerait la fermeture du premier rendu, avec ses variables périmées.
    const ancienne = vi.fn();
    const nouvelle = vi.fn();
    const { result, rerender } = renderHook(({ f }) => useAppelTemporise(f, { delai: 800 }), {
      initialProps: { f: ancienne },
    });

    act(() => result.current());
    rerender({ f: nouvelle });
    avancer(800);

    expect(ancienne).not.toHaveBeenCalled();
    expect(nouvelle).toHaveBeenCalledTimes(1);
  });

  it('n’appelle pas après démontage', () => {
    // Un minuteur encore armé déclencherait un setState dans le vide.
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useAppelTemporise(fn, { delai: 800 }));

    act(() => result.current());
    unmount();
    avancer(2000);

    expect(fn).not.toHaveBeenCalled();
  });
});
