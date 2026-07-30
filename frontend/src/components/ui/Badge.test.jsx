import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from './Badge';

describe('<Badge>', () => {
  it('rend son contenu', () => {
    render(<Badge tone="success">Actif</Badge>);
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('applique la classe du tône demandé', () => {
    const { container } = render(<Badge tone="danger">Erreur</Badge>);
    expect(container.firstChild.className).toMatch(/text-danger/);
  });

  it('accepte une classe personnalisée (tone custom)', () => {
    const { container } = render(<Badge tone="custom" className="bg-purple-100">X</Badge>);
    expect(container.firstChild.className).toMatch(/bg-purple-100/);
  });
});
