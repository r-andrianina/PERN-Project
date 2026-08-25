-- Index manquants identifiés par l'audit performance du 2026-08-12 : colonnes
-- filtrées/triées fréquemment (recherche, dashboard, import) sans index,
-- candidates à un table scan à mesure que le volume de données grossit.

-- CreateIndex
CREATE INDEX "hotes_methode_id_idx" ON "hotes"("methode_id");

-- CreateIndex
CREATE INDEX "hotes_taxonomie_hote_id_idx" ON "hotes"("taxonomie_hote_id");

-- CreateIndex
CREATE INDEX "localites_mission_id_idx" ON "localites"("mission_id");

-- CreateIndex
CREATE INDEX "methodes_collecte_localite_id_idx" ON "methodes_collecte"("localite_id");

-- CreateIndex
CREATE INDEX "methodes_collecte_type_methode_id_idx" ON "methodes_collecte"("type_methode_id");

-- CreateIndex
CREATE INDEX "moustiques_taxonomie_id_idx" ON "moustiques"("taxonomie_id");

-- CreateIndex
CREATE INDEX "moustiques_date_collecte_idx" ON "moustiques"("date_collecte");

-- CreateIndex
CREATE INDEX "puces_taxonomie_id_idx" ON "puces"("taxonomie_id");

-- CreateIndex
CREATE INDEX "puces_date_collecte_idx" ON "puces"("date_collecte");

-- CreateIndex
CREATE INDEX "puces_hote_id_idx" ON "puces"("hote_id");

-- CreateIndex
CREATE INDEX "tiques_taxonomie_id_idx" ON "tiques"("taxonomie_id");

-- CreateIndex
CREATE INDEX "tiques_date_collecte_idx" ON "tiques"("date_collecte");

-- CreateIndex
CREATE INDEX "tiques_hote_id_idx" ON "tiques"("hote_id");
