-- AlterTable
ALTER TABLE "taxonomie_specimens" ADD COLUMN     "pays_type" VARCHAR(150);

-- CreateTable
CREATE TABLE "taxonomie_synonymes" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "auteur" VARCHAR(100),
    "annee" INTEGER,
    "taxonomie_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxonomie_synonymes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taxonomie_synonymes_taxonomie_id_idx" ON "taxonomie_synonymes"("taxonomie_id");

-- CreateIndex
CREATE INDEX "taxonomie_synonymes_nom_idx" ON "taxonomie_synonymes"("nom");

-- AddForeignKey
ALTER TABLE "taxonomie_synonymes" ADD CONSTRAINT "taxonomie_synonymes_taxonomie_id_fkey" FOREIGN KEY ("taxonomie_id") REFERENCES "taxonomie_specimens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

