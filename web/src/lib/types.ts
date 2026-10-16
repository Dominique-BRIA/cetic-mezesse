export type Role = 'PROVISEUR' | 'SURVEILLANT_GENERAL' | 'PROFESSEUR';
export type Sexe = 'M' | 'F';
export type CodePeriode = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'T1' | 'T2' | 'T3' | 'A';

export interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  role: Role;
  actif: boolean;
  doitChangerMotDePasse: boolean;
  discipline: string | null;
}

export interface Sequence {
  id: string;
  anneeId: string;
  numero: number;
  trimestre: number;
  saisieOuverte: boolean;
}

export interface Annee {
  id: string;
  libelle: string;
  active: boolean;
  sequences: Sequence[];
  _count: { classes: number; inscriptions: number };
}

export interface Personne {
  id: string;
  nom: string;
  prenom: string;
}

export interface Classe {
  id: string;
  nom: string;
  nomEn: string | null;
  niveau: number;
  specialite: string | null;
  profPrincipalId: string | null;
  profPrincipal: Personne | null;
  groupes: { id: string; nom: string }[];
  _count: { matieres: number; inscriptions: number };
}

export interface Groupe {
  id: string;
  nom: string;
  nomEn: string | null;
  ordre: number;
  classes: { id: string; nom: string }[];
  _count: { matieres: number };
}

export interface Matiere {
  id: string;
  nom: string;
  nomEn: string | null;
  coefficient: number;
  ordre: number;
  classeId: string;
  groupeId: string;
  professeurId: string | null;
  classe: { id: string; nom: string; niveau: number };
  groupe: { id: string; nom: string; ordre: number };
  professeur: Personne | null;
  _count: { notes: number };
}

export interface Eleve {
  id: string;
  matricule: string;
  matriculeNational: string | null;
  nom: string;
  prenoms: string;
  sexe: Sexe;
  dateNaissance: string;
  lieuNaissance: string;
  photoCle: string | null;
  parentNom: string | null;
  parentTelephone: string | null;
  parentAdresse: string | null;
}

export interface Renvoi {
  id: string;
  date: string;
  motif: string;
  creeLe: string;
  reintegreLe: string | null;
  motifReintegration: string | null;
  par: { nom: string; prenom: string };
  reintegrePar?: { nom: string; prenom: string } | null;
}

export interface Inscription {
  id: string;
  eleveId: string;
  anneeId: string;
  classeId: string;
  redoublant: boolean;
  statut: 'ACTIF' | 'RENVOYE';
  eleve: Eleve;
  classe: { id: string; nom: string; niveau: number };
  annee: { id: string; libelle: string };
  renvois: Renvoi[];
}

export interface Enseignant extends Utilisateur {
  creeLe: string;
  matieres: { id: string; nom: string; coefficient: number; classe: { id: string; nom: string } }[];
  classesPrincipales: { id: string; nom: string }[];
}

export interface Rang {
  rang: number;
  exAequo: boolean;
}

export interface Resume {
  effectif: number;
  moyenne: number | null;
  min: number | null;
  max: number | null;
  tauxReussite: number | null;
  ecartType: number | null;
  reussis: number;
}

export interface Profil {
  effectif: number;
  moyenneGenerale: number | null;
  min: number | null;
  max: number | null;
  nombreMoyennes: number;
  tauxReussite: number | null;
  ecartType: number | null;
}

export interface Etablissement {
  nomFr: string;
  nomEn: string;
  sigle: string;
  regionFr: string;
  regionEn: string;
  departementFr: string;
  departementEn: string;
  arrondissement: string;
  localite: string;
  code: string;
  boitePostale: string | null;
  telephone: string | null;
  prefixeMatricule: string;
}

export interface Bareme {
  id: string;
  type: 'GRADE' | 'COTE';
  libelle: string;
  libelleLong: string | null;
  min: number;
}
