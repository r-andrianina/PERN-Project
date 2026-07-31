# /session-i18n-audit — Auditer et faire évoluer le système de traduction FR/EN

## Contexte

Complément de `/session-i18n` (qui documente comment wire une page donnée). Cette commande
couvre la **gouvernance** du système : vérifier l'intégrité du dictionnaire, les conventions
à respecter dans le temps, comment étendre le système à une langue supplémentaire, et comment
repérer une régression avant qu'elle parte en revue.

## 1. Script d'audit — `npm run i18n:audit`

`frontend/scripts/audit-i18n.js` extrait l'objet `translations` de `lib/i18n.js` (parsing du
texte source, pas d'import du module — évite d'exécuter `languageStore.js` et ses effets de
bord `localStorage` hors navigateur) et vérifie :

- **Missing in EN / Missing in FR** — clé présente dans une langue, absente de l'autre.
  Un seul de ces deux doit rester à 0 en permanence ; sinon `useT()` retournera la clé brute
  (`"hotesPage.title"`) au lieu du texte pour les utilisateurs de la langue manquante.
- **Placeholder mismatch** — les `{variables}` d'interpolation diffèrent entre `fr` et `en`
  pour une même clé (ex. `{n}` présent en fr mais oublié en en) → `interpolate()` laissera le
  literal `{n}` affiché tel quel.
- **Array length/type mismatch** — clés dont la valeur est un tableau (ex.
  `datepicker.weekdays`, 7 entrées attendues) avec une forme différente entre les deux langues.
- **Possibly untranslated** (avertissement, non bloquant) — valeur strictement identique dans
  les deux langues. Beaucoup de faux positifs attendus et normaux : cognats
  (`Mission`, `Container`, `Solution`, `Description`, `Notifications`), mots malgaches
  (`Fokontany`), noms scientifiques latins, unités courtes (`(%)`, `(pb)`), noms propres/codes.
  Passer en revue seulement les entrées qui ressemblent à une vraie phrase FR non traduite.

Exit code 1 uniquement sur les 3 premières catégories (problèmes structurels) ; le 4e est
informatif. Lancer après toute modification de `i18n.js`, et périodiquement en maintenance.

```bash
cd frontend
npm run i18n:audit
```

## 2. Convention de nommage & structure

- Un **namespace par page** en général (`hotesPage`, `laboPage`, `nouvelleManip`…) ; les
  sous-composants d'une même page peuvent réutiliser le namespace du parent.
- **Namespaces partagés** à réutiliser avant de dupliquer une clé : `common.*`,
  `specimenTypes.*`, `sexe.*`, `roles.*` (consommé via `lib/roles.js`, pas directement),
  `specimenList.*` / `specimenDetail.*` / `nouveauSpecimen.*`.
- Préfixes de clé courants : `col*` (colonne de tableau), `section*` (titre de section
  repliable), `type*` (libellé d'un type énuméré), `*Placeholder`, `*Hint`.
- Interpolation : `{n}`, `{nom}`, `{label}` — toujours `interpolate(t('ns.key'), { n: value })`,
  jamais de template string manuelle qui casserait si la position du mot change entre langues.
- Les deux blocs `translations.fr` et `translations.en` doivent rester **structurellement
  identiques** (mêmes namespaces, mêmes clés, dans le même ordre si possible, pour que les
  diffs de revue soient lisibles côte à côte).
- Ce qu'on ne traduit **jamais** : messages venant du backend (Zod, réponses API), jargon
  entomologique spécialisé sans traduction évidente (parité "Nulle"/"Paucie"/"Multi"), noms de
  colonnes Excel littérales (SERIES, WHAT_3_WORDS…), enums bruts backend affichés tels quels,
  noms scientifiques latins.

## 3. Ajouter une 3e langue (ex. malgache)

Le système est actuellement figé à `fr`/`en` à plusieurs endroits — les toucher tous :

1. `frontend/src/store/languageStore.js` — ajouter le code dans `VALID_LANGS` (ex. `'mg'`).
   Le défaut actuel (`'en'` si rien en `localStorage`) reste à décider.
2. `frontend/src/lib/i18n.js` — ajouter un bloc `translations.mg = { ...mêmes namespaces... }`.
   `useT()`/`t()` retombent déjà sur `translations[lang] ?? translations.en` donc rien d'autre
   à changer côté hook, mais **toutes** les clés doivent exister dans le nouveau bloc (lancer
   `npm run i18n:audit` — actuellement bilingue, il faudrait l'étendre à un audit multi-langue
   à N blocs si ce chantier démarre).
3. `common.locale` — ajouter la valeur `Intl`/`toLocaleDateString` correspondante (ex. `'mg-MG'`
   si supporté, sinon fallback `'fr-FR'`).
4. `frontend/src/components/layout/Footer.jsx` — le sélecteur de langue est codé en dur pour
   2 boutons fr/en (`onClick={() => setLang('fr')}` / `'en'`) ; il faudra soit ajouter un 3e
   bouton, soit passer à un `<Select>` si plus de 2-3 langues sont prévues.
5. `frontend/src/lib/roles.js` — `roleLabel`/`roleDescription` lisent `translations[lang]` via
   le même mécanisme, rien à changer si l'étape 2 est complète.

## 4. Garde-fou anti-régression (avant une revue)

Repère du texte FR probable codé en dur dans un fichier qui vient d'être touché (accents ou
`…`), hors `i18n.js` lui-même :

```bash
cd frontend
grep -nE "[À-ÿ]|…" src/pages/<fichier-modifié>.jsx | grep -v "^\s*//"
```

Un résultat n'est pas automatiquement une erreur (commentaires de code, valeurs de `format`
Excel, exemples scientifiques) — mais toute chaîne qui ressemble à un label/placeholder/message
utilisateur doit passer par `t('...')`.
