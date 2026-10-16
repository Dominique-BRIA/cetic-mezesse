import type { Request } from 'express';
import { prisma } from './prisma';
import { ErreurHttp } from './erreurs';

// Année demandée (?anneeId=) ou, à défaut, l'année active.
export async function anneeDe(req: Request): Promise<string> {
  const demandee = req.query.anneeId as string | undefined;
  if (demandee) return demandee;
  const active = await prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true } });
  if (!active) throw new ErreurHttp(409, "Aucune année scolaire active : le Surveillant Général doit en créer une.");
  return active.id;
}
