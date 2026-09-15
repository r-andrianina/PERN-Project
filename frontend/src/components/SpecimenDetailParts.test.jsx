import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, SidebarRow, SidebarSection, EditSelect } from './SpecimenDetailParts';

// Ces composants étaient recopiés dans les quatre pages de détail et avaient
// déjà divergé. En les rassemblant, on a dû trancher entre deux variantes —
// les tests ci-dessous figent le choix retenu, pour qu'une future
// réintroduction de l'ancienne version ne passe pas inaperçue.

describe('<Field>', () => {
  it('affiche sa valeur', () => {
    render(<Field label="Sexe">Femelle</Field>);
    expect(screen.getByText('Femelle')).toBeInTheDocument();
    expect(screen.getByText('Sexe')).toBeInTheDocument();
  });

  it('affiche un tiret quand la valeur est vide', () => {
    // Variante retenue (celle d'AutreSpecimenDetail) : une case vide ressemble
    // à un affichage cassé, un tiret dit « connu comme non renseigné ».
    render(<Field label="Parité">{null}</Field>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('traite la chaîne vide comme une absence de valeur', () => {
    render(<Field label="Notes">{''}</Field>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('double le tiret d\'un texte lisible par un lecteur d\'écran', () => {
    // Le tiret seul est restitué de façon incohérente par les lecteurs
    // d'écran : sans ce doublage, un utilisateur non voyant peut croire que
    // le champ n'existe pas.
    const { container } = render(<Field label="Parité">{null}</Field>);

    expect(screen.getByText('—')).toHaveAttribute('aria-hidden', 'true');

    const pourLecteur = container.querySelector('.sr-only');
    expect(pourLecteur).not.toBeNull();
    // On n'affirme pas une traduction précise — la langue dépend du store, et
    // figer la chaîne rendrait le test cassant. Ce qui compte : le texte existe
    // et la clé i18n a bien été RÉSOLUE (une clé manquante se rend elle-même).
    expect(pourLecteur.textContent.trim()).not.toBe('');
    expect(pourLecteur.textContent).not.toContain('common.notSet');
  });
});

describe('<SidebarRow>', () => {
  it('affiche son libellé et sa valeur', () => {
    render(<SidebarRow label="Mission">OM-2026-001</SidebarRow>);
    expect(screen.getByText('Mission')).toBeInTheDocument();
    expect(screen.getByText('OM-2026-001')).toBeInTheDocument();
  });

  it('affiche un tiret quand la valeur est vide', () => {
    render(<SidebarRow label="Localité">{undefined}</SidebarRow>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('<SidebarSection>', () => {
  it('affiche son titre et son contenu', () => {
    render(<SidebarSection label="Collecte"><p>contenu</p></SidebarSection>);
    expect(screen.getByText('Collecte')).toBeInTheDocument();
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('fonctionne sans icône', () => {
    // `icon` est optionnel : AutreSpecimenDetail n'en passe pas.
    expect(() => render(<SidebarSection label="Sans icône">x</SidebarSection>)).not.toThrow();
  });
});

describe('<EditSelect>', () => {
  it('affiche son libellé', () => {
    render(<EditSelect label="Stade" value="" onChange={vi.fn()} options={[]} />);
    expect(screen.getByText('Stade')).toBeInTheDocument();
  });

  it('accepte disabled', () => {
    // La variante de PuceDetail ignorait ce paramètre EN SILENCE : le passer
    // n'avait aucun effet. La version unifiée doit le transmettre.
    const { container } = render(
      <EditSelect label="Parité" value="" onChange={vi.fn()} options={[]} disabled />,
    );
    expect(container.querySelector('[disabled], [aria-disabled="true"], .opacity-50')).not.toBeNull();
  });
});
