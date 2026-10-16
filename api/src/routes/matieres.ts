import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { roles, session } from '../lib/auth';
import { anneeDe } from '../lib/annee';
import { texte, texteOptionnel } from '../lib/validation';
import { conflit, interdit, invalide } from '../lib/erreurs';
import { consigner } from '../lib/decisions';

export const matieres = Router();

// Champs qu'une désapprobation remet en l'état (services/annulation.ts).
const champs = (m: { nom: string; nomEn: string | null; coefficient: number; ordre: number; groupeId: string; classeId: string; professeurId: string | null }) => ({
  nom: m.nom,
  nomEn: m.nomEn,
  coefficient: m.coefficient,
  ordre: m.ordre,
  groupeId: m.groupeId,
  classeId: m.classeId,
  professeurId: m.professeurId,
});

const inclure = {
  classe: { select: { id: true, nom: true, niveau: true } },
  groupe: { select: { id: true, nom: true, ordre: true } },
  professeur: { select: { id: true, nom: true, prenom: true } },
  _count: { select: { notes: true } },
} as const;

matieres.get('/', async (req, res) => {
  const s = session(req);
  const anneeId = await anneeDe(req);
  const classeId = req.query.classeId as string | undefined;
  res.json(
    await prisma.matiere.findMany({
      where: {
        classe: { anneeId },
        ...(classeId ? { classeId } : {}),
        ...(s.role === 'PROFESSEUR' ? { professeurId: s.id } : {}),
      },
      include: inclure,
      orderBy: [{ classe: { niveau: 'asc' } }, { groupe: { ordre: 'asc' } }, { ordre: 'asc' }],
    }),
  );
});

const schema = z.object({
  classeId: z.string().min(1),
  groupeId: z.string().min(1),
  nom: texte(80),
  nomEn: texteOptionnel(80),
  coefficient: z.number().int().min(1).max(20),
  ordre: z.number().int().min(1).max(50),
  professeurId: z.string().optional().nullable(),
});

// Le groupe doit être rattaché à la classe de la matière.
async function verifierGroupe(groupeId: string, classeId: string) {
  const ok = await prisma.groupeMatiere.count({ where: { id: groupeId, classes: { some: { id: classeId } } } });
  if (!ok) throw invalide("Ce groupe n'est pas rattaché à cette classe.");
}

async function verifierProfesseur(id: string | null | undefined) {
  if (!id) return;
  const p = await prisma.utilisateur.findUnique({ where: { id }, select: { role: true } });
  if (p?.role !== 'PROFESSEUR') throw invalide("L'enseignant choisi n'est pas un professeur.");
}

matieres.post('/', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const data = schema.parse(req.body);
  await verifierGroupe(data.groupeId, data.classeId);
  await verifierProfesseur(data.professeurId);
  const anneeId = await anneeDe(req);
  if (!(await prisma.classe.count({ where: { id: data.classeId, anneeId } }))) throw interdit();
  const m = await prisma.matiere.create({ data, include: inclure });
  await consigner(req, {
    domaine: 'ORGANISATION',
    action: 'matiere.creer',
    annulation: { id: m.id },
    libelle: `Création de la matière ${m.nom} en ${m.classe.nom} (coefficient ${m.coefficient}${
      m.professeur ? `, ${m.professeur.prenom} ${m.professeur.nom}` : ''
    })`,
    lien: `/matieres?classe=${m.classe.id}`,
  });
  res.status(201).json(m);
});

matieres.put('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const actuelle = await prisma.matiere.findUniqueOrThrow({ where: { id }, include: inclure });
  if (actuelle.classeId !== data.classeId && (await prisma.note.count({ where: { matiereId: id } }))) {
    throw conflit('Cette matière a déjà des notes : on ne peut plus la changer de classe.');
  }
  await verifierGroupe(data.groupeId, data.classeId);
  await verifierProfesseur(data.professeurId);
  const m = await prisma.matiere.update({ where: { id }, data, include: inclure });
  const prof = (p: typeof m.professeur) => (p ? `${p.prenom} ${p.nom}` : 'aucun');
  const changements = [
    actuelle.nom !== m.nom && `renommée ${m.nom}`,
    actuelle.classeId !== m.classeId && `déplacée en ${m.classe.nom}`,
    actuelle.coefficient !== m.coefficient && `coefficient ${actuelle.coefficient} → ${m.coefficient}`,
    actuelle.groupeId !== m.groupeId && `groupe ${m.groupe.nom}`,
    actuelle.professeurId !== m.professeurId && `professeur : ${prof(m.professeur)}`,
  ].filter(Boolean);
  await consigner(req, {
    domaine: 'ORGANISATION',
    action: 'matiere.modifier',
    annulation: { id, avant: champs(actuelle), apres: champs(m) },
    libelle: `Modification de la matière ${actuelle.nom} en ${actuelle.classe.nom}${changements.length ? ` : ${changements.join(', ')}` : ''}`,
    lien: `/matieres?classe=${m.classe.id}`,
  });
  res.json(m);
});

// Supprimer une matière supprime ses notes : l'interface demande une confirmation explicite.
matieres.delete('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const notes = await prisma.note.count({ where: { matiereId: id } });
  if (notes && req.query.confirmer !== 'oui') {
    throw conflit(`Cette matière a ${notes} note(s). Confirmez pour la supprimer avec ses notes.`);
  }
  const m = await prisma.matiere.delete({ where: { id }, include: { classe: { select: { id: true, nom: true } } } });
  await consigner(req, {
    domaine: 'ORGANISATION',
    action: 'matiere.supprimer',
    annulation: { ...champs(m), notes },
    libelle: `Suppression de la matière ${m.nom} en ${m.classe.nom}${notes ? ` et de ses ${notes} note(s)` : ''}`,
    lien: `/matieres?classe=${m.classe.id}`,
  });
  res.status(204).end();
});
