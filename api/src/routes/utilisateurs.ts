import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles, session } from '../lib/auth';
import { anneeDe } from '../lib/annee';
import { telephone, texte, texteOptionnel } from '../lib/validation';
import { config } from '../config';
import { interdit, invalide } from '../lib/erreurs';
import { profilPublic } from './auth';

export const utilisateurs = Router();

utilisateurs.get('/', roles(...DIRECTION), async (req, res) => {
  const role = req.query.role as Role | undefined;
  const anneeId = await anneeDe(req);
  const liste = await prisma.utilisateur.findMany({
    where: role ? { role } : {},
    select: {
      ...profilPublic,
      creeLe: true,
      matieres: {
        where: { classe: { anneeId } },
        select: { id: true, nom: true, coefficient: true, classe: { select: { id: true, nom: true } } },
        orderBy: { classe: { niveau: 'asc' } },
      },
      classesPrincipales: { where: { anneeId }, select: { id: true, nom: true } },
    },
    orderBy: [{ role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
  });
  res.json(liste);
});

const vide = z.literal('').transform(() => null);

const schema = z
  .object({
    nom: texte(60),
    prenom: texte(80),
    telephone: telephone.optional().nullable().or(vide),
    email: z.string().trim().toLowerCase().email('adresse e-mail invalide').optional().nullable().or(vide),
    discipline: texteOptionnel(80),
    actif: z.boolean().default(true),
  })
  .refine((u) => u.telephone || u.email, { message: 'renseignez un téléphone ou un e-mail', path: ['telephone'] });

// Le SG crée les comptes des professeurs. Le compte reçoit le mot de passe par défaut
// et doit le changer à la première connexion.
utilisateurs.post('/', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const data = schema.parse(req.body);
  const u = await prisma.utilisateur.create({
    data: {
      ...data,
      role: 'PROFESSEUR',
      motDePasse: await bcrypt.hash(config.motDePasseReinitialise, 10),
      doitChangerMotDePasse: true,
    },
    select: profilPublic,
  });
  res.status(201).json(u);
});

utilisateurs.put('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const cible = await prisma.utilisateur.findUniqueOrThrow({ where: { id } });
  if (cible.role === 'PROVISEUR') throw interdit('Le compte du Proviseur ne se modifie pas ici.');
  if (id === session(req).id && !data.actif) throw invalide('Vous ne pouvez pas désactiver votre propre compte.');
  res.json(await prisma.utilisateur.update({ where: { id }, data, select: profilPublic }));
});

utilisateurs.post('/:id/reinitialiser', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const cible = await prisma.utilisateur.findUniqueOrThrow({ where: { id } });
  if (cible.role === 'PROVISEUR') throw interdit('Le mot de passe du Proviseur ne se réinitialise pas ici.');
  await prisma.utilisateur.update({
    where: { id },
    data: { motDePasse: await bcrypt.hash(config.motDePasseReinitialise, 10), doitChangerMotDePasse: true },
  });
  res.json({ message: `Mot de passe réinitialisé à « ${config.motDePasseReinitialise} ».` });
});
