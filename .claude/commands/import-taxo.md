# /import-taxo — Importer le dictionnaire taxonomique des spécimens

Importe les taxonomies moustique / tique / puce depuis le fichier Excel
`fichiers/Dico_Taxo.xlsx` dans la table `taxonomie_specimens`.

## Pré-requis

- Le container Docker doit tourner sur le port 5435
- Le fichier `fichiers/Dico_Taxo.xlsx` doit exister à la racine du projet

## Commande

```bash
! node backend/scripts/import-taxo.js
```

Chemin personnalisé :
```bash
! node backend/scripts/import-taxo.js chemin/vers/fichier.xlsx
```

## Durée estimée

~2–4 minutes (5 595 lignes VAL × 7 niveaux max, avec cache).

## Ce qui est importé

Seules les entrées `statut_taxonomique = VAL` sont retenues.
Mapping des types :

| Ordre / Famille | Type dans l'app |
|---|---|
| Diptera / Culicidae | `moustique` |
| Ixodida (Ixodidae, Argasidae…) | `tique` |
| Siphonaptera (toutes familles) | `puce` |

Les autres ordres (Tabanidae, Ceratopogonidae, Scorpionida…) sont ignorés.

## Structure hiérarchique créée

```
ordre → famille → [sous_famille] → genre → [sous_genre] → espece → [sous_espece]
```

Les niveaux marqués `sp` ou `N/A` dans le fichier sont sautés.
Le champ `type` est propagé sur **tous** les niveaux de la hiérarchie
(requis par le filtre `?type=moustique` des formulaires de saisie).

## Résultat attendu (Dico_Taxo.xlsx 2025-05-07)

| Type | Nœuds |
|---|---|
| moustique | ~3 996 (52 genres, 3 656 espèces) |
| tique | ~896 (20 genres, 852 espèces) |
| puce | ~1 013 (169 genres, 680 espèces) |

## Idempotent

Le script pré-charge le cache depuis la base avant de démarrer.
Un nœud déjà existant (même niveau + nom + parent) n'est jamais recréé.
Peut être relancé sans risque après une interruption.
