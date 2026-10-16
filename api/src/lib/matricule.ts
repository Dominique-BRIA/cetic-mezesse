import type { Prisma } from '@prisma/client';

// Matricule scolaire : préfixe de l'établissement + 2 chiffres de l'année d'entrée + rang à 4 chiffres,
// par exemple CTM26-0007. Le compteur est incrémenté atomiquement par PostgreSQL.
export async function nouveauMatricule(
  tx: Prisma.TransactionClient,
  prefixe: string,
  libelleAnnee: string,
): Promise<string> {
  const aa = libelleAnnee.slice(2, 4);
  const cle = `matricule-${prefixe}-${aa}`;
  const c = await tx.compteur.upsert({
    where: { cle },
    create: { cle, valeur: 1 },
    update: { valeur: { increment: 1 } },
  });
  return `${prefixe}${aa}-${String(c.valeur).padStart(4, '0')}`;
}
