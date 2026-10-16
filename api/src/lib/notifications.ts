import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

// Notifications affichées dans l'application (RG-32).

type Client = Prisma.TransactionClient;

export async function notifier(
  destinataireIds: string[],
  n: { titre: string; message: string; lien?: string | null },
  client: Client = prisma,
): Promise<void> {
  const ids = [...new Set(destinataireIds)];
  if (!ids.length) return;
  await client.notification.createMany({
    data: ids.map((destinataireId) => ({ destinataireId, titre: n.titre, message: n.message.slice(0, 1000), lien: n.lien ?? null })),
  });
}

// Séquence ouverte à la saisie : chaque professeur actif qui a une matière cette année-là est prévenu.
export async function notifierOuvertureSequence(sequenceId: string, client: Client = prisma): Promise<void> {
  const s = await client.sequence.findUniqueOrThrow({ where: { id: sequenceId }, include: { annee: true } });
  const profs = await client.utilisateur.findMany({
    where: { role: 'PROFESSEUR', actif: true, matieres: { some: { classe: { anneeId: s.anneeId } } } },
    select: { id: true },
  });
  await notifier(
    profs.map((p) => p.id),
    {
      titre: `Séquence ${s.numero} ouverte`,
      message: `La saisie des notes de la séquence ${s.numero} (${s.annee.libelle}) est ouverte. Vous pouvez saisir les notes de vos matières.`,
      lien: '/saisie',
    },
    client,
  );
}
