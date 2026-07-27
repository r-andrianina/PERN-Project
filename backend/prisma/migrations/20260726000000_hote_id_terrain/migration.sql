-- Identifiant terrain pour les hôtes — format HOTE_<AAAAMM>_<n>, compteur
-- global par mois (indépendant de la localité, contrairement aux spécimens).
ALTER TABLE "hotes" ADD COLUMN "id_terrain" VARCHAR(50);
CREATE UNIQUE INDEX "hotes_id_terrain_key" ON "hotes"("id_terrain");
