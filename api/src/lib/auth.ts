import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config';
import { prisma } from './prisma';
import { ErreurHttp, interdit } from './erreurs';

export interface Session {
  id: string;
  role: Role;
  nom: string;
  prenom: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export function signerJeton(s: Session): string {
  return jwt.sign(s, config.jwtSecret, { expiresIn: config.dureeJeton });
}

// Vérifie le jeton et que le compte est toujours actif (un compte désactivé perd l'accès immédiatement).
export const authentifier: RequestHandler = async (req, _res, next) => {
  const entete = req.headers.authorization;
  const jeton = entete?.startsWith('Bearer ') ? entete.slice(7) : (req.query.jeton as string | undefined);
  if (!jeton) throw new ErreurHttp(401, 'Connexion requise.');
  let s: Session;
  try {
    s = jwt.verify(jeton, config.jwtSecret) as Session;
  } catch {
    throw new ErreurHttp(401, 'Session expirée, reconnectez-vous.');
  }
  const u = await prisma.utilisateur.findUnique({ where: { id: s.id }, select: { actif: true, role: true } });
  if (!u || !u.actif) throw new ErreurHttp(401, 'Compte désactivé.');
  req.session = { id: s.id, role: u.role, nom: s.nom, prenom: s.prenom };
  next();
};

export const roles =
  (...autorises: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.session || !autorises.includes(req.session.role)) throw interdit();
    next();
  };

export function session(req: Request): Session {
  if (!req.session) throw new ErreurHttp(401, 'Connexion requise.');
  return req.session;
}

export const DIRECTION: Role[] = ['PROVISEUR', 'SURVEILLANT_GENERAL'];
