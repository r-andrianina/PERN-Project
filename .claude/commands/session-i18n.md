# /session-i18n — Ajouter/maintenir la traduction FR/EN d'une page ou d'un composant

## Contexte

L'app est bilingue FR/EN. Tout le texte UI frontend passe par `frontend/src/lib/i18n.js`.
Les 83 fichiers pages/composants existants sont déjà traduits (audit complet 2026-07-30).
Cette commande sert à onboarder rapidement une session sur les conventions du projet
pour traduire un nouveau fichier ou étendre un fichier existant, sans redériver les règles.

**Hors périmètre** : les messages venant du backend (erreurs Zod, réponses API) restent
en français — seul le texte statique frontend (labels, boutons, titres, placeholders) est traduit.

## Architecture

- `frontend/src/lib/i18n.js` — dictionnaire unique `translations.fr.*` / `translations.en.*`,
  organisé par namespace (en général un namespace par page : `hotesPage`, `laboPage`,
  `nouvelleManip`, etc.), plus des namespaces **partagés** à réutiliser avant d'en créer un nouveau :
  - `common.*` — mots génériques (Nom, Description, Annuler, Enregistrer, Chargement…)
  - `specimenTypes.*` — Moustique/Tique/Puce/Autre spécimen
  - `sexe.*` — M/F/inconnu
  - `roles.*` — label + description par rôle (consommé via `lib/roles.js`)
  - `specimenList.*` / `specimenDetail.*` / `nouveauSpecimen.*` — pages spécimens (list/detail/create)
- `useT()` — hook React, à appeler dans le corps du composant : `const t = useT();`
- `t(key, lang)` — version standalone hors composant (modules, helpers)
- `interpolate(str, vars)` — remplace `{placeholder}` dans une chaîne déjà traduite :
  `interpolate(t('hotesPage.subtitle'), { n: hotes.length })`
- `frontend/src/store/languageStore.js` — Zustand, persiste `lang` dans `localStorage` (`sm_lang`),
  défaut `'en'`

## Checklist pour wire un fichier

1. Lire le fichier en entier, lister toutes les chaînes FR codées en dur (JSX, `title=`, `placeholder=`,
   messages toast/dialog, options de `<Select>`, colonnes de `<DataTable>`).
2. Vérifier si une chaîne identique existe déjà dans un namespace partagé (`common`, `specimenTypes`,
   `sexe`, `roles`, `specimenList`) avant d'ajouter une clé — éviter la duplication.
3. Ajouter les nouvelles clés dans **les deux blocs** `fr` et `en` de `i18n.js`, aux mêmes emplacements
   relatifs (un namespace = un bloc contigu dans chaque langue).
4. Importer `useT` (et `interpolate` si besoin d'un placeholder) : `import { useT, interpolate } from '../../lib/i18n';`
   — ajuster le chemin relatif selon la profondeur du fichier.
5. Ajouter `const t = useT();` en tête du composant.
6. **Piège n°1 — collision de nom** : si le fichier utilise déjà `t` comme variable
   (boucle `.map(t => ...)`, `setTimeout` handle, variable de donnée), renommer la variable existante
   (`tx`, `tax`, `tp`, `tid`, etc.) plutôt que le hook.
7. **Piège n°2 — objets/tableaux au niveau module** : un `const OPTIONS = [...]` défini hors composant
   ne peut pas appeler `useT()`. Le transformer en fonction `getOptions(t)` appelée à l'intérieur du
   composant, ou en `const getX = (t) => ({...})` si plusieurs composants le partagent.
8. **Piège n°3 — texte stylé inline** (`<strong>mot</strong>` au milieu d'une phrase) : ne jamais utiliser
   `dangerouslySetInnerHTML`. Découper la phrase en clés `xxxPrefix` / `xxxWord` / `xxxSuffix` rendues
   comme enfants JSX séparés.
9. **Piège n°4 — locale des dates** : remplacer `toLocaleDateString('fr-FR')` par
   `toLocaleDateString(t('common.locale'))` (idem `toLocaleString`).
10. **Ce qu'on NE traduit PAS** : jargon entomologique spécialisé sans traduction évidente
    (ex. parité "Nulle"/"Multi"), noms de colonnes Excel littérales (SERIES, WHAT_3_WORDS…),
    noms de modèles/enums bruts venant du backend affichés tels quels, exemples scientifiques
    en latin (`Anopheles gambiae`).

## Commande de vérification

```bash
cd frontend
npx eslint <fichier(s) modifiés> src/lib/i18n.js
npm run build
```

Puis, si un serveur dev tourne, vérifier visuellement en EN (`localStorage.sm_lang = 'en'` ou
toggle langue dans l'UI) qu'aucun texte FR ne subsiste — attention en particulier aux valeurs
par défaut des props (`label = 'Chargement…'`) dans les composants partagés `components/ui/*`,
qui peuvent fuiter silencieusement sur des pages jamais auditées directement.
