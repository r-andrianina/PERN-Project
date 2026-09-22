// Abonnements au flux SSE partagé.
//
// Le hook remplace trois `EventSource` indépendants par des abonnements à un
// flux unique. Ce qui doit être prouvé ici n'est donc pas « ça reçoit », mais
// que le partage ne perd rien au passage : plusieurs abonnés au même
// événement, un désabonnement propre au démontage, et surtout la lecture du
// handler à l'émission — c'est elle qui permet aux consommateurs de se passer
// de `useCallback`, et sa perte redonnerait silencieusement des données
// périmées.

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SseContext } from './sseContext';
import { useSse, useSseEtat } from './sseHooks';

/** Un faux fournisseur : même forme de valeur, sans réseau. */
function fabriquerProvider(etat = 'connected') {
  const abonnes = { current: new Map() };
  // `abonnes` est cree une fois par appel a cette fabrique : il est deja
  // stable entre les rendus, sans avoir besoin d'une ref.
  const wrapper = ({ children }) => (
    <SseContext.Provider value={{ etat, abonnes }}>{children}</SseContext.Provider>
  );
  const emettre = (nom, data) => act(() => {
    const set = abonnes.current.get(nom);
    if (set) for (const h of [...set]) h({ data });
  });
  return { wrapper, emettre, abonnes };
}

describe('Abonnement', () => {
  it('reçoit l’événement auquel il s’abonne', () => {
    const { wrapper, emettre } = fabriquerProvider();
    const fn = vi.fn();
    renderHook(() => useSse('new_activity', fn), { wrapper });

    emettre('new_activity', 'x');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignore les autres événements', () => {
    // Contre-épreuve : un relais qui diffuserait tout à tout le monde
    // passerait le test précédent sans rien prouver.
    const { wrapper, emettre } = fabriquerProvider();
    const fn = vi.fn();
    renderHook(() => useSse('new_activity', fn), { wrapper });

    emettre('presence_update', 'x');

    expect(fn).not.toHaveBeenCalled();
  });

  it('sert plusieurs abonnés au même événement', () => {
    // Le cœur du partage : la cloche et la page écoutent tous deux
    // `new_activity`. Avant, chacun avait sa connexion ; maintenant les deux
    // doivent être servis par une seule.
    const { wrapper, emettre } = fabriquerProvider();
    const cloche = vi.fn();
    const page   = vi.fn();
    renderHook(() => { useSse('new_activity', cloche); useSse('new_activity', page); }, { wrapper });

    emettre('new_activity', 'x');

    expect(cloche).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('transmet la charge utile', () => {
    const { wrapper, emettre } = fabriquerProvider();
    const fn = vi.fn();
    renderHook(() => useSse('init', fn), { wrapper });

    emettre('init', JSON.stringify({ unreadCount: 7 }));

    expect(JSON.parse(fn.mock.calls[0][0].data).unreadCount).toBe(7);
  });
});

describe('Cycle de vie', () => {
  it('appelle la dernière version du handler', () => {
    // La raison d'être de la ref. Sans elle, un consommateur qui oublie
    // `useCallback` verrait son handler figé sur le premier rendu — des
    // données périmées, sans aucun signal.
    const { wrapper, emettre } = fabriquerProvider();
    const ancienne = vi.fn();
    const nouvelle = vi.fn();
    const { rerender } = renderHook(({ f }) => useSse('new_activity', f), {
      wrapper, initialProps: { f: ancienne },
    });

    rerender({ f: nouvelle });
    emettre('new_activity', 'x');

    expect(ancienne).not.toHaveBeenCalled();
    expect(nouvelle).toHaveBeenCalledTimes(1);
  });

  it('se désabonne au démontage', () => {
    // Un abonné oublié serait une fuite : le Set grossirait à chaque
    // navigation, et on appellerait des composants disparus.
    const { wrapper, emettre, abonnes } = fabriquerProvider();
    const fn = vi.fn();
    const { unmount } = renderHook(() => useSse('new_activity', fn), { wrapper });

    unmount();
    emettre('new_activity', 'x');

    expect(fn).not.toHaveBeenCalled();
    expect(abonnes.current.get('new_activity').size).toBe(0);
  });
});

describe('Hors fournisseur', () => {
  it('échoue bruyamment plutôt que de ne rien faire', () => {
    // Un abonnement muet donnerait un écran qui ne se rafraîchit jamais sans
    // rien signaler — le défaut même que ce chantier corrige ailleurs.
    expect(() => renderHook(() => useSse('new_activity', vi.fn())))
      .toThrow(/SseProvider/);
  });

  it('vaut aussi pour l’état de connexion', () => {
    expect(() => renderHook(() => useSseEtat())).toThrow(/SseProvider/);
  });
});

describe('État de connexion', () => {
  it('rend l’état porté par le fournisseur', () => {
    const { wrapper } = fabriquerProvider('offline');

    const { result } = renderHook(() => useSseEtat(), { wrapper });

    expect(result.current).toBe('offline');
  });
});
