// Outils partagés par les documents PDF (bulletins, listes).
import PDFDocument from 'pdfkit';
import type { Etablissement } from '@prisma/client';
import { LOGO } from './logo';

export type Doc = PDFKit.PDFDocument;

export const COULEURS = {
  encre: '#1a2230',
  gris: '#5b6676',
  trait: '#6f7c8c',
  traitFin: '#b9c3cf',
  entete: '#dde7f1',
  groupe: '#eef3f8',
  accent: '#1d4f91',
};

export const A4 = { largeur: 595.28, hauteur: 841.89 };

// Les polices standard de PDF ne couvrent que Windows-1252 : on remplace le reste.
const CP1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export function t(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/[   ]/g, ' ')
    .replace(/[ᵉ]/g, 'e')
    .replace(/[ʳ]/g, 'r')
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code < 0x80 || (code >= 0xa0 && code <= 0xff) || CP1252.includes(c)) return c;
      return '?';
    })
    .join('');
}

export function nouveauDocument(titre: string): Doc {
  return new PDFDocument({
    size: 'A4',
    margins: { top: 22, bottom: 18, left: 24, right: 24 },
    info: { Title: titre, Author: 'CETIC de Mezesse', Creator: 'CETIC de Mezesse, gestion scolaire' },
    bufferPages: true,
  });
}

export function nombre(v: number | null | undefined, decimales = 2): string {
  if (v === null || v === undefined) return '';
  return v.toFixed(decimales).replace('.', ',');
}

export function pourcent(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : `${nombre(v)} %`;
}

export function dateFr(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`;
}

// Texte sur une seule ligne, coupé proprement s'il dépasse.
export function ligne(
  doc: Doc,
  s: string,
  x: number,
  y: number,
  largeur: number,
  opts: { taille?: number; police?: string; couleur?: string; align?: 'left' | 'center' | 'right' } = {},
) {
  doc
    .font(opts.police ?? 'Helvetica')
    .fontSize(opts.taille ?? 7)
    .fillColor(opts.couleur ?? COULEURS.encre)
    .text(t(s), x, y, { width: largeur, align: opts.align ?? 'left', lineBreak: false, ellipsis: true, height: (opts.taille ?? 7) + 2 });
}

// Texte sur plusieurs lignes dans une boîte de hauteur fixe.
export function bloc(
  doc: Doc,
  s: string,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  opts: { taille?: number; police?: string; couleur?: string; align?: 'left' | 'center' | 'right' } = {},
) {
  doc
    .font(opts.police ?? 'Helvetica')
    .fontSize(opts.taille ?? 7)
    .fillColor(opts.couleur ?? COULEURS.encre)
    .text(t(s), x, y, { width: largeur, height: hauteur, align: opts.align ?? 'left', ellipsis: true, lineGap: -0.5 });
}

export function cadre(doc: Doc, x: number, y: number, l: number, h: number, fond?: string, trait = COULEURS.trait) {
  doc.save().lineWidth(0.5);
  if (fond) doc.rect(x, y, l, h).fillAndStroke(fond, trait);
  else doc.rect(x, y, l, h).stroke(trait);
  doc.restore();
}

// En-tête officiel bilingue (français à gauche, anglais à droite).
export function enteteOfficiel(doc: Doc, e: Etablissement, y = 22): number {
  const marge = 24;
  const col = 220;
  const droite = A4.largeur - marge - col;
  const lignesFr = [
    ['RÉPUBLIQUE DU CAMEROUN', 'Helvetica-Bold', 8],
    ['Paix – Travail – Patrie', 'Helvetica-Oblique', 6.5],
    ['MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES', 'Helvetica-Bold', 6.8],
    [`DÉLÉGATION RÉGIONALE ${prepositionRegion(e.regionFr)}`, 'Helvetica', 6.3],
    [`DÉLÉGATION DÉPARTEMENTALE ${prepositionDepartement(e.departementFr)}`, 'Helvetica', 6.3],
    [nomCourt(doc, e.nomFr, `${e.sigle} de ${e.localite}`, col), 'Helvetica-Bold', 7],
  ] as const;
  const lignesEn = [
    ['REPUBLIC OF CAMEROON', 'Helvetica-Bold', 8],
    ['Peace – Work – Fatherland', 'Helvetica-Oblique', 6.5],
    ['MINISTRY OF SECONDARY EDUCATION', 'Helvetica-Bold', 6.8],
    [`${e.regionEn.toUpperCase()} REGIONAL DELEGATION`, 'Helvetica', 6.3],
    [`${e.departementEn.toUpperCase()} DIVISIONAL DELEGATION`, 'Helvetica', 6.3],
    [nomCourt(doc, e.nomEn, `${e.sigle} ${e.localite}`, col), 'Helvetica-Bold', 7],
  ] as const;
  let yy = y;
  lignesFr.forEach(([s, police, taille], i) => {
    ligne(doc, s, marge, yy, col, { police, taille, align: 'center' });
    ligne(doc, lignesEn[i][0], droite, yy, col, { police: lignesEn[i][1], taille: lignesEn[i][2], align: 'center' });
    yy += i === 1 || i === 4 ? 11.5 : 9.5;
  });

  // Sceau de l'établissement au centre, code en dessous.
  const cx = A4.largeur / 2;
  doc.image(LOGO, cx - 27, y - 2, { width: 54, height: 54 });
  ligne(doc, e.code, cx - 50, y + 54, 100, { taille: 5.5, couleur: COULEURS.gris, align: 'center' });
  return yy + 2;
}

// Nom de l'établissement en capitales, sans accent : « CETIC DE MEZESSE ».
export function capitales(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

// Nom complet s'il tient sur la ligne, sinon la forme courte (sigle et localité).
function nomCourt(doc: Doc, complet: string, court: string, largeur: number): string {
  doc.font('Helvetica-Bold').fontSize(7);
  return doc.widthOfString(t(capitales(complet))) <= largeur ? capitales(complet) : capitales(court);
}

function prepositionRegion(region: string): string {
  const r = region.trim();
  const lower = r.toLowerCase();
  if (lower.startsWith('du ') || lower.startsWith('de ') || lower.startsWith("de l'")) return r.toUpperCase();
  const masculines = ['sud', 'nord', 'centre', 'littoral', 'sud-ouest', 'nord-ouest', 'extrême-nord', 'adamaoua'];
  if (masculines.includes(lower)) return `DU ${r.toUpperCase()}`;
  if (/^[aeiouéè]/i.test(r)) return `DE L'${r.toUpperCase()}`;
  return `DE ${r.toUpperCase()}`;
}

function prepositionDepartement(dep: string): string {
  const d = dep.trim();
  const lower = d.toLowerCase();
  if (lower.startsWith('du ') || lower.startsWith('de ') || lower.startsWith('de la ')) return d.toUpperCase();
  if (/^[aeiouéè]/i.test(d)) return `DE L'${d.toUpperCase()}`;
  return `DU ${d.toUpperCase()}`;
}

export function piedDePage(doc: Doc, texte: string) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const y = A4.hauteur - 14;
    // Écrire dans la marge basse sans déclencher de nouvelle page.
    const bas = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    ligne(doc, texte, 24, y, 400, { taille: 5.5, couleur: COULEURS.gris });
    ligne(doc, `Page ${i + 1} / ${pages.count}`, A4.largeur - 124, y, 100, { taille: 5.5, couleur: COULEURS.gris, align: 'right' });
    doc.page.margins.bottom = bas;
  }
}

export function enBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const morceaux: Buffer[] = [];
    doc.on('data', (c: Buffer) => morceaux.push(c));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);
    doc.end();
  });
}
