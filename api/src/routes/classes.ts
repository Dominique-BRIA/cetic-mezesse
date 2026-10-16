import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles, session } from '../lib/auth';
import { anneeDe } from '../lib/annee';
import { conflit, introuvable } from '../lib/erreurs';
import { decrireRenommages, numeroSuivant, renommerGroupe } from '../lib/classes';
import { consigner } from '../lib/decisions';

export const classes = Router();

const inclure = {
  profPrincipal: { select: { id: true, nom: true, prenom: true } },
  specialite: { select: { id: true, nom: true, nomEn: true } },
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
      orderBy: [{ niveau: 'asc' }, { specialite: { nom: 'asc' } }, { numero: 'asc' }],
    }),
  );
});

classes.get('/:id', roles(...DIRECTION), async (req, res) => {
  const c = await prisma.classe.findUnique({ where: { id: String(req.params.id) }, include: inclure });
  if (!c) throw introuvable('Classe');
  res.json(c);
});

// Le nom n'est plus saisi : il découle du niveau, de la spécialité et de la lettre (RG-29).
const schema = z.object({
  niveau: z.number().int().min(1).max(7),
  specialiteId: z.string().min(1).nullable().optional().transform((v) => v ?? null),
  profPrincipalId: z.string().optional().nullable().transform((v) => v || null),
});

const lien = (id: string) => `/eleves?classe=${id}`;

classes.post('/', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const data = schema.parse(req.body);
  const anneeId = await anneeDe(req);
  const cree = await prisma.$transaction(async (tx) => {
    const numero = await numeroSuivant(tx, anneeId, data.niveau, data.specialiteId);
    const c = await tx.classe.create({ data: { ...data, anneeId, numero, nom: `…${randomUUID()}` } });
    const renommees = await renommerGroupe(tx, anneeId, data.niveau, data.specialiteId);
    const finale = await tx.classe.findUniqueOrThrow({ where: { id: c.id }, include: inclure });
    await consigner(
      req,
      {
        domaine: 'ORGANISATION',
        action: 'classe.creer',
        libelle: `Création de la classe ${finale.nom}${decrireRenommages(renommees)}`,
        lien: lien(c.id),
        annulation: { classeId: c.id },
      },
      tx,
    );
    return finale;
  });
  res.status(201).json(cree);
});

classes.put('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const maj = await prisma.$transaction(async (tx) => {
    const avant = await tx.classe.findUniqueOrThrow({ where: { id }, include: { profPrincipal: true } });
    const deplacee = avant.niveau !== data.niveau || avant.specialiteId !== data.specialiteId;
    await tx.classe.update({
      where: { id },
      data: {
        ...data,
        ...(deplacee ? { numero: await numeroSuivant(tx, avant.anneeId, data.niveau, data.specialiteId) } : {}),
      },
    });
    const renommees = deplacee
      ? [
          ...(await renommerGroupe(tx, avant.anneeId, avant.niveau, avant.specialiteId)),
          ...(await renommerGroupe(tx, avant.anneeId, data.niveau, data.specialiteId)),
        ]
      : [];
    const apres = await tx.classe.findUniqueOrThrow({ where: { id }, include: inclure });
    const changements = [
      ...renommees.map((r) => `${r.avant} devient ${r.apres}`),
      ...(avant.profPrincipalId !== apres.profPrincipalId
        ? [
            `professeur principal : ${apres.profPrincipal ? `${apres.profPrincipal.prenom} ${apres.profPrincipal.nom}` : 'aucun'}`,
          ]
        : []),
    ];
    await consigner(
      req,
      {
        domaine: 'ORGANISATION',
        action: 'classe.modifier',
        libelle: `Modification de la classe ${avant.nom}${changements.length ? ` : ${changements.join(', ')}` : ''}`,
        lien: lien(id),
        annulation: {
          classeId: id,
          avant: { niveau: avant.niveau, specialiteId: avant.specialiteId, profPrincipalId: avant.profPrincipalId },
          apres: { niveau: apres.niveau, specialiteId: apres.specialiteId, profPrincipalId: apres.profPrincipalId },
        },
      },
      tx,
    );
    return apres;
  });
  res.json(maj);
});

// Une classe sans élève peut être supprimée (avec ses matières) ; les lettres des autres se resserrent.
classes.delete('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  await prisma.$transaction(async (tx) => {
    const c = await tx.classe.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { inscriptions: true } }, groupes: { select: { id: true } }, matieres: true },
    });
    if (c._count.inscriptions) {
      throw conflit(`${c.nom} a ${c._count.inscriptions} élève(s) inscrit(s) : elle ne peut pas être supprimée.`);
    }
    await tx.classe.delete({ where: { id } });
    const renommees = await renommerGroupe(tx, c.anneeId, c.niveau, c.specialiteId);
    await consigner(
      req,
      {
        domaine: 'ORGANISATION',
        action: 'classe.supprimer',
        libelle: `Suppression de la classe ${c.nom}${decrireRenommages(renommees)}`,
        lien: '/classes',
        annulation: {
          anneeId: c.anneeId,
          niveau: c.niveau,
          specialiteId: c.specialiteId,
          numero: c.numero,
          profPrincipalId: c.profPrincipalId,
          groupeIds: c.groupes.map((g) => g.id),
          matieres: c.matieres.map((m) => ({
            nom: m.nom,
            nomEn: m.nomEn,
            coefficient: m.coefficient,
            ordre: m.ordre,
            groupeId: m.groupeId,
            professeurId: m.professeurId,
          })),
        },
      },
      tx,
    );
  });
  res.status(204).end();
});
