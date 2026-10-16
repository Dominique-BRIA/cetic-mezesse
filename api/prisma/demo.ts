// Jeu de démonstration : 4 classes, ~70 élèves, des professeurs et des notes sur les séquences 1 et 2.
// Usage : npm run db:demo -- --reinitialiser   (efface les élèves, classes, matières et notes existants)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { amorcer } from './seed';

const prisma = new PrismaClient();

// Générateur pseudo-aléatoire déterministe : la démo est identique à chaque chargement.
let graine = 20261016;
const alea = () => {
  graine = (graine * 1664525 + 1013904223) % 4294967296;
  return graine / 4294967296;
};
const choisir = <T>(t: T[]) => t[Math.floor(alea() * t.length)];
const gauss = () => Math.sqrt(-2 * Math.log(alea() || 1e-9)) * Math.cos(2 * Math.PI * alea());

const NOMS = [
  'MBALLA', 'NDZANA', 'ESSOMBA', 'MVONDO', 'OWONA', 'ATEBA', 'NKOULOU', 'ABENA', 'ONDOA', 'MEBENGA',
  'ZANG', 'NGONO', 'MENGUE', 'AYISSI', 'BIKOULA', 'EBOGO', 'MEKONGO', 'NNANGA', 'OBAMA', 'EYENGA',
  'ASSOUMOU', 'NDONGO', 'MINKO', 'EDZOA', 'BELINGA', 'ESSONO', 'MBARGA', 'NGOUMOU', 'AKONO', 'FOUDA',
];
const PRENOMS_M = ['Jean Paul', 'Brice', 'Rodrigue', 'Yannick', 'Cédric', 'Steve', 'Junior', 'Arnaud', 'Franck', 'Hervé', 'Patrick', 'Thierry', 'Boris', 'Landry'];
const PRENOMS_F = ['Christelle', 'Marie Claire', 'Sandrine', 'Murielle', 'Aurélie', 'Larissa', 'Ange', 'Carine', 'Nadège', 'Prisca', 'Laure', 'Josiane', 'Estelle', 'Vanessa'];
const LIEUX = ['Sangmélima', 'Mezessé', 'Yaoundé', 'Ebolowa', 'Djoum', 'Meyomessala', 'Zoétélé'];

const PROFS: [string, string, string][] = [
  ['NGUEMA', 'Albert', 'Français'],
  ['ATANGANA', 'Sylvie', 'Anglais'],
  ['ESSAMA', 'Robert', 'Mathématiques'],
  ['MANGA', 'Pauline', 'Sciences physiques'],
  ['OYONO', 'Martin', 'Histoire-Géographie'],
  ['BEYALA', 'Odile', 'ECM'],
  ['ELLA', 'Christian', 'Technologie'],
  ['NKOA', 'Bernard', 'Dessin technique'],
  ['ZOA', 'Emmanuel', 'Travaux pratiques'],
  ['MESSI', 'Hélène', 'Législation'],
  ['EKANI', 'Didier', 'EPS'],
  ['TSALA', 'Rose', 'Informatique'],
  ['ABOMO', 'Félix', 'Langues nationales'],
  ['ONANA', 'Grâce', 'Mathématiques'],
];

// [nom, nom anglais, coef, groupe (1 à 3), discipline du professeur]
const MATIERES: [string, string, number, number, string][] = [
  ['Français', 'French', 3, 1, 'Français'],
  ['Anglais', 'English', 2, 1, 'Anglais'],
  ['Mathématiques', 'Mathematics', 4, 1, 'Mathématiques'],
  ['Sciences physiques', 'Physics', 3, 1, 'Sciences physiques'],
  ['Histoire-Géographie', 'History-Geography', 2, 1, 'Histoire-Géographie'],
  ['Éducation à la citoyenneté', 'Citizenship', 1, 1, 'ECM'],
  ['Technologie', 'Technology', 4, 2, 'Technologie'],
  ['Dessin technique', 'Technical drawing', 3, 2, 'Dessin technique'],
  ['Travaux pratiques', 'Workshop practice', 5, 2, 'Travaux pratiques'],
  ['Législation', 'Legislation', 1, 2, 'Législation'],
  ['EPS', 'Physical education', 2, 3, 'EPS'],
  ['Informatique', 'Computer science', 2, 3, 'Informatique'],
  ['Langues et cultures nationales', 'National languages', 1, 3, 'Langues nationales'],
];

async function main() {
  const reinitialiser = process.argv.includes('--reinitialiser');
  if ((await prisma.eleve.count()) && !reinitialiser) {
    console.error('La base contient déjà des élèves. Relancez avec --reinitialiser pour tout remplacer.');
    process.exit(1);
  }
  if (reinitialiser) {
    await prisma.note.deleteMany();
    await prisma.renvoi.deleteMany();
    await prisma.inscription.deleteMany();
    await prisma.eleve.deleteMany();
    await prisma.matiere.deleteMany();
    await prisma.groupeMatiere.deleteMany();
    await prisma.classe.deleteMany();
    await prisma.utilisateur.deleteMany({ where: { role: 'PROFESSEUR' } });
    await prisma.compteur.deleteMany();
  }
  await amorcer();
  const annee = await prisma.anneeScolaire.findFirstOrThrow({ where: { active: true }, include: { sequences: true } });
  await prisma.sequence.updateMany({ where: { anneeId: annee.id, numero: 1 }, data: { saisieOuverte: false } });
  await prisma.sequence.updateMany({ where: { anneeId: annee.id, numero: 2 }, data: { saisieOuverte: true } });

  const mdp = await bcrypt.hash('password', 10);
  const profs = [];
  for (const [i, [nom, prenom, discipline]] of PROFS.entries()) {
    profs.push(
      await prisma.utilisateur.create({
        data: { nom, prenom, discipline, role: 'PROFESSEUR', telephone: `6910000${String(i + 1).padStart(2, '0')}`, motDePasse: mdp, doitChangerMotDePasse: false },
      }),
    );
  }

  const classes = [];
  for (let n = 1; n <= 4; n++) {
    classes.push(
      await prisma.classe.create({
        data: {
          anneeId: annee.id,
          nom: `${n === 1 ? '1re' : `${n}e`} année`,
          nomEn: `Year ${n}`,
          niveau: n,
          profPrincipalId: profs[(n * 3) % profs.length].id,
        },
      }),
    );
  }
  const groupes = [];
  for (const [ordre, nom, nomEn] of [
    [1, 'Matières générales', 'General subjects'],
    [2, 'Matières professionnelles', 'Vocational subjects'],
    [3, 'Matières complémentaires', 'Complementary subjects'],
  ] as const) {
    groupes.push(
      await prisma.groupeMatiere.create({
        data: { anneeId: annee.id, ordre, nom, nomEn, classes: { connect: classes.map((c) => ({ id: c.id })) } },
      }),
    );
  }
  for (const c of classes) {
    for (const [i, [nom, nomEn, coef, g, discipline]] of MATIERES.entries()) {
      const candidats = profs.filter((p) => p.discipline === discipline);
      await prisma.matiere.create({
        data: {
          classeId: c.id,
          groupeId: groupes[g - 1].id,
          nom,
          nomEn,
          coefficient: coef,
          ordre: i + 1,
          professeurId: candidats[c.niveau % candidats.length].id,
        },
      });
    }
  }

  // Élèves et notes
  const effectifs = [20, 18, 17, 15];
  let rang = 0;
  const aa = annee.libelle.slice(2, 4);
  for (const [k, c] of classes.entries()) {
    const matieres = await prisma.matiere.findMany({ where: { classeId: c.id } });
    for (let i = 0; i < effectifs[k]; i++) {
      rang++;
      const sexe = alea() < 0.48 ? 'F' : 'M';
      const naissance = new Date(Date.UTC(2014 - c.niveau - Math.floor(alea() * 2), Math.floor(alea() * 12), 1 + Math.floor(alea() * 28)));
      const nom = choisir(NOMS);
      const eleve = await prisma.eleve.create({
        data: {
          matricule: `CTM${aa}-${String(rang).padStart(4, '0')}`,
          nom,
          prenoms: choisir(sexe === 'F' ? PRENOMS_F : PRENOMS_M),
          sexe,
          dateNaissance: naissance,
          lieuNaissance: choisir(LIEUX),
          parentNom: `${choisir(NOMS)} ${choisir(PRENOMS_M)}`,
          parentTelephone: `6${String(Math.floor(alea() * 1e8)).padStart(8, '0')}`,
          parentAdresse: choisir(['Mezessé', 'Sangmélima', 'Ndou-Libi']),
          inscriptions: { create: { anneeId: annee.id, classeId: c.id, redoublant: alea() < 0.12 } },
        },
        include: { inscriptions: true },
      });
      const ins = eleve.inscriptions[0];
      const niveau = gauss() * 2.2 + 10.8; // niveau propre à l'élève
      const notes = [];
      for (const m of matieres) {
        for (const seq of annee.sequences.filter((s) => s.numero <= 2)) {
          // En séquence 2 (saisie ouverte), une partie des notes manque encore.
          if (seq.numero === 2 && (m.ordre % 4 === 0 || alea() < 0.06)) continue;
          if (seq.numero === 1 && alea() < 0.02) continue;
          const v = Math.min(20, Math.max(0, niveau + gauss() * 2.8));
          notes.push({ inscriptionId: ins.id, matiereId: m.id, sequenceId: seq.id, valeur: Math.round(v * 4) / 4, saisieParId: m.professeurId! });
        }
      }
      await prisma.note.createMany({ data: notes });
    }
  }
  await prisma.compteur.upsert({
    where: { cle: `matricule-CTM-${aa}` },
    create: { cle: `matricule-CTM-${aa}`, valeur: rang },
    update: { valeur: rang },
  });

  // Quelques compétences visées en séquence 1
  const s1 = annee.sequences.find((s) => s.numero === 1)!;
  const exemples: Record<string, string> = {
    Français: 'Lire et comprendre des textes simples portant sur la vie sociale',
    Mathématiques: 'Résoudre des problèmes de proportionnalité',
    'Sciences physiques': 'Identifier les grandeurs électriques et leurs unités',
    Technologie: "Décrire le fonctionnement d'un objet technique",
    'Travaux pratiques': "Réaliser un montage simple en respectant les règles de sécurité",
    Anglais: 'Read and understand short texts',
  };
  for (const m of await prisma.matiere.findMany()) {
    if (exemples[m.nom]) await prisma.competenceVisee.create({ data: { matiereId: m.id, sequenceId: s1.id, texte: exemples[m.nom] } });
  }
  console.log(`Démo chargée : ${classes.length} classes, ${rang} élèves, ${profs.length} professeurs (mot de passe « password »).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
