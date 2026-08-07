-- Filet de sécurité base contre les doublons de taxonomie (double la règle
-- applicative checkDuplicate / GLOBAL_UNIQUE_LEVELS, incident réel de 2026-07).
-- Index PARTIELS + FONCTIONNELS (lower(nom)) : non exprimables dans le schéma
-- Prisma, donc invisibles à `prisma migrate diff` — pas de faux drift.

-- Niveaux "globalement uniques" : un nom (insensible à la casse) unique par
-- (niveau, type) sur tout l'arbre — empêche p.ex. deux genres "Anopheles".
CREATE UNIQUE INDEX "taxonomie_specimens_global_unique_idx"
  ON "taxonomie_specimens" ("niveau", lower("nom"), "type")
  WHERE "niveau" IN ('ordre', 'famille', 'sous_famille', 'genre', 'sous_genre');

-- espece / sous_espece : unicité par parent seulement (un même épithète peut
-- légitimement se répéter d'un genre à l'autre — nomenclature binomiale).
CREATE UNIQUE INDEX "taxonomie_specimens_leaf_unique_idx"
  ON "taxonomie_specimens" ("niveau", lower("nom"), "parent_id")
  WHERE "niveau" IN ('espece', 'sous_espece');
