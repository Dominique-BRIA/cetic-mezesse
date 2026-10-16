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
import { consigner } from '../lib/decisions';
import { profilPublic } from './auth';

export const utilisateurs = Router();

// Champs qu'une désapprobation remet en l'état (services/annulation.ts).
const champs = (u: { nom: string; prenom: string; telephone: string | null; email: string | null; discipline: string | null; actif: boolean }) => ({
  nom: u.nom,
  prenom: u.prenom,
  telephone: u.telephone,
  email: u.email,
  discipline: u.discipline,
  actif: u.actif,
});

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
  await consigner(req, {
    domaine: 'ORGANISATION',
    action: 'enseignant.creer',
    annulation: { id: u.id },
    libelle: `Création du compte de l'enseignant ${u.prenom} ${u.nom}${u.discipline ? ` (${u.discipline})` : ''}`,
    lien: '/enseignants',
  });
  res.status(201).json(u);
});

utilisateurs.put('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const cible = await prisma.utilisateur.findUniqueOrThrow({ where: { id } });
  if (cible.role === 'PROVISEUR') throw interdit('Le compte du Proviseur ne se modifie pas ici.');
  if (id === session(req).id && !data.actif) throw invalide('Vous ne pouvez pas désactiver votre propre compte.');
  const u = await prisma.utilisateur.update({ where: { id }, data, select: profilPublic });
  const quoi = cible.actif && !u.actif ? 'Désactivation' : !cible.actif && u.actif ? 'Réactivation' : 'Modification';
  await consigner(req, {
    domaine: 'ORGANISATION',
    action: `enseignant.${quoi === 'Modification' ? 'modifier' : quoi === 'Désactivation' ? 'desactiver' : 'reactiver'}`,
    libelle: `${quoi} du compte de ${u.prenom} ${u.nom}`,
    annulation: { id, avant: champs(cible), apres: champs(u) },
    lien: '/enseignants',
  });
  res.json(u);
});

utilisateurs.post('/:id/reinitialiser', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const cible = await prisma.utilisateur.findUniqueOrThrow({ where: { id } });
  if (cible.role === 'PROVISEUR') throw interdit('Le mot de passe du Proviseur ne se réinitialise pas ici.');
  const maj = await prisma.utilisateur.update({
    where: { id },
    data: { motDePasse: await bcrypt.hash(config.motDePasseReinitialise, 10), doitChangerMotDePasse: true },
  });
  await consigner(req, {
    domaine: 'ORGANISATION',
    action: 'enseignant.reinitialiser',
    annulation: { id, avantHash: cible.motDePasse, avantDoitChanger: cible.doitChangerMotDePasse, apresHash: maj.motDePasse },
    libelle: `Réinitialisation du mot de passe de ${cible.prenom} ${cible.nom}`,
    lien: '/enseignants',
  });
  res.json({ message: `Mot de passe réinitialisé à « ${config.motDePasseReinitialise} ».` });
});
