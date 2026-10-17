import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authentifier, session, signerJeton } from '../lib/auth';
import { conflit, ErreurHttp, invalide } from '../lib/erreurs';
import { telephone, texte, texteOptionnel } from '../lib/validation';

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

// Espace profil : chacun modifie ses propres informations. Changer le téléphone ou l'e-mail,
// qui servent d'identifiant de connexion, demande le mot de passe actuel.
auth.put('/moi', authentifier, async (req, res) => {
  const vide = z.literal('').transform(() => null);
  const data = z
    .object({
      nom: texte(60),
      prenom: texte(80),
      telephone: telephone.optional().nullable().or(vide),
      email: z.string().trim().toLowerCase().email('adresse e-mail invalide').optional().nullable().or(vide),
      discipline: texteOptionnel(80),
      motDePasse: z.string().optional(),
    })
    .refine((u) => u.telephone || u.email, { message: 'renseignez un téléphone ou un e-mail', path: ['telephone'] })
    .parse(req.body);
  const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: session(req).id } });
  const telephoneNouveau = data.telephone ?? null;
  const emailNouveau = data.email ?? null;
  if (telephoneNouveau !== u.telephone || emailNouveau !== u.email) {
    if (!data.motDePasse || !(await bcrypt.compare(data.motDePasse, u.motDePasse))) {
      throw invalide('Pour changer de téléphone ou d’e-mail, saisissez votre mot de passe actuel.');
    }
  }
  const pris = await prisma.utilisateur.findFirst({
    where: {
      id: { not: u.id },
      OR: [...(telephoneNouveau ? [{ telephone: telephoneNouveau }] : []), ...(emailNouveau ? [{ email: emailNouveau }] : [])],
    },
    select: { telephone: true },
  });
  if (pris) {
    throw conflit(pris.telephone === telephoneNouveau ? 'Ce numéro est déjà utilisé par un autre compte.' : 'Cette adresse e-mail est déjà utilisée par un autre compte.');
  }
  const maj = await prisma.utilisateur.update({
    where: { id: u.id },
    data: {
      nom: data.nom,
      prenom: data.prenom,
      telephone: telephoneNouveau,
      email: emailNouveau,
      // La discipline n'a de sens que pour un professeur.
      ...(u.role === 'PROFESSEUR' ? { discipline: data.discipline } : {}),
    },
    select: profilPublic,
  });
  res.json(maj);
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
