// Calcul des résultats d'une classe pour une période (séquence, trimestre ou année).
// Module pur : il ne touche pas la base, ce qui permet de le tester isolément.
//
// Règles appliquées (voir docs/REGLES-DE-GESTION.md) :
// - une matière n'est « évaluée » sur une séquence que si au moins un élève de la classe y a une note ;
//   une matière non évaluée est retirée du calcul pour tout le monde (« pas d'évaluation » au bulletin) ;
// - dans une matière évaluée, l'élève sans note a 0 ;
// - trimestre = moyenne des séquences évaluées du trimestre, année = moyenne des trimestres évalués ;
// - les rangs sont calculés sur les valeurs arrondies au centième, ex æquo compris.

export type CodePeriode = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'T1' | 'T2' | 'T3' | 'A';

export const PERIODES: CodePeriode[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'T1', 'T2', 'T3', 'A'];

export interface MatiereEntree {
  id: string;
  nom: string;
  nomEn: string | null;
  coefficient: number;
  ordre: number;
  groupe: { id: string; nom: string; nomEn: string | null; ordre: number };
  professeur: string | null;
}

export interface NoteEntree {
  inscriptionId: string;
  matiereId: string;
  sequence: number; // numéro 1 à 6
  valeur: number;
}

export interface Seuil {
  libelle: string;
  libelleLong?: string | null;
  min: number;
}

export interface Rang {
  rang: number;
  exAequo: boolean;
}

export interface LigneMatiere {
  matiereId: string;
  note: number | null; // null = matière non évaluée sur la période
  detail: (number | null)[]; // notes des séquences (trimestre) ou des trimestres (année)
  total: number | null;
  rang: Rang | null;
  grade: string | null;
}

export interface StatMatiere {
  matiere: MatiereEntree;
  evaluee: boolean;
  moyenne: number | null;
  min: number | null;
  max: number | null;
  tauxReussite: number | null; // en %
  ecartType: number | null;
  effectif: number;
}

export interface LigneGroupe {
  groupeId: string;
  coefficient: number;
  total: number;
  moyenne: number | null;
}

export interface ResultatEleve {
  inscriptionId: string;
  matieres: LigneMatiere[];
  groupes: LigneGroupe[];
  totalCoef: number;
  totalPoints: number;
  moyenne: number | null;
  rang: Rang | null;
  cote: string | null;
}

export interface ProfilClasse {
  effectif: number;
  moyenneGenerale: number | null;
  min: number | null;
  max: number | null;
  nombreMoyennes: number; // élèves à 10 ou plus
  tauxReussite: number | null;
  ecartType: number | null;
}

export interface ResultatsClasse {
  periode: CodePeriode;
  matieres: StatMatiere[];
  groupes: { id: string; nom: string; nomEn: string | null; ordre: number }[];
  eleves: ResultatEleve[];
  profil: ProfilClasse;
}

export const arrondi = (v: number) => Math.round(v * 100) / 100;

const moyenneDe = (valeurs: number[]) =>
  valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;

function ecartTypeDe(valeurs: number[]): number | null {
  const m = moyenneDe(valeurs);
  if (m === null) return null;
  return Math.sqrt(valeurs.reduce((s, v) => s + (v - m) ** 2, 0) / valeurs.length);
}

export function sequencesDe(periode: CodePeriode): number[] {
  if (periode === 'A') return [1, 2, 3, 4, 5, 6];
  const n = Number(periode.slice(1));
  return periode[0] === 'S' ? [n] : [2 * n - 1, 2 * n];
}

export function libellePeriode(periode: CodePeriode, langue: 'fr' | 'en' = 'fr'): string {
  if (periode === 'A') return langue === 'fr' ? 'Année' : 'Year';
  const n = periode.slice(1);
  if (periode[0] === 'S') return langue === 'fr' ? `Séquence ${n}` : `Sequence ${n}`;
  return langue === 'fr' ? `Trimestre ${n}` : `Term ${n}`;
}

// Mention correspondant à une valeur : le seuil le plus haut dont la borne basse est atteinte.
export function mention(valeur: number | null, seuils: Seuil[]): string | null {
  if (valeur === null) return null;
  const tries = [...seuils].sort((a, b) => b.min - a.min);
  const v = arrondi(valeur);
  return tries.find((s) => v >= s.min)?.libelle ?? null;
}

// Rangs avec ex æquo : deux valeurs identiques au centième ont le même rang.
export function classer<T>(elements: T[], valeur: (e: T) => number | null): Map<T, Rang> {
  const avecValeur = elements.filter((e) => valeur(e) !== null);
  const tries = [...avecValeur].sort((a, b) => arrondi(valeur(b)!) - arrondi(valeur(a)!));
  const rangs = new Map<T, Rang>();
  tries.forEach((e, i) => {
    const v = arrondi(valeur(e)!);
    const premier = tries.findIndex((x) => arrondi(valeur(x)!) === v);
    const nb = tries.filter((x) => arrondi(valeur(x)!) === v).length;
    rangs.set(e, { rang: premier + 1, exAequo: nb > 1 });
    void i;
  });
  return rangs;
}

export function formatRang(r: Rang | null, langue: 'fr' | 'en' = 'fr'): string {
  if (!r) return '';
  let suffixe: string;
  if (langue === 'en') {
    const d = r.rang % 10;
    const c = r.rang % 100;
    suffixe = c >= 11 && c <= 13 ? 'th' : d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
  } else {
    suffixe = r.rang === 1 ? 'er' : 'e';
  }
  return `${r.rang}${suffixe}${r.exAequo ? ' ex' : ''}`;
}

interface Entrees {
  periode: CodePeriode;
  matieres: MatiereEntree[];
  inscriptions: string[]; // élèves actifs de la classe
  notes: NoteEntree[];
  grades: Seuil[];
  cotes: Seuil[];
}

// Index des notes : matière → séquence → inscription → valeur
type Index = Map<string, Map<number, Map<string, number>>>;

function indexer(notes: NoteEntree[], inscriptions: Set<string>): Index {
  const index: Index = new Map();
  for (const n of notes) {
    if (!inscriptions.has(n.inscriptionId)) continue;
    let parSeq = index.get(n.matiereId);
    if (!parSeq) index.set(n.matiereId, (parSeq = new Map()));
    let parEleve = parSeq.get(n.sequence);
    if (!parEleve) parSeq.set(n.sequence, (parEleve = new Map()));
    parEleve.set(n.inscriptionId, n.valeur);
  }
  return index;
}

// Note d'une séquence : null si la matière n'y est pas évaluée, 0 si l'élève n'a pas de note.
function noteSequence(index: Index, matiereId: string, seq: number, inscriptionId: string): number | null {
  const parEleve = index.get(matiereId)?.get(seq);
  if (!parEleve || parEleve.size === 0) return null;
  return parEleve.get(inscriptionId) ?? 0;
}

function moyenneNonNulle(valeurs: (number | null)[]): number | null {
  const v = valeurs.filter((x): x is number => x !== null);
  return moyenneDe(v);
}

// Note de l'élève dans une matière sur la période, avec le détail affiché au bulletin.
function notePeriode(
  index: Index,
  matiereId: string,
  periode: CodePeriode,
  inscriptionId: string,
): { note: number | null; detail: (number | null)[] } {
  if (periode[0] === 'S') {
    return { note: noteSequence(index, matiereId, Number(periode.slice(1)), inscriptionId), detail: [] };
  }
  if (periode[0] === 'T') {
    const detail = sequencesDe(periode).map((s) => noteSequence(index, matiereId, s, inscriptionId));
    return { note: moyenneNonNulle(detail), detail };
  }
  const detail = (['T1', 'T2', 'T3'] as CodePeriode[]).map(
    (t) => notePeriode(index, matiereId, t, inscriptionId).note,
  );
  return { note: moyenneNonNulle(detail), detail };
}

export function calculerResultats(e: Entrees): ResultatsClasse {
  const inscriptions = new Set(e.inscriptions);
  const index = indexer(e.notes, inscriptions);
  const matieres = [...e.matieres].sort(
    (a, b) => a.groupe.ordre - b.groupe.ordre || a.ordre - b.ordre || a.nom.localeCompare(b.nom),
  );

  const groupes = [...new Map(matieres.map((m) => [m.groupe.id, m.groupe])).values()].sort(
    (a, b) => a.ordre - b.ordre,
  );

  // Notes de chaque élève dans chaque matière
  const lignes = new Map<string, Map<string, LigneMatiere>>();
  for (const ins of e.inscriptions) {
    const parMatiere = new Map<string, LigneMatiere>();
    for (const m of matieres) {
      const { note, detail } = notePeriode(index, m.id, e.periode, ins);
      parMatiere.set(m.id, {
        matiereId: m.id,
        note,
        detail,
        total: note === null ? null : note * m.coefficient,
        rang: null,
        grade: mention(note, e.grades),
      });
    }
    lignes.set(ins, parMatiere);
  }

  // Statistiques et rangs par matière
  const statsMatieres: StatMatiere[] = matieres.map((m) => {
    const lignesMatiere = e.inscriptions.map((ins) => lignes.get(ins)!.get(m.id)!);
    const valeurs = lignesMatiere.map((l) => l.note).filter((v): v is number => v !== null);
    const rangs = classer(lignesMatiere, (l) => l.note);
    for (const l of lignesMatiere) l.rang = rangs.get(l) ?? null;
    return {
      matiere: m,
      evaluee: valeurs.length > 0,
      moyenne: moyenneDe(valeurs),
      min: valeurs.length ? Math.min(...valeurs) : null,
      max: valeurs.length ? Math.max(...valeurs) : null,
      tauxReussite: valeurs.length ? (valeurs.filter((v) => arrondi(v) >= 10).length / valeurs.length) * 100 : null,
      ecartType: ecartTypeDe(valeurs),
      effectif: valeurs.length,
    };
  });

  // Groupes et moyenne générale de chaque élève
  const eleves: ResultatEleve[] = e.inscriptions.map((ins) => {
    const parMatiere = lignes.get(ins)!;
    const lignesGroupes: LigneGroupe[] = groupes.map((g) => {
      let coefficient = 0;
      let total = 0;
      for (const m of matieres) {
        const l = parMatiere.get(m.id)!;
        if (m.groupe.id !== g.id || l.note === null) continue;
        coefficient += m.coefficient;
        total += l.total!;
      }
      return { groupeId: g.id, coefficient, total, moyenne: coefficient ? total / coefficient : null };
    });
    const totalCoef = lignesGroupes.reduce((s, g) => s + g.coefficient, 0);
    const totalPoints = lignesGroupes.reduce((s, g) => s + g.total, 0);
    const moyenne = totalCoef ? totalPoints / totalCoef : null;
    return {
      inscriptionId: ins,
      matieres: matieres.map((m) => parMatiere.get(m.id)!),
      groupes: lignesGroupes,
      totalCoef,
      totalPoints,
      moyenne,
      rang: null,
      cote: mention(moyenne, e.cotes),
    };
  });

  const rangs = classer(eleves, (r) => r.moyenne);
  for (const r of eleves) r.rang = rangs.get(r) ?? null;

  return { periode: e.periode, matieres: statsMatieres, groupes, eleves, profil: profilDe(eleves) };
}

export function profilDe(eleves: { moyenne: number | null }[]): ProfilClasse {
  const moyennes = eleves.map((r) => r.moyenne).filter((v): v is number => v !== null);
  const reussis = moyennes.filter((v) => arrondi(v) >= 10).length;
  return {
    effectif: eleves.length,
    moyenneGenerale: moyenneDe(moyennes),
    min: moyennes.length ? Math.min(...moyennes) : null,
    max: moyennes.length ? Math.max(...moyennes) : null,
    nombreMoyennes: reussis,
    tauxReussite: moyennes.length ? (reussis / moyennes.length) * 100 : null,
    ecartType: ecartTypeDe(moyennes),
  };
}

// Répartition des valeurs par tranches, pour les histogrammes.
export const TRANCHES: [number, number][] = [
  [0, 5],
  [5, 8],
  [8, 10],
  [10, 12],
  [12, 14],
  [14, 16],
  [16, 20.01],
];

export function repartition(valeurs: number[]): { tranche: string; effectif: number }[] {
  return TRANCHES.map(([a, b]) => ({
    tranche: `${a}–${b > 20 ? 20 : b}`,
    effectif: valeurs.filter((v) => arrondi(v) >= a && arrondi(v) < b).length,
  }));
}
