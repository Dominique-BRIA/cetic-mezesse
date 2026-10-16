import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { roles } from '../lib/auth';
import { texte, texteOptionnel } from '../lib/validation';
import { invalide } from '../lib/erreurs';

export const etablissement = Router();

etablissement.get('/', async (_req, res) => {
  res.json(await prisma.etablissement.findUnique({ where: { id: 1 } }));
});

etablissement.put('/', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const data = z
    .object({
      nomFr: texte(200),
      nomEn: texte(200),
      sigle: texte(30),
      regionFr: texte(),
      regionEn: texte(),
      departementFr: texte(),
      departementEn: texte(),
      arrondissement: texte(),
      localite: texte(),
      code: texte(60),
      boitePostale: texteOptionnel(60),
      telephone: texteOptionnel(30),
      prefixeMatricule: z.string().trim().regex(/^[A-Z0-9]{2,6}$/, '2 à 6 lettres ou chiffres majuscules'),
    })
    .parse(req.body);
  res.json(await prisma.etablissement.upsert({ where: { id: 1 }, create: data, update: data }));
});

export const baremes = Router();

baremes.get('/', async (_req, res) => {
  const lignes = await prisma.bareme.findMany({ orderBy: [{ type: 'asc' }, { min: 'desc' }] });
  res.json(lignes.map((b) => ({ ...b, min: Number(b.min) })));
});

// Le SG remplace tout un barème d'un coup (grades ou cotes).
baremes.put('/:type', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const type = z.enum(['GRADE', 'COTE']).parse(req.params.type);
  const seuils = z
    .array(z.object({ libelle: texte(10), libelleLong: texteOptionnel(80), min: z.number().min(0).max(20) }))
    .min(2)
    .parse(req.body);
  if (!seuils.some((s) => s.min === 0)) invalideSansZero();
  if (new Set(seuils.map((s) => s.min)).size !== seuils.length) throw invalide('Deux mentions ont la même borne.');
  if (new Set(seuils.map((s) => s.libelle)).size !== seuils.length) throw invalide('Deux mentions ont le même libellé.');
  await prisma.$transaction([
    prisma.bareme.deleteMany({ where: { type } }),
    prisma.bareme.createMany({ data: seuils.map((s) => ({ ...s, type })) }),
  ]);
  res.json({ message: 'Barème enregistré.' });
});

function invalideSansZero(): never {
  throw invalide('Une mention doit commencer à 0 pour que toute note en reçoive une.');
}
