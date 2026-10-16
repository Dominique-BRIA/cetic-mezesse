import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles } from '../lib/auth';
import { texte, texteOptionnel } from '../lib/validation';
import { conflit } from '../lib/erreurs';
import { decrireRenommages, renommerGroupe, type Renommage } from '../lib/classes';
import { consigner } from '../lib/decisions';

// Spécialités des classes, créées par le SG et communes à toutes les années (RG-29).
export const specialites = Router();

specialites.get('/', roles(...DIRECTION), async (_req, res) => {
  res.json(await prisma.specialite.findMany({ include: { _count: { select: { classes: true } } }, orderBy: { nom: 'asc' } }));
});

const schema = z.object({ nom: texte(60), nomEn: texteOptionnel(60) });

specialites.post('/', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const data = schema.parse(req.body);
  const s = await prisma.$transaction(async (tx) => {
    const cree = await tx.specialite.create({ data, include: { _count: { select: { classes: true } } } });
    await consigner(
      req,
      {
        domaine: 'ORGANISATION',
        action: 'specialite.creer',
        libelle: `Création de la spécialité ${cree.nom}`,
        lien: '/classes',
        annulation: { id: cree.id },
      },
      tx,
    );
    return cree;
  });
  res.status(201).json(s);
});

// Renommer une spécialité renomme les classes qui la portent, toutes années confondues.
specialites.put('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const s = await prisma.$transaction(
    async (tx) => {
      const avant = await tx.specialite.findUniqueOrThrow({ where: { id } });
      const maj = await tx.specialite.update({ where: { id }, data, include: { _count: { select: { classes: true } } } });
      const groupes = await tx.classe.findMany({
        where: { specialiteId: id },
        distinct: ['anneeId', 'niveau'],
        select: { anneeId: true, niveau: true },
      });
      const renommees: Renommage[] = [];
      for (const g of groupes) renommees.push(...(await renommerGroupe(tx, g.anneeId, g.niveau, id)));
      await consigner(
        req,
        {
          domaine: 'ORGANISATION',
          action: 'specialite.modifier',
          libelle:
            avant.nom === maj.nom
              ? `Modification de la spécialité ${maj.nom}`
              : `Spécialité ${avant.nom} renommée en ${maj.nom}${decrireRenommages(renommees)}`,
          lien: '/classes',
          annulation: { id, avant: { nom: avant.nom, nomEn: avant.nomEn }, apres: { nom: maj.nom, nomEn: maj.nomEn } },
        },
        tx,
      );
      return maj;
    },
    { timeout: 30_000 },
  );
  res.json(s);
});

specialites.delete('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  await prisma.$transaction(async (tx) => {
    const s = await tx.specialite.findUniqueOrThrow({ where: { id }, include: { _count: { select: { classes: true } } } });
    if (s._count.classes) throw conflit(`La spécialité ${s.nom} est portée par ${s._count.classes} classe(s) : elle ne peut pas être supprimée.`);
    await tx.specialite.delete({ where: { id } });
    await consigner(
      req,
      {
        domaine: 'ORGANISATION',
        action: 'specialite.supprimer',
        libelle: `Suppression de la spécialité ${s.nom}`,
        lien: '/classes',
        annulation: { nom: s.nom, nomEn: s.nomEn },
      },
      tx,
    );
  });
  res.status(204).end();
});
