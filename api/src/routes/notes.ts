import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles, session } from '../lib/auth';
import { anneeDe } from '../lib/annee';
import { conflit, interdit, introuvable, invalide } from '../lib/erreurs';
import { periode } from '../lib/validation';
import { resultatsClasse } from '../services/resultats';

export const notes = Router();

// Un professeur n'accède qu'à ses matières ; la direction à toutes.
export async function matiereAccessible(req: Request, matiereId: string) {
  const s = session(req);
  const m = await prisma.matiere.findUnique({
    where: { id: matiereId },
    include: { classe: { select: { id: true, nom: true, anneeId: true } }, groupe: { select: { nom: true } } },
  });
  if (!m) throw introuvable('Matière');
  if (s.role === 'PROFESSEUR' && m.professeurId !== s.id) throw interdit("Cette matière ne vous est pas attribuée.");
  return m;
}

// Feuille de notes d'une matière pour une séquence : tous les élèves actifs de la classe.
notes.get('/feuille', async (req, res) => {
  const { matiereId, sequenceId } = z.object({ matiereId: z.string(), sequenceId: z.string() }).parse(req.query);
  const m = await matiereAccessible(req, matiereId);
  const sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
  if (!sequence || sequence.anneeId !== m.classe.anneeId) throw introuvable('Séquence');
  const [inscriptions, existantes, competence] = await Promise.all([
    prisma.inscription.findMany({
      where: { classeId: m.classeId, statut: 'ACTIF' },
      include: { eleve: { select: { matricule: true, nom: true, prenoms: true, sexe: true } } },
      orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
    }),
    prisma.note.findMany({ where: { matiereId, sequenceId } }),
    prisma.competenceVisee.findUnique({ where: { matiereId_sequenceId: { matiereId, sequenceId } } }),
  ]);
  const parInscription = new Map(existantes.map((n) => [n.inscriptionId, n]));
  res.json({
    matiere: { id: m.id, nom: m.nom, coefficient: m.coefficient, classe: m.classe, groupe: m.groupe },
    sequence,
    competence: competence?.texte ?? '',
    eleves: inscriptions.map((i) => ({
      inscriptionId: i.id,
      ...i.eleve,
      note: parInscription.has(i.id) ? Number(parInscription.get(i.id)!.valeur) : null,
      majLe: parInscription.get(i.id)?.majLe ?? null,
    })),
  });
});

const schemaFeuille = z.object({
  matiereId: z.string(),
  sequenceId: z.string(),
  competence: z.string().trim().max(300).optional(),
  notes: z.array(
    z.object({
      inscriptionId: z.string(),
      valeur: z
        .number()
        .min(0, 'une note est comprise entre 0 et 20')
        .max(20, 'une note est comprise entre 0 et 20')
        .refine((v) => Math.round(v * 100) === v * 100 || Math.abs(Math.round(v * 100) - v * 100) < 1e-6, {
          message: 'deux décimales au plus',
        })
        .nullable(),
    }),
  ),
});

// Enregistrement d'une feuille (ou d'une partie) par le professeur de la matière.
// valeur = null efface la note. Sert aussi à la synchronisation hors connexion du mobile.
notes.put('/feuille', roles('PROFESSEUR'), async (req, res) => {
  const { matiereId, sequenceId, competence, notes: saisies } = schemaFeuille.parse(req.body);
  const m = await matiereAccessible(req, matiereId);
  const sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
  if (!sequence || sequence.anneeId !== m.classe.anneeId) throw introuvable('Séquence');
  if (!sequence.saisieOuverte) {
    throw conflit(`La saisie de la séquence ${sequence.numero} est fermée. Demandez au Surveillant Général de la rouvrir.`);
  }
  const valides = await prisma.inscription.findMany({
    where: { id: { in: saisies.map((s) => s.inscriptionId) }, classeId: m.classeId, statut: 'ACTIF' },
    select: { id: true },
  });
  const ids = new Set(valides.map((v) => v.id));
  const inconnus = saisies.filter((s) => !ids.has(s.inscriptionId));
  if (inconnus.length) throw invalide(`${inconnus.length} élève(s) ne font plus partie de la classe ; rechargez la feuille.`);

  const auteur = session(req).id;
  await prisma.$transaction([
    ...saisies.map((s) =>
      s.valeur === null
        ? prisma.note.deleteMany({ where: { inscriptionId: s.inscriptionId, matiereId, sequenceId } })
        : prisma.note.upsert({
            where: { inscriptionId_matiereId_sequenceId: { inscriptionId: s.inscriptionId, matiereId, sequenceId } },
            create: { inscriptionId: s.inscriptionId, matiereId, sequenceId, valeur: s.valeur, saisieParId: auteur },
            update: { valeur: s.valeur, saisieParId: auteur },
          }),
    ),
    ...(competence === undefined
      ? []
      : competence
        ? [
            prisma.competenceVisee.upsert({
              where: { matiereId_sequenceId: { matiereId, sequenceId } },
              create: { matiereId, sequenceId, texte: competence },
              update: { texte: competence },
            }),
          ]
        : [prisma.competenceVisee.deleteMany({ where: { matiereId, sequenceId } })]),
  ]);
  res.json({ message: `${saisies.length} note(s) enregistrée(s).` });
});

// Avancement de la saisie : pour chaque matière visible, nombre de notes par séquence.
notes.get('/avancement', async (req, res) => {
  const s = session(req);
  const anneeId = await anneeDe(req);
  const [matieres, sequences] = await Promise.all([
    prisma.matiere.findMany({
      where: { classe: { anneeId }, ...(s.role === 'PROFESSEUR' ? { professeurId: s.id } : {}) },
      include: {
        classe: { select: { id: true, nom: true, niveau: true } },
        professeur: { select: { nom: true, prenom: true } },
      },
      orderBy: [{ classe: { niveau: 'asc' } }, { ordre: 'asc' }],
    }),
    prisma.sequence.findMany({ where: { anneeId }, orderBy: { numero: 'asc' } }),
  ]);
  const effectifs = await prisma.inscription.groupBy({
    by: ['classeId'],
    where: { anneeId, statut: 'ACTIF' },
    _count: true,
  });
  const comptes = await prisma.note.groupBy({
    by: ['matiereId', 'sequenceId'],
    where: { matiereId: { in: matieres.map((m) => m.id) }, inscription: { statut: 'ACTIF' } },
    _count: true,
  });
  res.json({
    sequences,
    matieres: matieres.map((m) => ({
      id: m.id,
      nom: m.nom,
      coefficient: m.coefficient,
      classe: m.classe,
      professeur: m.professeur,
      effectif: effectifs.find((e) => e.classeId === m.classeId)?._count ?? 0,
      saisies: Object.fromEntries(
        sequences.map((q) => [q.id, comptes.find((c) => c.matiereId === m.id && c.sequenceId === q.id)?._count ?? 0]),
      ),
    })),
  });
});

// Élèves sans note dans une matière et une séquence (ou dans toutes les matières visibles).
notes.get('/manquantes', async (req, res) => {
  const s = session(req);
  const { sequenceId, matiereId, classeId } = z
    .object({ sequenceId: z.string(), matiereId: z.string().optional(), classeId: z.string().optional() })
    .parse(req.query);
  const sequence = await prisma.sequence.findUniqueOrThrow({ where: { id: sequenceId } });
  const matieres = await prisma.matiere.findMany({
    where: {
      classe: { anneeId: sequence.anneeId },
      ...(matiereId ? { id: matiereId } : {}),
      ...(classeId ? { classeId } : {}),
      ...(s.role === 'PROFESSEUR' ? { professeurId: s.id } : {}),
    },
    include: {
      classe: { select: { id: true, nom: true, niveau: true } },
      professeur: { select: { nom: true, prenom: true } },
    },
    orderBy: [{ classe: { niveau: 'asc' } }, { ordre: 'asc' }],
  });
  const resultat = [];
  for (const m of matieres) {
    const manquants = await prisma.inscription.findMany({
      where: { classeId: m.classeId, statut: 'ACTIF', notes: { none: { matiereId: m.id, sequenceId } } },
      include: { eleve: { select: { matricule: true, nom: true, prenoms: true, sexe: true } } },
      orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
    });
    const effectif = await prisma.inscription.count({ where: { classeId: m.classeId, statut: 'ACTIF' } });
    resultat.push({
      matiere: { id: m.id, nom: m.nom, classe: m.classe, professeur: m.professeur },
      effectif,
      manquants: manquants.map((i) => ({ inscriptionId: i.id, ...i.eleve })),
    });
  }
  res.json({ sequence, matieres: resultat });
});

// Relevé de toute une classe pour une période (consultation par la direction).
notes.get('/classe', roles(...DIRECTION), async (req, res) => {
  const { classeId } = z.object({ classeId: z.string() }).parse(req.query);
  const p = periode(req.query.periode);
  const { classe, inscriptions, resultats } = await resultatsClasse(classeId, p);
  res.json({
    classe: { id: classe.id, nom: classe.nom, annee: classe.annee.libelle },
    periode: p,
    matieres: resultats.matieres.map((s) => ({
      id: s.matiere.id,
      nom: s.matiere.nom,
      coefficient: s.matiere.coefficient,
      groupe: s.matiere.groupe.nom,
      professeur: s.matiere.professeur,
      evaluee: s.evaluee,
      moyenne: s.moyenne,
    })),
    eleves: resultats.eleves.map((r) => {
      const i = inscriptions.find((x) => x.id === r.inscriptionId)!;
      return {
        inscriptionId: i.id,
        eleveId: i.eleveId,
        matricule: i.eleve.matricule,
        nom: i.eleve.nom,
        prenoms: i.eleve.prenoms,
        sexe: i.eleve.sexe,
        notes: r.matieres.map((l) => l.note),
        moyenne: r.moyenne,
        rang: r.rang,
      };
    }),
    profil: resultats.profil,
  });
});
