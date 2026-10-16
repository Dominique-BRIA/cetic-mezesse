import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class ErreurHttp extends Error {
  constructor(public statut: number, message: string) {
    super(message);
  }
}

export const introuvable = (quoi: string) => new ErreurHttp(404, `${quoi} introuvable.`);
export const interdit = (message = "Vous n'avez pas accès à cette ressource.") => new ErreurHttp(403, message);
export const conflit = (message: string) => new ErreurHttp(409, message);
export const invalide = (message: string) => new ErreurHttp(400, message);

// Express 5 transmet déjà les rejets de promesse ; ce gestionnaire les met en forme.
export const gestionnaireErreurs: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ErreurHttp) {
    res.status(err.statut).json({ message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const premier = err.issues[0];
    const champ = premier?.path.join('.');
    res.status(400).json({
      message: champ ? `${champ} : ${premier.message}` : (premier?.message ?? 'Données invalides.'),
      details: err.issues,
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const cible = (err.meta?.target as string[] | undefined)?.join(', ');
      res.status(409).json({ message: `Cette valeur existe déjà${cible ? ` (${cible})` : ''}.` });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Élément introuvable.' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ message: "Suppression impossible : l'élément est encore utilisé." });
      return;
    }
  }
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur.' });
};

export const routeInconnue: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Route inconnue.' });
};
