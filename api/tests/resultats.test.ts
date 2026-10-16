import { describe, expect, it } from 'vitest';
import {
  calculerResultats,
  classer,
  formatRang,
  mention,
  repartition,
  type MatiereEntree,
  type NoteEntree,
} from '../src/calcul/resultats';
import { COTES, GRADES } from '../prisma/seed';

const g1 = { id: 'g1', nom: 'Général', nomEn: null, ordre: 1 };
const g2 = { id: 'g2', nom: 'Pro', nomEn: null, ordre: 2 };
const mat = (id: string, coefficient: number, groupe = g1, ordre = 1): MatiereEntree => ({
  id,
  nom: id,
  nomEn: null,
  coefficient,
  ordre,
  groupe,
  professeur: null,
});
const n = (inscriptionId: string, matiereId: string, sequence: number, valeur: number): NoteEntree => ({
  inscriptionId,
  matiereId,
  sequence,
  valeur,
});
const base = { grades: GRADES, cotes: COTES };

describe('mentions', () => {
  it('applique les seuils des grades validés par le SG', () => {
    expect(mention(17.4, GRADES)).toBe('A');
    expect(mention(16, GRADES)).toBe('A');
    expect(mention(15.99, GRADES)).toBe('B+');
    expect(mention(15, GRADES)).toBe('B+');
    expect(mention(14, GRADES)).toBe('B');
    expect(mention(12.8, GRADES)).toBe('C+');
    expect(mention(12.05, GRADES)).toBe('C+');
    expect(mention(10, GRADES)).toBe('C');
    expect(mention(9.99, GRADES)).toBe('D');
    expect(mention(0, GRADES)).toBe('D');
    expect(mention(null, GRADES)).toBeNull();
  });

  it('arrondit au centième avant de comparer', () => {
    expect(mention(9.996, GRADES)).toBe('C');
  });

  it('donne la cote de la moyenne générale', () => {
    expect(mention(11.59, COTES)).toBe('CMA');
    expect(mention(16.2, COTES)).toBe('CTBA');
    expect(mention(8, COTES)).toBe('CNA');
  });
});

describe('rangs', () => {
  it('donne le même rang aux ex æquo et saute les suivants', () => {
    const e = [{ v: 12 }, { v: 15 }, { v: 12 }, { v: 9 }];
    const r = classer(e, (x) => x.v);
    expect(r.get(e[1])).toEqual({ rang: 1, exAequo: false });
    expect(r.get(e[0])).toEqual({ rang: 2, exAequo: true });
    expect(r.get(e[2])).toEqual({ rang: 2, exAequo: true });
    expect(r.get(e[3])).toEqual({ rang: 4, exAequo: false });
  });

  it('ignore les valeurs nulles', () => {
    const e = [{ v: null }, { v: 10 }];
    const r = classer(e, (x) => x.v);
    expect(r.has(e[0])).toBe(false);
    expect(r.get(e[1])?.rang).toBe(1);
  });

  it('formate les rangs en français et en anglais', () => {
    expect(formatRang({ rang: 1, exAequo: false })).toBe('1er');
    expect(formatRang({ rang: 3, exAequo: true })).toBe('3e ex');
    expect(formatRang({ rang: 2, exAequo: false }, 'en')).toBe('2nd');
    expect(formatRang({ rang: 11, exAequo: false }, 'en')).toBe('11th');
    expect(formatRang({ rang: 23, exAequo: false }, 'en')).toBe('23rd');
  });
});

describe('séquence', () => {
  const matieres = [mat('maths', 4), mat('fr', 2, g1, 2), mat('atelier', 3, g2), mat('eps', 1, g2, 2)];
  const notes = [
    n('a', 'maths', 1, 12),
    n('b', 'maths', 1, 8),
    n('a', 'fr', 1, 14),
    // b n'a pas de note de français : 0
    n('a', 'atelier', 1, 15),
    n('b', 'atelier', 1, 16),
    n('c', 'atelier', 1, 10),
    // eps : personne n'a de note, matière non évaluée
    n('a', 'maths', 2, 20), // autre séquence, ignorée
  ];
  const r = calculerResultats({ periode: 'S1', matieres, inscriptions: ['a', 'b', 'c'], notes, ...base });
  const eleve = (id: string) => r.eleves.find((e) => e.inscriptionId === id)!;

  it('met 0 à un élève sans note dans une matière évaluée', () => {
    expect(eleve('b').matieres[1].note).toBe(0);
    expect(eleve('c').matieres[0].note).toBe(0);
  });

  it('retire pour tous une matière que personne n’a notée', () => {
    const eps = r.matieres.find((s) => s.matiere.id === 'eps')!;
    expect(eps.evaluee).toBe(false);
    expect(eleve('a').matieres[3].note).toBeNull();
    expect(eleve('a').totalCoef).toBe(4 + 2 + 3);
  });

  it('calcule les totaux, les groupes et la moyenne générale', () => {
    const a = eleve('a');
    expect(a.totalPoints).toBe(12 * 4 + 14 * 2 + 15 * 3);
    expect(a.moyenne).toBeCloseTo(121 / 9, 10);
    expect(a.groupes[0]).toMatchObject({ coefficient: 6, total: 76 });
    expect(a.groupes[0].moyenne).toBeCloseTo(76 / 6, 10);
    expect(a.groupes[1]).toMatchObject({ coefficient: 3, total: 45, moyenne: 15 });
  });

  it('classe les élèves et calcule les statistiques de matière', () => {
    expect(eleve('a').rang?.rang).toBe(1);
    const maths = r.matieres[0];
    expect(maths.moyenne).toBeCloseTo((12 + 8 + 0) / 3, 10);
    expect(maths.min).toBe(0);
    expect(maths.max).toBe(12);
    expect(maths.tauxReussite).toBeCloseTo(100 / 3, 10);
    expect(eleve('b').matieres[2].rang).toEqual({ rang: 1, exAequo: false });
  });

  it('dresse le profil de la classe', () => {
    expect(r.profil.effectif).toBe(3);
    expect(r.profil.nombreMoyennes).toBe(1);
    expect(r.profil.max).toBeCloseTo(121 / 9, 10);
  });
});

describe('trimestre et année', () => {
  const matieres = [mat('maths', 2)];
  it('fait la moyenne des séquences évaluées du trimestre', () => {
    const notes = [n('a', 'maths', 1, 10), n('a', 'maths', 2, 14), n('b', 'maths', 1, 8)];
    const r = calculerResultats({ periode: 'T1', matieres, inscriptions: ['a', 'b'], notes, ...base });
    const a = r.eleves[0].matieres[0];
    expect(a.detail).toEqual([10, 14]);
    expect(a.note).toBe(12);
    // b : séquence 2 évaluée (a y a une note) donc 0
    expect(r.eleves[1].matieres[0].note).toBe(4);
  });

  it('ignore une séquence où la matière n’a pas été évaluée', () => {
    const notes = [n('a', 'maths', 1, 10), n('b', 'maths', 1, 16)];
    const r = calculerResultats({ periode: 'T1', matieres, inscriptions: ['a', 'b'], notes, ...base });
    expect(r.eleves[0].matieres[0].detail).toEqual([10, null]);
    expect(r.eleves[0].matieres[0].note).toBe(10);
  });

  it('fait la moyenne des trimestres sur l’année', () => {
    const notes = [n('a', 'maths', 1, 10), n('a', 'maths', 2, 12), n('a', 'maths', 3, 14), n('a', 'maths', 5, 9), n('a', 'maths', 6, 11)];
    const r = calculerResultats({ periode: 'A', matieres, inscriptions: ['a'], notes, ...base });
    const l = r.eleves[0].matieres[0];
    expect(l.detail).toEqual([11, 14, 10]);
    expect(l.note).toBeCloseTo(35 / 3, 10);
  });
});

describe('répartition', () => {
  it('range chaque valeur dans sa tranche, 20 compris', () => {
    const r = repartition([0, 4.99, 5, 9.996, 10, 20]);
    expect(r.map((t) => t.effectif)).toEqual([2, 1, 0, 2, 0, 0, 1]);
  });
});
