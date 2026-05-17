-- Migration : RBAC granulaire par rôle + permissions spécimens
-- 1. Renommage du rôle terrain → technicien
-- 2. Ajout de la colonne specimens_autorises sur les utilisateurs

-- ─── 1. Renommer terrain → technicien dans l'enum Role ────────────────────────

-- Créer le nouvel enum
CREATE TYPE "Role_new" AS ENUM ('admin', 'chercheur', 'technicien', 'lecteur');

-- Supprimer le DEFAULT (bloque le USING cast)
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Migrer la colonne (terrain → technicien, les autres passent tels quels)
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE role::text
      WHEN 'terrain' THEN 'technicien'::"Role_new"
      ELSE role::text::"Role_new"
    END
  );

-- Restaurer le DEFAULT avec le nouveau type
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'lecteur'::"Role_new";

-- Supprimer l'ancien enum et renommer le nouveau
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- ─── 2. Ajouter specimens_autorises ───────────────────────────────────────────

-- Colonne tableau de types de spécimens, défaut = les 3 types (rétro-compatible)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "specimens_autorises" "TypeSpecimenTaxon"[]
  NOT NULL DEFAULT ARRAY['moustique', 'tique', 'puce']::"TypeSpecimenTaxon"[];
