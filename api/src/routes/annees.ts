import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { roles } from '../lib/auth';
import { conflit, introuvable } from '../lib/erreurs';

export const annees = Router();

annees.get('/', async (_req, res) => {
  res.json(
    await prisma.anneeScolaire.findMany({
      orderBy: { libelle: 'desc' },
      include: {
        sequences: { orderBy: { numero: 'asc' } },
        _count: { select: { classes: true, inscriptions: true } },
      },
    }),
  );
});

// Création d'une année : 6 séquences, et éventuellement reprise de la structure
// (groupes, classes, matières, professeurs) d'une année précédente.
annees.post('/', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const { libelle, copierDepuisId, activer } = z
    .object({
      libelle: z.string().trim().regex(/^\d{4}-\d{4}$/, 'format attendu : 2026-2027'),
      copierDepuisId: z.string().optional().nullable(),
      activer: z.boolean().default(false),
    })
    .parse(req.body);
  const [debut, fin] = libelle.split('-').map(Number);
  if (fin !== debut + 1) throw conflit("L'année de fin doit suivre l'année de début.");

  const annee = await prisma.$transaction(async (tx) => {
    const a = await tx.anneeScolaire.create({
      data: {
        libelle,
        sequences: { create: [1, 2, 3, 4, 5, 6].map((n) => ({ numero: n, trimestre: Math.ceil(n / 2) })) },
      },
    });
    if (copierDepuisId) {
      const source = await tx.anneeScolaire.findUnique({
        where: { id: copierDepuisId },
        include: { groupes: true, classes: { include: { groupes: true, matieres: true } } },
      });
      if (!source) throw introuvable('Année source');
      const groupes = new Map<string, string>();
      for (const g of source.groupes) {
        const n = await tx.groupeMatiere.create({
          data: { anneeId: a.id, nom: g.nom, nomEn: g.nomEn, ordre: g.ordre },
        });
        groupes.set(g.id, n.id);
      }
      for (const c of source.classes) {
        await tx.classe.create({
          data: {
            anneeId: a.id,
            nom: c.nom,
            nomEn: c.nomEn,
            niveau: c.niveau,
            specialite: c.specialite,
            profPrincipalId: c.profPrincipalId,
            groupes: { connect: c.groupes.map((g) => ({ id: groupes.get(g.id)! })) },
            matieres: {
              create: c.matieres.map((m) => ({
                nom: m.nom,
                nomEn: m.nomEn,
                coefficient: m.coefficient,
                ordre: m.ordre,
                professeurId: m.professeurId,
                groupeId: groupes.get(m.groupeId)!,
              })),
            },
          },
        });
      }
    }
    if (activer) {
      await tx.anneeScolaire.updateMany({ where: { id: { not: a.id } }, data: { active: false } });
      await tx.anneeScolaire.update({ where: { id: a.id }, data: { active: true } });
    }
    return a;
  });
  res.status(201).json(annee);
});

annees.post('/:id/activer', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  await prisma.$transaction([
    prisma.anneeScolaire.updateMany({ where: { id: { not: id } }, data: { active: false } }),
    prisma.anneeScolaire.update({ where: { id }, data: { active: true } }),
  ]);
  res.json({ message: 'Année activée.' });
});

// Ouverture / fermeture de la saisie des notes d'une séquence.
annees.patch('/sequences/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const { saisieOuverte } = z.object({ saisieOuverte: z.boolean() }).parse(req.body);
  res.json(await prisma.sequence.update({ where: { id: String(req.params.id) }, data: { saisieOuverte } }));
});
