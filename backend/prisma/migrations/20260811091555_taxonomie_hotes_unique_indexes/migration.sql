-- Filet de sécurité base contre les doublons de taxonomie hôtes — même
-- protection que taxonomie_specimens (voir migration
-- ..._taxonomie_specimens_unique_indexes), sans colonne "type" (TaxonomieHote
-- n'en a pas).

-- Niveaux "globalement uniques" : un nom (insensible à la casse) unique sur
-- tout l'arbre — empêche p.ex. deux genres "Rattus" sous des parents différents.
CREATE UNIQUE INDEX "taxonomie_hotes_global_unique_idx"
  ON "taxonomie_hotes" ("niveau", lower("nom"))
  WHERE "niveau" IN ('ordre', 'famille', 'sous_famille', 'genre', 'sous_genre');

-- espece / sous_espece : unicité par parent seulement (nomenclature binomiale).
CREATE UNIQUE INDEX "taxonomie_hotes_leaf_unique_idx"
  ON "taxonomie_hotes" ("niveau", lower("nom"), "parent_id")
  WHERE "niveau" IN ('espece', 'sous_espece');
