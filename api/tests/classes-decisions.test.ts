import { describe, expect, it } from 'vitest';
import { lettre, nomsClasses, ordinal } from '../src/lib/classes';
import { DELAI_DESAPPROBATION_JOURS, dansLeDelai, limiteDesapprobation } from '../src/lib/decisions';

const meca = { nom: 'Mécanique', nomEn: 'Mechanics' };

describe('noms des classes', () => {
  it('écrit le niveau en ordinal', () => {
    expect(ordinal(1)).toBe('1re');
    expect(ordinal(2)).toBe('2e');
  });

  it("n'ajoute pas de lettre quand la classe est seule", () => {
    expect(nomsClasses(1, meca, 1)).toEqual([{ nom: '1re année Mécanique', nomEn: 'Year 1 Mechanics' }]);
  });

  it('ajoute A, B… quand le niveau et la spécialité comptent plusieurs classes', () => {
    expect(nomsClasses(1, meca, 3).map((c) => c.nom)).toEqual([
      '1re année Mécanique A',
      '1re année Mécanique B',
      '1re année Mécanique C',
    ]);
  });

  it('reprend le nom français quand la spécialité n’a pas de nom anglais', () => {
    expect(nomsClasses(2, { nom: 'ELEC', nomEn: null }, 2)[1]).toEqual({ nom: '2e année ELEC B', nomEn: 'Year 2 ELEC B' });
  });

  it('nomme une classe sans spécialité par son seul niveau', () => {
    expect(nomsClasses(3, null, 1)[0].nom).toBe('3e année');
    expect(nomsClasses(3, null, 2)[1].nom).toBe('3e année B');
  });

  it('passe aux chiffres au-delà de Z', () => {
    expect(lettre(25)).toBe('Z');
    expect(lettre(26)).toBe('27');
  });
});

describe('délai de désapprobation', () => {
  const creeLe = new Date('2026-10-01T08:00:00Z');

  it('dure 4 semaines', () => {
    expect(DELAI_DESAPPROBATION_JOURS).toBe(28);
    expect(limiteDesapprobation(creeLe).toISOString()).toBe('2026-10-29T08:00:00.000Z');
  });

  it('autorise la désapprobation jusqu’à la limite incluse', () => {
    expect(dansLeDelai(creeLe, new Date('2026-10-15T00:00:00Z'))).toBe(true);
    expect(dansLeDelai(creeLe, new Date('2026-10-29T08:00:00Z'))).toBe(true);
  });

  it('la refuse passé la limite', () => {
    expect(dansLeDelai(creeLe, new Date('2026-10-29T08:00:01Z'))).toBe(false);
  });
});
