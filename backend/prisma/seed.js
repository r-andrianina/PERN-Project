// backend/prisma/seed.js
// Seed des référentiels du Dictionnaire de données + compte admin.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ----------------------------------------------------------------
//  Helpers
// ----------------------------------------------------------------
async function upsertSpecimenNode({ niveau, nom, parentId, type, auteur, annee, nomCommun }) {
  const existing = await prisma.taxonomieSpecimen.findFirst({
    where: { niveau, nom, parentId: parentId ?? null },
  });
  if (existing) return existing;
  return prisma.taxonomieSpecimen.create({
    data: { niveau, nom, parentId: parentId ?? null, type, auteur, annee, nomCommun },
  });
}

async function upsertHoteNode({ niveau, nom, parentId, nomCommun }) {
  const existing = await prisma.taxonomieHote.findFirst({
    where: { niveau, nom, parentId: parentId ?? null },
  });
  if (existing) return existing;
  return prisma.taxonomieHote.create({
    data: { niveau, nom, parentId: parentId ?? null, nomCommun },
  });
}

async function main() {
  console.log('Démarrage du seed...');

  // ============================================================
  //  COMPTE ADMIN
  // ============================================================
  const passwordHash = await bcrypt.hash('Admin1234!', 10);
  await prisma.user.upsert({
    where:  { email: 'andrianinar@pasteur.mg' },
    update: {},
    create: {
      nom: 'Andrianina', prenom: 'Henintsoa',
      email: 'andrianinar@pasteur.mg',
      passwordHash, role: 'admin', actif: true,
    },
  });
  console.log('Compte admin OK');

  // ============================================================
  //  TAXONOMIE SPÉCIMENS (hiérarchique)
  // ============================================================

  // --- Moustiques : Diptera → Culicidae → Anophelinae/Culicinae → genres → espèces
  const dipteraMoustique = await upsertSpecimenNode({ niveau: 'ordre', nom: 'Diptera', type: 'moustique' });
  const culicidae        = await upsertSpecimenNode({ niveau: 'famille', nom: 'Culicidae', parentId: dipteraMoustique.id, type: 'moustique' });
  const anophelinae      = await upsertSpecimenNode({ niveau: 'sous_famille', nom: 'Anophelinae', parentId: culicidae.id, type: 'moustique' });
  const culicinae        = await upsertSpecimenNode({ niveau: 'sous_famille', nom: 'Culicinae',   parentId: culicidae.id, type: 'moustique' });

  const anopheles  = await upsertSpecimenNode({ niveau: 'genre', nom: 'Anopheles', parentId: anophelinae.id, type: 'moustique' });
  const aedes      = await upsertSpecimenNode({ niveau: 'genre', nom: 'Aedes',     parentId: culicinae.id,   type: 'moustique' });
  const culex      = await upsertSpecimenNode({ niveau: 'genre', nom: 'Culex',     parentId: culicinae.id,   type: 'moustique' });
  const mansonia   = await upsertSpecimenNode({ niveau: 'genre', nom: 'Mansonia',  parentId: culicinae.id,   type: 'moustique' });

  await upsertSpecimenNode({ niveau: 'espece', nom: 'gambiae',         parentId: anopheles.id, type: 'moustique', auteur: 'Giles',     annee: 1902 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'arabiensis',      parentId: anopheles.id, type: 'moustique', auteur: 'Patton',    annee: 1905 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'funestus',        parentId: anopheles.id, type: 'moustique', auteur: 'Giles',     annee: 1900 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'mascarensis',     parentId: anopheles.id, type: 'moustique', auteur: 'De Meillon', annee: 1947 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'aegypti',         parentId: aedes.id,     type: 'moustique', auteur: 'Linnaeus',  annee: 1762 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'albopictus',      parentId: aedes.id,     type: 'moustique', auteur: 'Skuse',     annee: 1894 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'quinquefasciatus',parentId: culex.id,     type: 'moustique', auteur: 'Say',       annee: 1823 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'antennatus',      parentId: culex.id,     type: 'moustique', auteur: 'Becker',    annee: 1903 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'uniformis',       parentId: mansonia.id,  type: 'moustique', auteur: 'Theobald',  annee: 1901 });

  // --- Tiques : Ixodida → Ixodidae → genres → espèces
  const ixodida    = await upsertSpecimenNode({ niveau: 'ordre',   nom: 'Ixodida',  type: 'tique' });
  const ixodidae   = await upsertSpecimenNode({ niveau: 'famille', nom: 'Ixodidae', parentId: ixodida.id, type: 'tique' });
  const amblyomma  = await upsertSpecimenNode({ niveau: 'genre',   nom: 'Amblyomma',     parentId: ixodidae.id, type: 'tique' });
  const rhipiceph  = await upsertSpecimenNode({ niveau: 'genre',   nom: 'Rhipicephalus', parentId: ixodidae.id, type: 'tique' });
  const haemaphys  = await upsertSpecimenNode({ niveau: 'genre',   nom: 'Haemaphysalis', parentId: ixodidae.id, type: 'tique' });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'variegatum', parentId: amblyomma.id, type: 'tique', auteur: 'Fabricius',   annee: 1794 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'microplus',  parentId: rhipiceph.id, type: 'tique', auteur: 'Canestrini',  annee: 1888 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'sanguineus', parentId: rhipiceph.id, type: 'tique', auteur: 'Latreille',   annee: 1806 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'leachi',     parentId: haemaphys.id, type: 'tique', auteur: 'Audouin',     annee: 1826 });

  // --- Puces : Siphonaptera → Pulicidae/Ceratophyllidae → genres → espèces
  const siphonaptera   = await upsertSpecimenNode({ niveau: 'ordre',   nom: 'Siphonaptera', type: 'puce' });
  const pulicidae      = await upsertSpecimenNode({ niveau: 'famille', nom: 'Pulicidae',       parentId: siphonaptera.id, type: 'puce' });
  const ceratophyll    = await upsertSpecimenNode({ niveau: 'famille', nom: 'Ceratophyllidae', parentId: siphonaptera.id, type: 'puce' });
  const xenopsylla     = await upsertSpecimenNode({ niveau: 'genre',   nom: 'Xenopsylla',  parentId: pulicidae.id,    type: 'puce' });
  const pulex          = await upsertSpecimenNode({ niveau: 'genre',   nom: 'Pulex',       parentId: pulicidae.id,    type: 'puce' });
  const ctenocephalides= await upsertSpecimenNode({ niveau: 'genre',   nom: 'Ctenocephalides', parentId: pulicidae.id, type: 'puce' });
  const synosternus    = await upsertSpecimenNode({ niveau: 'genre',   nom: 'Synosternus', parentId: pulicidae.id,    type: 'puce' });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'cheopis',  parentId: xenopsylla.id,      type: 'puce', auteur: 'Rothschild', annee: 1903 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'brasiliensis', parentId: xenopsylla.id,  type: 'puce', auteur: 'Baker',      annee: 1904 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'irritans', parentId: pulex.id,           type: 'puce', auteur: 'Linnaeus',   annee: 1758 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'felis',    parentId: ctenocephalides.id, type: 'puce', auteur: 'Bouché',     annee: 1835 });
  await upsertSpecimenNode({ niveau: 'espece', nom: 'pallidus', parentId: synosternus.id,     type: 'puce', auteur: 'Taschenberg', annee: 1880 });

  console.log('Taxonomie spécimens OK');

  // ============================================================
  //  TAXONOMIE HÔTES (Madagascar — mammifères, oiseaux)
  // ============================================================
  const rodentia       = await upsertHoteNode({ niveau: 'ordre',   nom: 'Rodentia' });
  const muridae        = await upsertHoteNode({ niveau: 'famille', nom: 'Muridae', parentId: rodentia.id });
  const rattus         = await upsertHoteNode({ niveau: 'genre',   nom: 'Rattus', parentId: muridae.id });
  await upsertHoteNode({ niveau: 'espece', nom: 'rattus',     parentId: rattus.id, nomCommun: 'Rat noir' });
  await upsertHoteNode({ niveau: 'espece', nom: 'norvegicus', parentId: rattus.id, nomCommun: 'Rat brun (surmulot)' });

  const nesomyidae = await upsertHoteNode({ niveau: 'famille', nom: 'Nesomyidae', parentId: rodentia.id });
  const nesomys    = await upsertHoteNode({ niveau: 'genre',   nom: 'Nesomys',    parentId: nesomyidae.id });
  await upsertHoteNode({ niveau: 'espece', nom: 'rufus', parentId: nesomys.id, nomCommun: 'Rat rouge de Madagascar' });

  const chiroptera = await upsertHoteNode({ niveau: 'ordre',   nom: 'Chiroptera' });
  const pteropodid = await upsertHoteNode({ niveau: 'famille', nom: 'Pteropodidae', parentId: chiroptera.id });
  const pteropus   = await upsertHoteNode({ niveau: 'genre',   nom: 'Pteropus',     parentId: pteropodid.id });
  await upsertHoteNode({ niveau: 'espece', nom: 'rufus', parentId: pteropus.id, nomCommun: 'Roussette de Madagascar' });

  const artiodactyla = await upsertHoteNode({ niveau: 'ordre',   nom: 'Artiodactyla' });
  const bovidae      = await upsertHoteNode({ niveau: 'famille', nom: 'Bovidae', parentId: artiodactyla.id });
  const bos          = await upsertHoteNode({ niveau: 'genre',   nom: 'Bos',     parentId: bovidae.id });
  await upsertHoteNode({ niveau: 'espece', nom: 'indicus', parentId: bos.id, nomCommun: 'Zébu' });
  await upsertHoteNode({ niveau: 'espece', nom: 'taurus',  parentId: bos.id, nomCommun: 'Bovin domestique' });

  const afrosoricida = await upsertHoteNode({ niveau: 'ordre',   nom: 'Afrosoricida' });
  const tenrecidae   = await upsertHoteNode({ niveau: 'famille', nom: 'Tenrecidae', parentId: afrosoricida.id });
  const tenrec       = await upsertHoteNode({ niveau: 'genre',   nom: 'Tenrec',     parentId: tenrecidae.id });
  await upsertHoteNode({ niveau: 'espece', nom: 'ecaudatus', parentId: tenrec.id, nomCommun: 'Tanrec commun' });

  const carnivora    = await upsertHoteNode({ niveau: 'ordre',   nom: 'Carnivora' });
  const canidae      = await upsertHoteNode({ niveau: 'famille', nom: 'Canidae', parentId: carnivora.id });
  const canis        = await upsertHoteNode({ niveau: 'genre',   nom: 'Canis',   parentId: canidae.id });
  await upsertHoteNode({ niveau: 'espece', nom: 'familiaris', parentId: canis.id, nomCommun: 'Chien domestique' });
  console.log('Taxonomie hôtes OK');

  // ============================================================
  //  TYPES DE MÉTHODE DE COLLECTE
  // ============================================================
  const typesMethode = [
    { code: 'CDC-LT',   nom: 'CDC Light Trap',           description: 'Piège lumineux CDC pour moustiques adultes' },
    { code: 'BG-SENT',  nom: 'BG-Sentinel',              description: 'Piège à appât olfactif pour Aedes' },
    { code: 'HLC',      nom: 'Capture sur appât humain', description: 'Human Landing Catch — protocole HLC' },
    { code: 'RES-IND',  nom: 'Capture au repos intérieur', description: 'Aspiration de moustiques au repos en intérieur' },
    { code: 'GITES',    nom: 'Prospection gîtes larvaires', description: 'Recherche de larves dans collections d\'eau' },
    { code: 'DRAGGING', nom: 'Drag/Flagging',            description: 'Collecte de tiques au tissu (drapeau)' },
    { code: 'PIEGE-CO2',nom: 'Piège CO2',                description: 'Piège à CO2 pour tiques et moustiques' },
    { code: 'PRISE-HOTE', nom: 'Collecte sur hôte',      description: 'Collecte directe d\'ectoparasites sur l\'animal' },
    { code: 'PIEGE-RG', nom: 'Piège à rongeurs',         description: 'Capture-vivant de rongeurs hôtes (Sherman, BTS)' },
  ];
  for (const t of typesMethode) {
    await prisma.typeMethodeCollecte.upsert({
      where: { code: t.code }, update: {}, create: t,
    });
  }
  console.log('Types de méthode OK');

  // ============================================================
  //  SOLUTIONS DE CONSERVATION
  // ============================================================
  const solutions = [
    { nom: 'Ethanol 70%',   description: 'Conservation standard pour PCR',  temperature: 'Ambiante' },
    { nom: 'Ethanol 95%',   description: 'Conservation morphologique',      temperature: 'Ambiante' },
    { nom: 'RNAlater',      description: 'Stabilisation ARN',               temperature: '-20°C' },
    { nom: 'Azote liquide', description: 'Cryoconservation long terme',     temperature: '-196°C' },
    { nom: 'Sec (épingle)', description: 'Conservation entomologique sèche', temperature: 'Ambiante' },
    { nom: 'Silica gel',    description: 'Dessiccation rapide',             temperature: 'Ambiante' },
  ];
  for (const s of solutions) {
    await prisma.solutionConservation.upsert({
      where: { nom: s.nom }, update: {}, create: s,
    });
  }
  console.log('Solutions de conservation OK');

  // ============================================================
  //  TYPES D'ENVIRONNEMENT
  // ============================================================
  const environnements = [
    { nom: 'Urbain',       description: 'Zone urbaine dense' },
    { nom: 'Péri-urbain',  description: 'Zone de transition urbain/rural' },
    { nom: 'Rural',        description: 'Zone agricole et villageoise' },
    { nom: 'Forêt',        description: 'Massif forestier (primaire ou secondaire)' },
    { nom: 'Savane',       description: 'Savane herbeuse ou arbustive' },
    { nom: 'Mangrove',     description: 'Zone côtière de mangrove' },
    { nom: 'Côtier',       description: 'Littoral, plage, dunes' },
  ];
  for (const e of environnements) {
    await prisma.typeEnvironnement.upsert({ where: { nom: e.nom }, update: {}, create: e });
  }
  console.log('Types environnement OK');

  // ============================================================
  //  TYPES D'HABITAT
  // ============================================================
  const habitats = [
    { nom: 'Intra-domiciliaire',   description: 'À l\'intérieur d\'une habitation' },
    { nom: 'Péri-domiciliaire',    description: 'À proximité immédiate d\'une habitation' },
    { nom: 'Extra-domiciliaire',   description: 'Hors zone d\'habitation' },
    { nom: 'Rizière',              description: 'Champ de riz inondé' },
    { nom: 'Étable / Enclos',      description: 'Bâtiment d\'élevage' },
    { nom: 'Forêt galerie',        description: 'Forêt en bordure de cours d\'eau' },
    { nom: 'Trou d\'arbre',        description: 'Cavité d\'arbre (gîte larvaire)' },
    { nom: 'Récipient artificiel', description: 'Conteneur (gîte larvaire d\'Aedes)' },
    { nom: 'Mare / collection d\'eau', description: 'Étendue d\'eau stagnante' },
  ];
  for (const h of habitats) {
    await prisma.typeHabitat.upsert({ where: { nom: h.nom }, update: {}, create: h });
  }
  console.log('Types habitat OK');

  console.log('\nSeed terminé avec succès !');
  console.log('Connexion : andrianinar@pasteur.mg / Admin1234!');
}

main()
  .catch((err) => {
    console.error('Erreur seed :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
