// Chef de mission : une fiche du dictionnaire Personnel, avec création à la
// volée. value / onChange portent l'id de fiche, en chaîne ('' = aucun chef).

import { useState } from 'react';
import { User, UserPlus } from 'lucide-react';
import FormField from '../FormField';
import AjoutPersonnelModal from './AjoutPersonnelModal';
import { useT } from '../../lib/i18n';

const libellePersonne = (p, t) =>
  [p.nom, p.fonction].filter(Boolean).join(' — ') + (p.actif === false ? t('personnel.inactiveSuffix') : '');

export default function ChefMissionSelect({ value, onChange, annuaire, label, error }) {
  const t = useT();
  const [ajout, setAjout] = useState(false);
  const { actifs, parId, equipes, refetch } = annuaire;

  // Le chef actuel reste dans la liste même désactivé : sans lui, le select
  // afficherait « — Sélectionner — » alors que la mission a bien un chef.
  const courant = value ? parId.get(parseInt(value)) : null;
  const choix = courant && !courant.actif ? [...actifs, courant] : actifs;
  const options = choix.map((p) => ({ value: String(p.id), label: libellePersonne(p, t) }));

  return (
    <div className="space-y-1.5">
      {/* min-h : même hauteur d'en-tête que AgentMultiSelect, posé à côté. */}
      <div className="flex items-center justify-between gap-2 min-h-[28px]">
        <p className="text-xs font-semibold text-fg-muted tracking-wide flex items-center gap-1.5">
          <User size={12} /> {label ?? t('personnel.chefLabel')}
        </p>
        <button
          type="button" onClick={() => setAjout(true)}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded-lg min-h-[44px] md:min-h-0"
        >
          <UserPlus size={12} /> {t('personnel.addPerson')}
        </button>
      </div>
      <FormField
        name="chefMissionId" type="select" value={value ?? ''} options={options} error={error}
        onChange={(e) => onChange(e.target.value)}
      />
      {ajout && (
        <AjoutPersonnelModal
          equipes={equipes}
          onClose={() => setAjout(false)}
          onCreated={async (item) => {
            setAjout(false);
            await refetch();
            onChange(String(item.id));
          }}
        />
      )}
    </div>
  );
}
