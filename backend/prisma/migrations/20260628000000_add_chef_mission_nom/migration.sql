-- Ajout du champ texte libre pour le chef de mission externe (non-utilisateur de l'application)
ALTER TABLE "missions" ADD COLUMN "chef_mission_nom" VARCHAR(200);
