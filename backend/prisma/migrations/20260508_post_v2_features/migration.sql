-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('PLAQUE', 'BOITE');

-- AlterTable
ALTER TABLE "localites" ADD COLUMN     "code" VARCHAR(10);

-- AlterTable
ALTER TABLE "moustiques" DROP COLUMN "contenant",
DROP COLUMN "position_plaque",
ADD COLUMN     "container_id" INTEGER,
ADD COLUMN     "id_terrain" VARCHAR(50),
ADD COLUMN     "position" VARCHAR(10);

-- AlterTable
ALTER TABLE "projets" ADD COLUMN     "porteur" VARCHAR(200);

-- AlterTable
ALTER TABLE "puces" DROP COLUMN "contenant",
DROP COLUMN "position_plaque",
ADD COLUMN     "container_id" INTEGER,
ADD COLUMN     "id_terrain" VARCHAR(50),
ADD COLUMN     "position" VARCHAR(10);

-- AlterTable
ALTER TABLE "tiques" DROP COLUMN "contenant",
DROP COLUMN "position_plaque",
ADD COLUMN     "container_id" INTEGER,
ADD COLUMN     "id_terrain" VARCHAR(50),
ADD COLUMN     "position" VARCHAR(10);

-- CreateTable
CREATE TABLE "containers" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" "ContainerType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "mission_id" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "containers_code_key" ON "containers"("code");

-- CreateIndex
CREATE INDEX "containers_type_idx" ON "containers"("type");

-- CreateIndex
CREATE INDEX "containers_mission_id_idx" ON "containers"("mission_id");

-- CreateIndex
CREATE UNIQUE INDEX "localites_code_key" ON "localites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "moustiques_id_terrain_key" ON "moustiques"("id_terrain");

-- CreateIndex
CREATE INDEX "moustiques_container_id_idx" ON "moustiques"("container_id");

-- CreateIndex
CREATE UNIQUE INDEX "puces_id_terrain_key" ON "puces"("id_terrain");

-- CreateIndex
CREATE INDEX "puces_container_id_idx" ON "puces"("container_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiques_id_terrain_key" ON "tiques"("id_terrain");

-- CreateIndex
CREATE INDEX "tiques_container_id_idx" ON "tiques"("container_id");

-- AddForeignKey
ALTER TABLE "moustiques" ADD CONSTRAINT "moustiques_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiques" ADD CONSTRAINT "tiques_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puces" ADD CONSTRAINT "puces_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

