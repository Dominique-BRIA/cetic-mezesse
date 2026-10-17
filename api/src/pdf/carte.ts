// Cartes d'identité scolaires (RG-31) : format carte bancaire ISO/CEI 7810 ID-1 (85,6 × 54 mm),
// dix par page A4 (2 × 5) avec des traits de coupe, à découper à la main.
import PDFDocument from 'pdfkit';
import type { Etablissement } from '@prisma/client';
import { COULEURS, A4, type Doc, capitales, dateFr, ligne, t } from './commun';
import { LOGO } from './logo';

const MM = 72 / 25.4;
export const CARTE = { largeur: 85.6 * MM, hauteur: 54 * MM };
export const PAR_PAGE = { colonnes: 2, lignes: 5 };
const ECART = 3 * MM; // entre deux cartes : de quoi couper sans entamer la voisine
const ORIGINE = {
  x: (A4.largeur - PAR_PAGE.colonnes * CARTE.largeur - (PAR_PAGE.colonnes - 1) * ECART) / 2,
  y: (A4.hauteur - PAR_PAGE.lignes * CARTE.hauteur - (PAR_PAGE.lignes - 1) * ECART) / 2,
};

const DRAPEAU = { vert: '#007a5e', rouge: '#ce1126', jaune: '#fcd116' };

export interface EleveCarte {
  matricule: string;
  matriculeNational: string | null;
  nom: string;
  prenoms: string;
  sexe: 'M' | 'F';
  dateNaissance: Date;
  lieuNaissance: string;
  parentTelephone: string | null;
  classe: string;
  photo: Buffer;
}

export function cartesScolaires(etab: Etablissement, annee: string, eleves: EleveCarte[]): Doc {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: { Title: `Cartes scolaires ${annee}`, Author: etab.nomFr, Creator: 'CETIC de Mezesse, gestion scolaire' },
  });
  const parPage = PAR_PAGE.colonnes * PAR_PAGE.lignes;
  eleves.forEach((e, i) => {
    const k = i % parPage;
    if (k === 0) {
      if (i > 0) doc.addPage();
      tracerCoupes(doc);
    }
    const x = ORIGINE.x + (k % PAR_PAGE.colonnes) * (CARTE.largeur + ECART);
    const y = ORIGINE.y + Math.floor(k / PAR_PAGE.colonnes) * (CARTE.hauteur + ECART);
    dessinerCarte(doc, etab, annee, e, x, y);
  });
  return doc;
}

// Traits de coupe dans les marges de la page, dans le prolongement des bords de chaque carte.
function tracerCoupes(doc: Doc) {
  const long = 4 * MM;
  const recul = 1.5 * MM;
  doc.save().lineWidth(0.3).strokeColor(COULEURS.trait);
  const xs: number[] = [];
  for (let c = 0; c < PAR_PAGE.colonnes; c++) xs.push(ORIGINE.x + c * (CARTE.largeur + ECART), ORIGINE.x + c * (CARTE.largeur + ECART) + CARTE.largeur);
  const ys: number[] = [];
  for (let l = 0; l < PAR_PAGE.lignes; l++) ys.push(ORIGINE.y + l * (CARTE.hauteur + ECART), ORIGINE.y + l * (CARTE.hauteur + ECART) + CARTE.hauteur);
  const haut = ORIGINE.y;
  const bas = A4.hauteur - ORIGINE.y;
  const gauche = ORIGINE.x;
  const droite = A4.largeur - ORIGINE.x;
  for (const x of xs) {
    doc.moveTo(x, haut - recul - long).lineTo(x, haut - recul).stroke();
    doc.moveTo(x, bas + recul).lineTo(x, bas + recul + long).stroke();
  }
  for (const y of ys) {
    doc.moveTo(gauche - recul - long, y).lineTo(gauche - recul, y).stroke();
    doc.moveTo(droite + recul, y).lineTo(droite + recul + long, y).stroke();
  }
  doc.restore();
}

function dessinerCarte(doc: Doc, etab: Etablissement, annee: string, e: EleveCarte, x: number, y: number) {
  const L = CARTE.largeur;
  const H = CARTE.hauteur;
  const m = 2.2 * MM; // marge intérieure

  // Fond, filet aux couleurs du drapeau et contour fin (sert aussi de repère de coupe).
  doc.save();
  doc.roundedRect(x, y, L, H, 2.5 * MM).clip();
  doc.rect(x, y, L, H).fill('#ffffff');
  const bande = 1.6;
  doc.rect(x, y, L / 3, bande).fill(DRAPEAU.vert);
  doc.rect(x + L / 3, y, L / 3, bande).fill(DRAPEAU.rouge);
  doc.rect(x + (2 * L) / 3, y, L / 3, bande).fill(DRAPEAU.jaune);
  // Sceau en filigrane derrière le corps de la carte.
  doc.opacity(0.06).image(LOGO, x + L / 2 - 26, y + 52, { width: 82, height: 82 }).opacity(1);
  doc.restore();
  doc.save().lineWidth(0.4).roundedRect(x, y, L, H, 2.5 * MM).stroke(COULEURS.traitFin).restore();

  // En-tête bilingue autour du sceau.
  const col = (L - 2 * m - 30) / 2;
  let yy = y + bande + 2.6;
  const fr = [
    ['RÉPUBLIQUE DU CAMEROUN', 'Helvetica-Bold', 5.2],
    ['Paix – Travail – Patrie', 'Helvetica-Oblique', 4.3],
    ['MINESEC', 'Helvetica-Bold', 4.6],
  ] as const;
  const en = [
    ['REPUBLIC OF CAMEROON', 'Helvetica-Bold', 5.2],
    ['Peace – Work – Fatherland', 'Helvetica-Oblique', 4.3],
    ['MINESEC', 'Helvetica-Bold', 4.6],
  ] as const;
  fr.forEach(([s, police, taille], i) => {
    ligne(doc, s, x + m, yy, col, { police, taille, align: 'center' });
    ligne(doc, en[i][0], x + L - m - col, yy, col, { police: en[i][1], taille: en[i][2], align: 'center' });
    yy += taille + 1.4;
  });
  doc.image(LOGO, x + L / 2 - 12.5, y + bande + 1.6, { width: 25, height: 25 });

  // Nom de l'établissement sur un bandeau.
  const yBandeau = y + bande + 28;
  doc.rect(x, yBandeau, L, 10.5).fill(COULEURS.accent);
  doc.font('Helvetica-Bold').fontSize(5.6);
  const nom = doc.widthOfString(t(capitales(etab.nomFr))) <= L - 2 * m ? capitales(etab.nomFr) : capitales(`${etab.sigle} de ${etab.localite}`);
  ligne(doc, nom, x + m, yBandeau + 2.6, L - 2 * m, { police: 'Helvetica-Bold', taille: 5.6, couleur: '#ffffff', align: 'center' });

  // Titre et année scolaire.
  const yTitre = yBandeau + 13.5;
  ligne(doc, "CARTE D'IDENTITÉ SCOLAIRE", x + m, yTitre, L - 2 * m - 60, { police: 'Helvetica-Bold', taille: 7, couleur: COULEURS.accent });
  ligne(doc, 'STUDENT IDENTITY CARD', x + m, yTitre + 8, L - 2 * m - 60, { police: 'Helvetica-Oblique', taille: 4.6, couleur: COULEURS.gris });
  ligne(doc, annee, x + L - m - 60, yTitre + 0.5, 60, { police: 'Helvetica-Bold', taille: 6.6, align: 'right' });
  ligne(doc, 'Année scolaire / School year', x + L - m - 60, yTitre + 8, 60, { taille: 4, couleur: COULEURS.gris, align: 'right' });

  // Photo d'identité (format 3,5 × 4,5 réduit à la carte).
  const yCorps = yTitre + 16;
  const hPhoto = y + H - yCorps - 4.5 * MM;
  const lPhoto = hPhoto * (3.5 / 4.5);
  doc.save().lineWidth(0.5).rect(x + m, yCorps, lPhoto, hPhoto).stroke(COULEURS.trait).restore();
  try {
    doc.save().rect(x + m + 0.5, yCorps + 0.5, lPhoto - 1, hPhoto - 1).clip();
    doc.image(e.photo, x + m + 0.5, yCorps + 0.5, { cover: [lPhoto - 1, hPhoto - 1], align: 'center', valign: 'center' });
    doc.restore();
  } catch {
    doc.restore();
    ligne(doc, 'Photo illisible', x + m, yCorps + hPhoto / 2 - 3, lPhoto, { taille: 5, couleur: COULEURS.gris, align: 'center' });
  }

  // Identité de l'élève.
  const xc = x + m + lPhoto + 2.4 * MM;
  const lc = x + L - m - xc;
  let yc = yCorps - 0.5;
  const champ = (libelle: string, valeur: string, opts: { gras?: boolean; taille?: number; largeur?: number; dx?: number } = {}) => {
    const xx = xc + (opts.dx ?? 0);
    const ll = opts.largeur ?? lc;
    ligne(doc, libelle, xx, yc, ll, { taille: 3.9, couleur: COULEURS.gris });
    ligne(doc, valeur, xx, yc + 4.4, ll, { police: opts.gras === false ? 'Helvetica' : 'Helvetica-Bold', taille: opts.taille ?? 6.2 });
  };
  champ('Nom / Surname', e.nom.toUpperCase(), { taille: 7 });
  yc += 12.2;
  champ('Prénoms / Given names', e.prenoms, { taille: 6.4 });
  yc += 11.6;
  champ('Né(e) le / Born on', `${dateFr(e.dateNaissance)} à ${e.lieuNaissance}`, { gras: false, taille: 5.8 });
  yc += 11;
  const demi = (lc - 3) / 2;
  champ('Sexe / Sex', e.sexe === 'F' ? 'F' : 'M', { largeur: 20, taille: 5.8 });
  champ('Classe / Class', e.classe, { dx: 22, largeur: lc - 22, taille: 5.8 });
  yc += 11;
  champ('Matricule', e.matricule, { largeur: demi, taille: 6 });
  if (e.matriculeNational) champ('Mat. national', e.matriculeNational, { dx: demi + 3, largeur: demi, gras: false, taille: 5.4 });

  // Pied : contact du parent et visa du Proviseur.
  const yPied = y + H - 4.3 * MM;
  doc.save().lineWidth(0.3).moveTo(x + m, yPied).lineTo(x + L - m, yPied).stroke(COULEURS.traitFin).restore();
  ligne(doc, e.parentTelephone ? `En cas d'urgence / Emergency : ${e.parentTelephone}` : '', x + m, yPied + 2.4, L / 2, { taille: 4.4, couleur: COULEURS.gris });
  ligne(doc, 'Le Proviseur / The Principal', x + L / 2, yPied + 2.4, L / 2 - m, { police: 'Helvetica-Bold', taille: 4.6, align: 'right' });
}
