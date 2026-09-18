// PageHeader — en-tête de page standard : icône + titre + sous-titre + actions à droite.
//
// Usage :
//   <PageHeader
//     icon={Bug} iconTone="specimen-moustique"
//     title="Moustiques" subtitle="42 spécimens enregistrés"
//     actions={<><Button variant="secondary">Export</Button><Button>+ Ajouter</Button></>}
//   />

const ICON_TONES = {
  primary: 'bg-primary/10 text-primary',
  default: 'bg-surface-3 text-fg-muted',
  info:    'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger:  'bg-danger/10 text-danger',
  'specimen-moustique': 'bg-specimen-moustique/10 text-specimen-moustique',
  'specimen-tique':     'bg-specimen-tique/10 text-specimen-tique',
  'specimen-puce':      'bg-specimen-puce/10 text-specimen-puce',
};

export default function PageHeader({
  icon: Icon, iconTone = 'primary',
  title, subtitle, actions, breadcrumb, className = '',
}) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {breadcrumb && <div className="-mb-1">{breadcrumb}</div>}
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ICON_TONES[iconTone] ?? ICON_TONES.primary}`}>
            <Icon size={18} />
          </div>
        )}
        {/*
          `pr-0.5` sur le titre : `truncate` pose `overflow: hidden`, qui coupe
          au bord de la boîte de contenu. Or un glyphe ITALIQUE dépasse sa
          largeur d'avance — son encre penche au-delà. Sans ce demi-pixel de
          marge, la dernière lettre d'un titre en italique était rognée, alors
          que le texte tenait : on lisait « Aedes aegypt| » sur les quatre
          fiches de détail des spécimens, dont le titre est le nom scientifique
          en italique (corrigé le 2026-09-18, vu à l'écran).

          La troncature des titres réellement trop longs continue de
          fonctionner, l'ellipse apparaît simplement deux pixels plus tôt.
        */}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-fg truncate pr-0.5">{title}</h1>
          {subtitle && <p className="text-xs text-fg-subtle mt-0.5 truncate pr-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
