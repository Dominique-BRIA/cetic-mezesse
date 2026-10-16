import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authentifier, session, signerJeton } from '../lib/auth';
import { ErreurHttp, invalide } from '../lib/erreurs';

export const auth = Router();

const limiteConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

export const profilPublic = {
  id: true,
  nom: true,
  prenom: true,
  telephone: true,
  email: true,
  role: true,
  actif: true,
  doitChangerMotDePasse: true,
  discipline: true,
} as const;

auth.post('/connexion', limiteConnexion, async (req, res) => {
  const { identifiant, motDePasse } = z
    .object({ identifiant: z.string().trim().min(1), motDePasse: z.string().min(1) })
    .parse(req.body);
  // L'identifiant est un e-mail ou un numéro de téléphone.
  const id = identifiant.includes('@') ? identifiant.toLowerCase() : identifiant.replace(/[\s.-]/g, '');
  const u = await prisma.utilisateur.findFirst({ where: { OR: [{ email: id }, { telephone: id }] } });
  if (!u || !(await bcrypt.compare(motDePasse, u.motDePasse))) {
    throw new ErreurHttp(401, 'Identifiant ou mot de passe incorrect.');
  }
  if (!u.actif) throw new ErreurHttp(403, 'Ce compte est désactivé.');
  const jeton = signerJeton({ id: u.id, role: u.role, nom: u.nom, prenom: u.prenom });
  const { motDePasse: _, ...profil } = u;
  res.json({ jeton, utilisateur: profil });
});

auth.get('/moi', authentifier, async (req, res) => {
  const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: session(req).id }, select: profilPublic });
  res.json(u);
});

auth.post('/mot-de-passe', authentifier, async (req, res) => {
  const { ancien, nouveau } = z
    .object({ ancien: z.string().min(1), nouveau: z.string().min(8, 'au moins 8 caractères').max(100) })
    .parse(req.body);
  if (nouveau === 'password') throw invalide('Choisissez un mot de passe différent de « password ».');
  const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: session(req).id } });
  if (!(await bcrypt.compare(ancien, u.motDePasse))) throw invalide('Mot de passe actuel incorrect.');
  await prisma.utilisateur.update({
    where: { id: u.id },
    data: { motDePasse: await bcrypt.hash(nouveau, 10), doitChangerMotDePasse: false },
  });
  res.json({ message: 'Mot de passe modifié.' });
});
