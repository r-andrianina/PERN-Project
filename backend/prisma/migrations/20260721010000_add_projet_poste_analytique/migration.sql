-- Ajout du poste analytique (référence budgétaire) sur les projets
ALTER TABLE "projets" ADD COLUMN IF NOT EXISTS "poste_analytique" VARCHAR(150);
