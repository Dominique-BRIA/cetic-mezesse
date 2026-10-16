import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles, session } from '../lib/auth';
import { anneeDe } from '../lib/annee';
import { texte, texteOptionnel } from '../lib/validation';
import { introuvable } from '../lib/erreurs';

export const classes = Router();

const inclure = {
  profPrincipal: { select: { id: true, nom: true, prenom: true } },
  groupes: { select: { id: true, nom: true }, orderBy: { ordre: 'asc' } },
  _count: { select: { matieres: true, inscriptions: { where: { statut: 'ACTIF' } } } },
} as const;

// Un professeur ne voit que les classes où il enseigne.
classes.get('/', async (req, res) => {
  const s = session(req);
  const anneeId = await anneeDe(req);
  res.json(
    await prisma.classe.findMany({
      where: { anneeId, ...(s.role === 'PROFESSEUR' ? { matieres: { some: { professeurId: s.id } } } : {}) },
      include: inclure,
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    }),
  );
});

classes.get('/:id', roles(...DIRECTION), async (req, res) => {
  const c = await prisma.classe.findUnique({ where: { id: String(req.params.id) }, include: inclure });
  if (!c) throw introuvable('Classe');
  res.json(c);
});

const schema = z.object({
  nom: texte(60),
  nomEn: texteOptionnel(60),
  niveau: z.number().int().min(1).max(7),
  specialite: texteOptionnel(80),
  profPrincipalId: z.string().optional().nullable(),
});

classes.post('/', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const data = schema.parse(req.body);
  const anneeId = await anneeDe(req);
  res.status(201).json(await prisma.classe.create({ data: { ...data, anneeId }, include: inclure }));
});

classes.put('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const data = schema.parse(req.body);
  res.json(await prisma.classe.update({ where: { id: String(req.params.id) }, data, include: inclure }));
});
