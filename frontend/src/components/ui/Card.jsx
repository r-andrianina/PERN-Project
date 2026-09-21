// Card — surface élevée standard. Compose avec sa Header / Body / Footer optionnels.
//
// Usage :
//   <Card>...</Card>
//   <Card padding="sm" tone="muted">...</Card>
//   <Card level="secondary">...</Card>
//
// Props :
//   padding : 'none' | 'sm' | 'md' | 'lg'  — par défaut 'md' (p-6)
//   level   : 'primary' | 'secondary' — poids visuel (cf. ci-dessous)
//   tone    : 'default' | 'muted' | 'primary' — fond légèrement teinté
//   className : extension libre

const PAD = { none: 'p-0', sm: 'p-4', md: 'p-6', lg: 'p-8' };

/**
 * Poids visuel de la carte (ajouté le 2026-09-16).
 *
 * Toutes les cartes avaient exactement le même traitement : une fiche spécimen
 * en empile six ou sept, et rien dans le rendu ne disait lesquelles portent le
 * contenu et lesquelles portent le contexte. `padding` réglait la densité,
 * jamais l'importance.
 *
 * La différence est volontairement tenue à l'ombre portée, et pas au fond : les
 * jetons de surface ne se comportent pas pareil dans les deux thèmes —
 * `surface-2` est plus SOMBRE que `surface` en clair mais plus CLAIRE en
 * sombre, donc une carte « en retrait » par le fond ressortirait davantage en
 * thème sombre. L'ombre, elle, recule dans les deux.
 *
 * 'primary' est le défaut et reproduit exactement l'apparence historique : ce
 * changement n'altère aucun écran tant qu'on n'opte pas explicitement pour
 * 'secondary'.
 */
const LEVEL = { primary: 'shadow-card', secondary: 'shadow-none' };

const TONE = {
  default: '',
  muted:   'bg-surface-2',
  primary: 'bg-primary/5 border-primary/10',
};

export default function Card({ children, padding = 'md', level = 'primary', tone = 'default', className = '', ...rest }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface transition-colors ${LEVEL[level] ?? LEVEL.primary} ${PAD[padding]} ${TONE[tone]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`pb-4 mb-5 border-b border-border ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, icon: Icon, className = '' }) {
  return (
    <h2 className={`flex items-center gap-2.5 text-sm font-semibold text-fg ${className}`}>
      {Icon && <Icon size={17} className="text-primary" />}
      {children}
    </h2>
  );
}
