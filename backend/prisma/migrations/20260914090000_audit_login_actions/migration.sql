-- Traçabilité des connexions : deux nouvelles valeurs dans l'énumération
-- AuditAction, pour journaliser les connexions réussies et les tentatives
-- échouées.
--
-- Pourquoi (2026-09-14) : `login()` n'écrivait AUCUNE entrée d'audit et le
-- modèle User ne porte pas de date de dernière connexion. Lors de l'enquête sur
-- un import attribué à un compte dont le titulaire démentait l'avoir fait, il a
-- été impossible de savoir quand ce compte s'était connecté, depuis quelle IP,
-- ni si quelqu'un avait tenté de le forcer. Les métadonnées d'audit (ip,
-- userAgent) existaient déjà et ont permis de trancher pour l'import lui-même ;
-- elles manquaient pour l'authentification.
--
-- Sûreté : ajouter une valeur à une énumération PostgreSQL ne réécrit pas la
-- table et ne touche aucune ligne existante. Les entrées déjà présentes gardent
-- leur action. Sous PostgreSQL 12+, `ALTER TYPE ... ADD VALUE` est autorisé
-- dans une transaction tant que la valeur ajoutée n'est pas UTILISÉE dans la
-- même transaction — ce qui est le cas ici (aucun INSERT n'accompagne cette
-- migration). La prod tourne PostgreSQL 16.
--
-- `IF NOT EXISTS` rend la migration rejouable sans erreur.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN_FAILED';
