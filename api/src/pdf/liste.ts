// Liste nominative des élèves d'une classe.
import type { Etablissement } from '@prisma/client';
import { A4, COULEURS, cadre, dateFr, enteteOfficiel, ligne, nouveauDocument, piedDePage, type Doc } from './commun';

export interface LigneListe {
  matricule: string;
  matriculeNational: string | null;
  nom: string;
  prenoms: string;
  sexe: string;
  dateNaissance: Date;
  lieuNaissance: string;
  redoublant: boolean;
  parentTelephone: string | null;
}

const COLS = [
  { fr: 'N°', l: 22 },
  { fr: 'Matricule', l: 58 },
  { fr: 'Mat. national', l: 70 },
  { fr: 'Nom et prénoms', l: 160 },
  { fr: 'Sexe', l: 26 },
  { fr: 'Né(e) le', l: 50 },
  { fr: 'À', l: 70 },
  { fr: 'Red.', l: 26 },
  { fr: 'Tél. parent', l: 0 },
];

export function listeClasse(
  etab: Etablissement,
  classe: { nom: string; annee: string; profPrincipal: string | null },
  eleves: LigneListe[],
): Doc {
  const doc = nouveauDocument(`Liste des élèves – ${classe.nom}`);
  const X0 = 24;
  const L = A4.largeur - 48;
  COLS[COLS.length - 1].l = L - COLS.slice(0, -1).reduce((s, c) => s + c.l, 0);
  const h = 15;

  let y = enteteOfficiel(doc, etab) + 4;
  ligne(doc, `LISTE DES ÉLÈVES – ${classe.nom.toUpperCase()}`, X0, y, L, {
    police: 'Helvetica-Bold',
    taille: 11,
    couleur: COULEURS.accent,
    align: 'center',
  });
  y += 15;
  const filles = eleves.filter((e) => e.sexe === 'F').length;
  ligne(
    doc,
    `Année scolaire ${classe.annee}  ·  Effectif : ${eleves.length} (${filles} filles, ${eleves.length - filles} garçons)` +
      (classe.profPrincipal ? `  ·  Professeur principal : ${classe.profPrincipal}` : ''),
    X0,
    y,
    L,
    { taille: 7.5, couleur: COULEURS.gris, align: 'center' },
  );
  y += 16;

  const entete = () => {
    let x = X0;
    for (const c of COLS) {
      cadre(doc, x, y, c.l, h, COULEURS.entete);
      ligne(doc, c.fr, x + 3, y + 4.5, c.l - 6, { police: 'Helvetica-Bold', taille: 7 });
      x += c.l;
    }
    y += h;
  };
  entete();

  eleves.forEach((e, i) => {
    if (y + h > A4.hauteur - 30) {
      doc.addPage();
      y = 30;
      entete();
    }
    const valeurs = [
      String(i + 1),
      e.matricule,
      e.matriculeNational ?? '',
      `${e.nom} ${e.prenoms}`,
      e.sexe,
      dateFr(e.dateNaissance),
      e.lieuNaissance,
      e.redoublant ? 'Oui' : 'Non',
      e.parentTelephone ?? '',
    ];
    let x = X0;
    COLS.forEach((c, k) => {
      cadre(doc, x, y, c.l, h, i % 2 ? '#f6f8fb' : undefined);
      ligne(doc, valeurs[k], x + 3, y + 4.5, c.l - 6, { taille: 7.2, police: k === 3 ? 'Helvetica-Bold' : 'Helvetica' });
      x += c.l;
    });
    y += h;
  });

  piedDePage(doc, `${etab.nomFr} · Liste ${classe.nom} · éditée le ${dateFr(new Date())}`);
  return doc;
}
