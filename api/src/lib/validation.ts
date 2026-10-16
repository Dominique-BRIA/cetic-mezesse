import { z } from 'zod';
import { PERIODES, type CodePeriode } from '../calcul/resultats';
import { invalide } from './erreurs';

export const texte = (max = 120) => z.string().trim().min(1, 'obligatoire').max(max);
export const texteOptionnel = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const telephone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .refine((v) => /^\+?\d{8,15}$/.test(v), 'numéro de téléphone invalide');

export function periode(v: unknown): CodePeriode {
  if (typeof v === 'string' && (PERIODES as string[]).includes(v)) return v as CodePeriode;
  throw invalide('Période invalide (S1 à S6, T1 à T3 ou A).');
}
