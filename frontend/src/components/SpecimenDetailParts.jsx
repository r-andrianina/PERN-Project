// Briques d'affichage communes aux pages de détail des spécimens
// (moustique, tique, puce, autre spécimen).
//
// Ces quatre composants étaient recopiés dans chaque page, et avaient DÉJÀ
// divergé — c'est la raison d'être de ce fichier :
//
//   • `Field` et `SidebarRow` : AutreSpecimenDetail affichait un tiret « — »
//     pour une valeur vide, les trois autres laissaient un blanc. La version
//     avec tiret est retenue ici : une case vide ressemble à un affichage
//     cassé, un tiret dit « renseigné comme inconnu ». Les pages moustique,
//     tique et puce gagnent donc ce repère.
//   • `EditSelect` : la variante de PuceDetail n'acceptait pas `disabled` —
//     le passer n'avait aucun effet, en silence. La version complète est
//     retenue ; ne rien passer se comporte exactement comme avant.

import { Select } from './ui';
import { useT } from '../lib/i18n';

/**
 * Marque d'absence de valeur.
 *
 * Le tiret cadratin est la convention des tableaux de données scientifiques :
 * il dit « ce champ existe et n'a pas de valeur » sans prétendre expliquer
 * pourquoi. « N/A » a été écarté parce qu'il AFFIRME une inapplicabilité :
 * dans ces fiches, un champ vide signifie presque toujours « non renseigné »,
 * pas « sans objet » — la parité, par exemple, ne concerne réellement que les
 * femelles, mais les notes vides ne sont « sans objet » pour personne. Le
 * tiret a aussi l'avantage d'être neutre linguistiquement, sur une interface
 * bilingue.
 *
 * Accessibilité : le tiret seul est restitué de façon incohérente par les
 * lecteurs d'écran (tantôt « tiret cadratin », tantôt rien) — un utilisateur
 * non voyant pourrait croire que le champ n'existe pas. On le masque donc aux
 * technologies d'assistance et on leur donne un texte explicite à la place.
 */
function ValeurAbsente() {
  const t = useT();
  return (
    <span className="text-fg-subtle">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t('common.notSet')}</span>
    </span>
  );
}

/** Libellé au-dessus d'une valeur, dans le corps de la fiche. */
export function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium mb-0.5">{label}</p>
      <div className="text-sm text-fg">{children || <ValeurAbsente />}</div>
    </div>
  );
}

/** Ligne libellé / valeur de la colonne latérale. */
export function SidebarRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-[11px] text-fg-subtle shrink-0">{label}</span>
      <span className="text-[11px] text-fg font-medium text-right leading-relaxed">
        {children || <ValeurAbsente />}
      </span>
    </div>
  );
}

/** Groupe titré de la colonne latérale, avec une icône optionnelle. */
export function SidebarSection({ icon: Icon, iconClass, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon size={12} className={iconClass ?? 'text-fg-subtle'} />}
        <p className="text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">{label}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Liste déroulante du mode édition.
 *
 * `onChange` reçoit un évènement synthétique `{ target: { value } }` : les
 * pages appelantes branchent dessus les mêmes gestionnaires que pour un
 * `<input>` natif.
 */
export function EditSelect({ label, value, onChange, options, disabled }) {
  return (
    <div>
      <label className="text-xs text-fg-subtle font-medium block mb-1">{label}</label>
      <Select
        value={value}
        onChange={(val) => onChange({ target: { value: val } })}
        disabled={disabled}
        options={options}
      />
    </div>
  );
}
