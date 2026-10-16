// Charge depuis la base tout ce qu'il faut pour calculer les résultats d'une classe.
import { prisma } from '../lib/prisma';
import {
  calculerResultats,
  sequencesDe,
  type CodePeriode,
  type MatiereEntree,
  type ResultatsClasse,
  type Seuil,
} from '../calcul/resultats';

export interface Baremes {
  grades: Seuil[];
  cotes: Seuil[];
}

export async function chargerBaremes(): Promise<Baremes> {
  const lignes = await prisma.bareme.findMany();
  const conv = (t: 'GRADE' | 'COTE') =>
    lignes.filter((l) => l.type === t).map((l) => ({ libelle: l.libelle, libelleLong: l.libelleLong, min: Number(l.min) }));
  return { grades: conv('GRADE'), cotes: conv('COTE') };
}

export async function resultatsClasse(classeId: string, periode: CodePeriode, baremes?: Baremes) {
  const classe = await prisma.classe.findUniqueOrThrow({
    where: { id: classeId },
    include: {
      annee: true,
      profPrincipal: { select: { nom: true, prenom: true } },
      matieres: {
        include: { groupe: true, professeur: { select: { nom: true, prenom: true } } },
      },
    },
  });
  const inscriptions = await prisma.inscription.findMany({
    where: { classeId, statut: 'ACTIF' },
    include: { eleve: true },
    orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
  });
  const notes = await prisma.note.findMany({
    where: {
      matiere: { classeId },
      inscription: { statut: 'ACTIF' },
      sequence: { numero: { in: sequencesDe(periode) } },
    },
    select: { inscriptionId: true, matiereId: true, valeur: true, sequence: { select: { numero: true } } },
  });
  const b = baremes ?? (await chargerBaremes());

  const matieres: MatiereEntree[] = classe.matieres.map((m) => ({
    id: m.id,
    nom: m.nom,
    nomEn: m.nomEn,
    coefficient: m.coefficient,
    ordre: m.ordre,
    groupe: { id: m.groupe.id, nom: m.groupe.nom, nomEn: m.groupe.nomEn, ordre: m.groupe.ordre },
    professeur: m.professeur ? `${m.professeur.prenom} ${m.professeur.nom}` : null,
  }));

  const resultats: ResultatsClasse = calculerResultats({
    periode,
    matieres,
    inscriptions: inscriptions.map((i) => i.id),
    notes: notes.map((n) => ({
      inscriptionId: n.inscriptionId,
      matiereId: n.matiereId,
      sequence: n.sequence.numero,
      valeur: Number(n.valeur),
    })),
    grades: b.grades,
    cotes: b.cotes,
  });

  return { classe, inscriptions, resultats, baremes: b };
}

export type DonneesClasse = Awaited<ReturnType<typeof resultatsClasse>>;
