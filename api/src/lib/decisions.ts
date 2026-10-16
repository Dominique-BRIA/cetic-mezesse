import type { Request } from 'express';
import type { DomaineDecision, Prisma } from '@prisma/client';
import { prisma } from './prisma';

// Journal des décisions (RG-30) : chaque décision du SG est approuvée d'office ; le Proviseur
// peut la désapprouver pendant 4 semaines, après quoi elle reste approuvée.

export const DELAI_DESAPPROBATION_JOURS = 28;
const JOUR = 24 * 60 * 60 * 1000;

export function limiteDesapprobation(creeLe: Date): Date {
  return new Date(creeLe.getTime() + DELAI_DESAPPROBATION_JOURS * JOUR);
}

export function dansLeDelai(creeLe: Date, maintenant = new Date()): boolean {
  return maintenant.getTime() <= limiteDesapprobation(creeLe).getTime();
}

// N'enregistre que les décisions du SG ; à appeler une fois l'action réussie
// (ou dans sa transaction, pour qu'elles soient validées ou annulées ensemble).
export async function consigner(
  req: Request,
  decision: {
    domaine: DomaineDecision;
    action: string;
    libelle: string;
    lien?: string | null;
    annulation?: Prisma.InputJsonObject; // de quoi défaire l'action (services/annulation.ts)
  },
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  const s = req.session;
  if (s?.role !== 'SURVEILLANT_GENERAL') return;
  await client.decision.create({
    data: { ...decision, libelle: decision.libelle.slice(0, 1000), auteurId: s.id },
  });
}
