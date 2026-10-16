import type { Prisma } from '@prisma/client';

// Nom des classes (RG-29) : « 1re année Mécanique A ». La lettre n'apparaît que lorsque le niveau
// et la spécialité comptent plusieurs classes dans l'année ; elle suit l'ordre de création (numero).

export function ordinal(niveau: number): string {
  return niveau === 1 ? '1re' : `${niveau}e`;
}

export function lettre(rang: number): string {
  return rang < 26 ? String.fromCharCode(65 + rang) : String(rang + 1);
}

export interface SpecialiteNom {
  nom: string;
  nomEn: string | null;
}

export function nomsClasses(niveau: number, specialite: SpecialiteNom | null, nombre: number) {
  return Array.from({ length: nombre }, (_, i) => {
    const suffixe = nombre > 1 ? ` ${lettre(i)}` : '';
    return {
      nom: `${ordinal(niveau)} année${specialite ? ` ${specialite.nom}` : ''}${suffixe}`,
      nomEn: `Year ${niveau}${specialite ? ` ${specialite.nomEn ?? specialite.nom}` : ''}${suffixe}`,
    };
  });
}

export interface Renommage {
  avant: string;
  apres: string;
}

// Recalcule les noms des classes d'un même niveau et d'une même spécialité. Deux passes pour
// ne pas heurter l'unicité du nom dans l'année quand les lettres se décalent (B devient A).
export async function renommerGroupe(
  tx: Prisma.TransactionClient,
  anneeId: string,
  niveau: number,
  specialiteId: string | null,
): Promise<Renommage[]> {
  const classes = await tx.classe.findMany({
    where: { anneeId, niveau, specialiteId },
    orderBy: [{ numero: 'asc' }, { nom: 'asc' }],
    select: { id: true, nom: true },
  });
  if (!classes.length) return [];
  const specialite = specialiteId
    ? await tx.specialite.findUniqueOrThrow({ where: { id: specialiteId }, select: { nom: true, nomEn: true } })
    : null;
  const noms = nomsClasses(niveau, specialite, classes.length);
  const changees = classes.map((c, i) => ({ ...c, ...noms[i], numero: i + 1 }));
  for (const c of changees) await tx.classe.update({ where: { id: c.id }, data: { nom: `…${c.id}` } });
  for (const c of changees) {
    await tx.classe.update({ where: { id: c.id }, data: { nom: c.nom, nomEn: c.nomEn, numero: c.numero } });
  }
  return classes
    .map((c, i) => ({ avant: c.nom, apres: noms[i].nom }))
    .filter((r) => r.avant !== r.apres && !r.avant.startsWith('…'));
}

// Numéro de la classe ajoutée à un niveau et une spécialité : elle prend la dernière lettre.
export async function numeroSuivant(
  tx: Prisma.TransactionClient,
  anneeId: string,
  niveau: number,
  specialiteId: string | null,
): Promise<number> {
  const max = await tx.classe.aggregate({ where: { anneeId, niveau, specialiteId }, _max: { numero: true } });
  return (max._max.numero ?? 0) + 1;
}

export function decrireRenommages(r: Renommage[]): string {
  return r.length ? ` ; ${r.map((x) => `${x.avant} devient ${x.apres}`).join(', ')}` : '';
}
