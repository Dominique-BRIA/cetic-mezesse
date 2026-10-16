// Amorçage d'une base vide : établissement, barèmes, année scolaire, comptes Proviseur et SG.
// Sans danger à relancer : rien n'est écrasé.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const GRADES = [
  { libelle: 'A', min: 16 },
  { libelle: 'B+', min: 15 },
  { libelle: 'B', min: 14 },
  { libelle: 'C+', min: 12 },
  { libelle: 'C', min: 10 },
  { libelle: 'D', min: 0 },
];

export const COTES = [
  { libelle: 'CTBA', libelleLong: 'Compétences très bien acquises', min: 16 },
  { libelle: 'CBA', libelleLong: 'Compétences bien acquises', min: 14 },
  { libelle: 'CA', libelleLong: 'Compétences acquises', min: 12 },
  { libelle: 'CMA', libelleLong: 'Compétences moyennement acquises', min: 10 },
  { libelle: 'CNA', libelleLong: 'Compétences non acquises', min: 0 },
];

function anneeCourante(): string {
  const d = new Date();
  const debut = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // l'année commence en septembre
  return `${debut}-${debut + 1}`;
}

export async function amorcer() {
  await prisma.etablissement.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nomFr: "Collège d'Enseignement Technique Industriel et Commercial de Mezessé",
      nomEn: 'Technical and Commercial College of Mezessé',
      sigle: 'CETIC',
      regionFr: 'Sud',
      regionEn: 'South',
      departementFr: 'Dja-et-Lobo',
      departementEn: 'Dja and Lobo',
      arrondissement: 'Sangmélima',
      localite: 'Mezessé',
      code: '8CL1TEFD100792107',
      prefixeMatricule: 'CTM',
    },
  });

  if (!(await prisma.bareme.count())) {
    await prisma.bareme.createMany({
      data: [...GRADES.map((g) => ({ ...g, type: 'GRADE' as const })), ...COTES.map((c) => ({ ...c, type: 'COTE' as const }))],
    });
  }

  if (!(await prisma.anneeScolaire.count())) {
    await prisma.anneeScolaire.create({
      data: {
        libelle: anneeCourante(),
        active: true,
        sequences: {
          create: [1, 2, 3, 4, 5, 6].map((n) => ({ numero: n, trimestre: Math.ceil(n / 2), saisieOuverte: n === 1 })),
        },
      },
    });
  }

  const motDePasse = await bcrypt.hash(process.env.SEED_MOT_DE_PASSE ?? 'Cetic2026', 10);
  const comptes = [
    { role: 'PROVISEUR' as const, telephone: process.env.SEED_PROVISEUR_TELEPHONE ?? '690000001', nom: 'PROVISEUR', prenom: 'Le' },
    { role: 'SURVEILLANT_GENERAL' as const, telephone: process.env.SEED_SG_TELEPHONE ?? '690000002', nom: 'GÉNÉRAL', prenom: 'Surveillant' },
  ];
  for (const c of comptes) {
    if (await prisma.utilisateur.count({ where: { role: c.role } })) continue;
    await prisma.utilisateur.create({ data: { ...c, motDePasse, doitChangerMotDePasse: false } });
    console.log(`Compte ${c.role} créé : ${c.telephone}`);
  }
  console.log('Amorçage terminé.');
}

if (require.main === module) {
  amorcer()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
