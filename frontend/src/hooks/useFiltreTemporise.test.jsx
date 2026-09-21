// Temporisation des champs texte de la recherche.
//
// Ce hook est plus délicat qu'il n'en a l'air : il synchronise dans les DEUX
// sens avec l'URL (la frappe l'écrit, le retour arrière la relit), ce qui est
// exactement la forme où l'on écrit une boucle infinie sans s'en rendre compte.
// Les deux derniers tests portent là-dessus.

import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useFiltreTemporise } from './useFiltreTemporise';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const avancer = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe('Saisie', () => {
  it('rend la valeur tapée immédiatement', () => {
    // La saisie ne doit jamais saccader : seul l'ENVOI est différé, pas
    // l'affichage. Un champ contrôlé qui attendrait l'URL sauterait à chaque
    // caractère.
    const { result } = renderHook(() => useFiltreTemporise('', vi.fn()));

    act(() => result.current[1]('Maro'));

    expect(result.current[0]).toBe('Maro');
  });

  it('n’applique rien avant la fin du délai', () => {
    const appliquer = vi.fn();
    const { result } = renderHook(() => useFiltreTemporise('', appliquer));

    act(() => result.current[1]('Maro'));
    avancer(349);

    expect(appliquer).not.toHaveBeenCalled();
  });

  it('applique une seule fois après une rafale de frappe', () => {
    // Le cœur du correctif : « Marofandilia » lançait treize recherches.
    const appliquer = vi.fn();
    const { result } = renderHook(() => useFiltreTemporise('', appliquer));

    for (const v of ['M', 'Ma', 'Mar', 'Maro', 'Marof']) {
      act(() => result.current[1](v));
      avancer(50);
    }
    avancer(350);

    expect(appliquer).toHaveBeenCalledTimes(1);
    expect(appliquer).toHaveBeenCalledWith('Marof');
  });

  it('applique l’effacement complet du champ', () => {
    // Vider un filtre est une action comme une autre — elle ne doit pas être
    // avalée sous prétexte que la valeur est vide.
    const appliquer = vi.fn();
    const { result } = renderHook(() => useFiltreTemporise('Maro', appliquer));

    act(() => result.current[1](''));
    avancer(350);

    expect(appliquer).toHaveBeenCalledWith('');
  });
});

describe('L’URL reste la source de vérité', () => {
  it('reprend la valeur venue d’ailleurs', () => {
    // Retour arrière du navigateur, ou bouton « réinitialiser ».
    const { result, rerender } = renderHook(
      ({ url }) => useFiltreTemporise(url, vi.fn()),
      { initialProps: { url: 'Maro' } },
    );

    rerender({ url: '' });

    expect(result.current[0]).toBe('');
  });

  it('traite une URL absente comme une chaîne vide', () => {
    const { result } = renderHook(() => useFiltreTemporise(undefined, vi.fn()));

    expect(result.current[0]).toBe('');
  });
});

describe('Pas de boucle', () => {
  it('n’applique rien quand l’URL rattrape la valeur tapée', () => {
    // Le cycle redouté : on applique → l'URL change → le hook resynchronise →
    // il réapplique → … Une fois l'URL alignée, plus aucun envoi ne doit partir.
    const appliquer = vi.fn();
    const { result, rerender } = renderHook(
      ({ url }) => useFiltreTemporise(url, appliquer),
      { initialProps: { url: '' } },
    );

    act(() => result.current[1]('Maro'));
    avancer(350);
    expect(appliquer).toHaveBeenCalledTimes(1);

    rerender({ url: 'Maro' });   // l'URL a pris la valeur
    avancer(2000);

    expect(appliquer).toHaveBeenCalledTimes(1);
  });

  it('n’applique rien quand rien n’est tapé', () => {
    const appliquer = vi.fn();
    const { rerender } = renderHook(
      ({ url }) => useFiltreTemporise(url, appliquer),
      { initialProps: { url: 'Maro' } },
    );

    rerender({ url: 'Maro' });
    avancer(2000);

    expect(appliquer).not.toHaveBeenCalled();
  });
});
