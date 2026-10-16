import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles } from '../lib/auth';
import { anneeDe } from '../lib/annee';
import { texte, texteOptionnel } from '../lib/validation';
import { conflit } from '../lib/erreurs';

export const groupes = Router();

const inclure = {
  classes: { select: { id: true, nom: true }, orderBy: { niveau: 'asc' } },
  _count: { select: { matieres: true } },
} as const;

groupes.get('/', roles(...DIRECTION), async (req, res) => {
  const anneeId = await anneeDe(req);
  res.json(await prisma.groupeMatiere.findMany({ where: { anneeId }, include: inclure, orderBy: { ordre: 'asc' } }));
});

const schema = z.object({
  nom: texte(80),
  nomEn: texteOptionnel(80),
  ordre: z.number().int().min(1).max(20),
  classeIds: z.array(z.string()).min(1, 'choisissez au moins une classe'),
});

groupes.post('/', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const { classeIds, ...data } = schema.parse(req.body);
  const anneeId = await anneeDe(req);
  res.status(201).json(
    await prisma.groupeMatiere.create({
      data: { ...data, anneeId, classes: { connect: classeIds.map((id) => ({ id })) } },
      include: inclure,
    }),
  );
});

groupes.put('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const { classeIds, ...data } = schema.parse(req.body);
  // On ne retire pas une classe dont des matières sont encore rangées dans ce groupe.
  const bloquantes = await prisma.matiere.findMany({
    where: { groupeId: id, classeId: { notIn: classeIds } },
    select: { classe: { select: { nom: true } } },
    distinct: ['classeId'],
  });
  if (bloquantes.length) {
    throw conflit(
      `Des matières de ${bloquantes.map((b) => b.classe.nom).join(', ')} sont dans ce groupe : changez-les de groupe d'abord.`,
    );
  }
  res.json(
    await prisma.groupeMatiere.update({
      where: { id },
      data: { ...data, classes: { set: classeIds.map((c) => ({ id: c })) } },
      include: inclure,
    }),
  );
});

groupes.delete('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  if (await prisma.matiere.count({ where: { groupeId: id } })) {
    throw conflit("Ce groupe contient des matières : déplacez-les ou supprimez-les d'abord.");
  }
  await prisma.groupeMatiere.delete({ where: { id } });
  res.status(204).end();
});
