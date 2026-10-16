import type { CodePeriode, Rang, Role } from './types';

export const ROLES: Record<Role, string> = {
  PROVISEUR: 'Proviseur',
  SURVEILLANT_GENERAL: 'Surveillant Général',
  PROFESSEUR: 'Professeur',
};

export function note(v: number | null | undefined, decimales = 2): string {
  if (v === null || v === undefined) return '—';
  return v.toFixed(decimales).replace('.', ',');
}

export function pourcent(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(1).replace('.', ',')} %`;
}

export function rang(r: Rang | null | undefined): string {
  if (!r) return '—';
  return `${r.rang}${r.rang === 1 ? 'er' : 'e'}${r.exAequo ? ' ex' : ''}`;
}

export function date(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

export const PERIODES: { code: CodePeriode; libelle: string; court: string }[] = [
  { code: 'S1', libelle: 'Séquence 1', court: 'S1' },
  { code: 'S2', libelle: 'Séquence 2', court: 'S2' },
  { code: 'T1', libelle: 'Trimestre 1', court: 'T1' },
  { code: 'S3', libelle: 'Séquence 3', court: 'S3' },
  { code: 'S4', libelle: 'Séquence 4', court: 'S4' },
  { code: 'T2', libelle: 'Trimestre 2', court: 'T2' },
  { code: 'S5', libelle: 'Séquence 5', court: 'S5' },
  { code: 'S6', libelle: 'Séquence 6', court: 'S6' },
  { code: 'T3', libelle: 'Trimestre 3', court: 'T3' },
  { code: 'A', libelle: 'Année complète', court: 'Année' },
];

export const libellePeriode = (c: CodePeriode) => PERIODES.find((p) => p.code === c)?.libelle ?? c;

export function nomComplet(p: { nom: string; prenom?: string; prenoms?: string } | null | undefined): string {
  if (!p) return '—';
  return `${p.nom} ${p.prenoms ?? p.prenom ?? ''}`.trim();
}

// Couleur d'une moyenne : seule l'insuffisance est signalée, en rouge sobre.
export function classeNote(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'text-encre-3';
  return Math.round(v * 100) / 100 < 10 ? 'text-danger' : '';
}

// Même calcul que l'API (RG-29) : la lettre n'apparaît que s'il y a plusieurs classes.
export function nomClasse(niveau: number, specialite: string | null | undefined, rang: number, nombre: number): string {
  const lettre = nombre > 1 ? ` ${rang < 26 ? String.fromCharCode(65 + rang) : rang + 1}` : '';
  return `${niveau === 1 ? '1re' : `${niveau}e`} année${specialite ? ` ${specialite}` : ''}${lettre}`;
}
