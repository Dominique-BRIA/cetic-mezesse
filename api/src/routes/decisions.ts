import { Router } from 'express';
import { z } from 'zod';
import type { Decision, DomaineDecision, Prisma, StatutDecision } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { roles, session } from '../lib/auth';
import { texte } from '../lib/validation';
import { conflit } from '../lib/erreurs';
import { DELAI_DESAPPROBATION_JOURS, dansLeDelai, limiteDesapprobation } from '../lib/decisions';
import { supprimer } from '../lib/stockage';
import { EFFETS, annuler } from '../services/annulation';
import { notifier } from '../lib/notifications';

// Journal des décisions du SG, réservé au Proviseur (RG-30).
export const decisions = Router();
decisions.use(roles('PROVISEUR'));

const PAR_PAGE = 50;
const personne = { select: { id: true, nom: true, prenom: true } } as const;
const inclure = { auteur: personne, desapprouveePar: personne } as const;

// Les données d'annulation restent côté serveur (elles peuvent contenir une empreinte de mot de passe).
function presenter<T extends Decision>({ annulation, ...d }: T) {
  const a = annulation as { effet?: string } | null;
  return {
    ...d,
    limite: limiteDesapprobation(d.creeLe),
    modifiable: d.statut === 'APPROUVEE' && dansLeDelai(d.creeLe),
    effetPrevu: a ? (EFFETS[d.action] ?? null) : null,
    effet: a?.effet ?? null,
  };
}

const filtres = z.object({
  domaine: z.enum(['ORGANISATION', 'SCOLARITE', 'ADMINISTRATION']).optional(),
  statut: z.enum(['APPROUVEE', 'DESAPPROUVEE', 'EN_DELAI']).optional(),
  q: z.string().trim().max(100).optional(),
  apres: z.string().optional(), // curseur : id de la dernière décision reçue
});

decisions.get('/', async (req, res) => {
  const f = filtres.parse(req.query);
  const debutDelai = new Date(Date.now() - DELAI_DESAPPROBATION_JOURS * 24 * 60 * 60 * 1000);
  const where: Prisma.DecisionWhereInput = {
    ...(f.domaine ? { domaine: f.domaine as DomaineDecision } : {}),
    ...(f.statut === 'EN_DELAI'
      ? { statut: 'APPROUVEE', creeLe: { gte: debutDelai } }
      : f.statut
        ? { statut: f.statut as StatutDecision }
        : {}),
    ...(f.q ? { libelle: { contains: f.q, mode: 'insensitive' } } : {}),
  };
  const lignes = await prisma.decision.findMany({
    where,
    include: inclure,
    orderBy: [{ creeLe: 'desc' }, { id: 'desc' }],
    take: PAR_PAGE + 1,
    ...(f.apres ? { cursor: { id: f.apres }, skip: 1 } : {}),
  });
  const [enDelai, desapprouvees] = await Promise.all([
    prisma.decision.count({ where: { statut: 'APPROUVEE', creeLe: { gte: debutDelai } } }),
    prisma.decision.count({ where: { statut: 'DESAPPROUVEE' } }),
  ]);
  res.json({
    decisions: lignes.slice(0, PAR_PAGE).map(presenter),
    suivant: lignes.length > PAR_PAGE ? lignes[PAR_PAGE - 1].id : null,
    totaux: { enDelai, desapprouvees },
    delaiJours: DELAI_DESAPPROBATION_JOURS,
  });
});

// Désapprouver défait l'action dans la même transaction : si elle ne peut plus être défaite,
// rien n'est enregistré et le Proviseur reçoit la raison. La désapprobation est définitive.
decisions.post('/:id/desapprouver', async (req, res) => {
  const id = String(req.params.id);
  const { motif } = z.object({ motif: texte(500) }).parse(req.body);
  const { decision, fichiers } = await prisma.$transaction(
    async (tx) => {
      const d = await tx.decision.findUniqueOrThrow({ where: { id } });
      if (d.statut === 'DESAPPROUVEE') throw conflit('Cette décision est déjà désapprouvée.');
      if (!dansLeDelai(d.creeLe)) {
        throw conflit(`Le délai de ${DELAI_DESAPPROBATION_JOURS / 7} semaines est dépassé : la décision reste approuvée.`);
      }
      const donnees = d.annulation as Record<string, unknown> | null;
      const resultat = donnees ? await annuler(tx, d.action, donnees) : null;
      const maj = await tx.decision.update({
        where: { id },
        data: {
          statut: 'DESAPPROUVEE',
          desapprouveeLe: new Date(),
          desapprouveeParId: session(req).id,
          motifDesapprobation: motif,
          annulee: Boolean(resultat),
          ...(resultat ? { annulation: { ...donnees, effet: resultat.effet } as Prisma.InputJsonObject } : {}),
        },
        include: inclure,
      });
      // Le SG est prévenu : motif du Proviseur et ce qui a été défait.
      await notifier(
        [d.auteurId],
        {
          titre: 'Décision désapprouvée',
          message: `Le Proviseur a désapprouvé : « ${d.libelle} ». Motif : ${motif}${resultat ? ` ${resultat.effet}` : ''}`,
          lien: resultat ? d.lien : null,
        },
        tx,
      );
      return { decision: maj, fichiers: resultat?.fichiersASupprimer ?? [] };
    },
    { timeout: 30_000 },
  );
  for (const f of fichiers) await supprimer(f).catch(() => undefined);
  res.json(presenter(decision));
});
