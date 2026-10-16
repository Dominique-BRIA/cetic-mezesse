// Bulletin de notes bilingue, une page A4 par élève, sur le modèle des bulletins APC du MINESEC.
import type { Etablissement } from '@prisma/client';
import {
  formatRang,
  type CodePeriode,
  type LigneMatiere,
  type ResultatsClasse,
  type StatMatiere,
} from '../calcul/resultats';
import type { DonneesClasse } from '../services/resultats';
import { A4, COULEURS, bloc, cadre, dateFr, enteteOfficiel, ligne, nombre, pourcent, t, type Doc } from './commun';

export interface ContexteBulletin {
  etab: Etablissement;
  donnees: DonneesClasse;
  // Résultats des sous-périodes rappelés sur le bulletin : séquences d'un trimestre, trimestres de l'année.
  rappels: { periode: CodePeriode; resultats: ResultatsClasse }[];
  competences: Map<string, string>;
  photos: Map<string, Buffer>;
}

const X0 = 24;
const L = A4.largeur - 48;
const ORDINAUX_EN = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

// « Compétences très bien acquises » → « Très bien acquises » : le titre du bloc dit déjà de quoi il s'agit.
function sansPrefixe(s: string | null | undefined): string {
  const r = (s ?? '').replace(/^comp[ée]tences?\s+/i, '');
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function titres(p: CodePeriode): [string, string] {
  if (p === 'A') return ['BULLETIN ANNUEL', 'ANNUAL REPORT CARD'];
  const n = Number(p.slice(1));
  if (p[0] === 'S') return [`BULLETIN DE LA SÉQUENCE ${n}`, `${ORDINAUX_EN[n - 1].toUpperCase()} SEQUENCE REPORT`];
  return [`BULLETIN DU TRIMESTRE ${n}`, `${ORDINAUX_EN[n - 1].toUpperCase()} TERM REPORT`];
}

function libelleCourt(p: CodePeriode): [string, string] {
  if (p[0] === 'S') return [`Séq. ${p.slice(1)}`, `Seq. ${p.slice(1)}`];
  return [`Trim. ${p.slice(1)}`, `Term ${p.slice(1)}`];
}

interface Colonne {
  cle: string;
  fr: string;
  en: string;
  l: number;
  align?: 'left' | 'center' | 'right';
}

function colonnes(p: CodePeriode, rappels: CodePeriode[]): Colonne[] {
  const fin: Colonne[] = [
    { cle: 'coef', fr: 'Coef', en: 'Coef', l: 26 },
    { cle: 'total', fr: 'N x C', en: 'Total', l: 36 },
    { cle: 'rang', fr: 'Rang', en: 'Rank', l: 34 },
    { cle: 'moycl', fr: 'Moy. cl.', en: 'Cl. avg', l: 34 },
    { cle: 'reussite', fr: '% réuss.', en: '% pass', l: 38 },
    { cle: 'grade', fr: 'Grade', en: 'Grade', l: 28 },
    { cle: 'extrema', fr: 'Min – Max', en: 'Extrema', l: 54 },
  ];
  if (p[0] === 'S') {
    const avant: Colonne[] = [
      { cle: 'matiere', fr: 'Matières', en: 'Subjects', l: 112, align: 'left' },
      { cle: 'competence', fr: 'Compétence visée', en: 'Target skills', l: 110, align: 'left' },
      { cle: 'note', fr: 'Note/20', en: 'Mark/20', l: 34 },
    ];
    return [...avant, ...fin, { cle: 'visa', fr: 'Visa prof.', en: 'Signature', l: L - [...avant, ...fin].reduce((s, c) => s + c.l, 0) }];
  }
  const detail: Colonne[] = rappels.map((r) => {
    const [fr, en] = libelleCourt(r);
    return { cle: `d-${r}`, fr, en, l: p === 'A' ? 30 : 34 };
  });
  const avant: Colonne[] = [
    { cle: 'matiere', fr: 'Matières', en: 'Subjects', l: 0, align: 'left' },
    ...detail,
    { cle: 'note', fr: 'Moy./20', en: 'Avg/20', l: 36 },
  ];
  const visa: Colonne = { cle: 'visa', fr: 'Visa prof.', en: 'Signature', l: 44 };
  const reste = L - [...avant, ...fin, visa].reduce((s, c) => s + c.l, 0);
  avant[0].l = reste;
  return [...avant, ...fin, visa];
}

export function dessinerBulletin(doc: Doc, ctx: ContexteBulletin, inscriptionId: string) {
  const { etab, donnees } = ctx;
  const { classe, resultats } = donnees;
  const ins = donnees.inscriptions.find((i) => i.id === inscriptionId)!;
  const r = resultats.eleves.find((e) => e.inscriptionId === inscriptionId)!;
  const p = resultats.periode;
  const classes = resultats.profil.effectif;
  const classesAvecMoyenne = resultats.eleves.filter((e) => e.moyenne !== null).length;

  // ---- En-tête ----
  let y = enteteOfficiel(doc, etab);

  // ---- Titre ----
  const [titreFr, titreEn] = titres(p);
  cadre(doc, X0 + 150, y, L - 300, 25, COULEURS.entete, COULEURS.accent);
  ligne(doc, titreFr, X0 + 150, y + 4, L - 300, { police: 'Helvetica-Bold', taille: 9.5, couleur: COULEURS.accent, align: 'center' });
  ligne(doc, `${titreEn}  ·  Année scolaire / School year : ${classe.annee.libelle}`, X0 + 150, y + 15, L - 300, {
    police: 'Helvetica-Oblique',
    taille: 6.3,
    align: 'center',
  });
  y += 30;

  // ---- Identité ----
  const hId = 60;
  cadre(doc, X0, y, L, hId);
  const photo = ctx.photos.get(ins.eleveId);
  cadre(doc, X0 + 3, y + 3, 46, hId - 6, undefined, COULEURS.traitFin);
  if (photo) {
    try {
      doc.image(photo, X0 + 3.5, y + 3.5, { fit: [45, hId - 7], align: 'center', valign: 'center' });
    } catch {
      ligne(doc, 'Photo', X0 + 3, y + hId / 2 - 3, 46, { taille: 6, couleur: COULEURS.gris, align: 'center' });
    }
  } else {
    ligne(doc, 'Photo', X0 + 3, y + hId / 2 - 3, 46, { taille: 6, couleur: COULEURS.gris, align: 'center' });
  }
  const e = ins.eleve;
  const xId = X0 + 56;
  const lId = L - 60;
  ligne(doc, `${e.nom} ${e.prenoms}`, xId, y + 5, lId * 0.62, { police: 'Helvetica-Bold', taille: 10.5 });
  const champ = (fr: string, en: string, valeur: string, x: number, yy: number, l: number) => {
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor(COULEURS.gris);
    doc.text(t(`${fr} / `), x, yy, { continued: true, lineBreak: false });
    doc.font('Helvetica-Oblique').text(t(`${en} : `), { continued: true, lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor(COULEURS.encre).text(t(valeur), { lineBreak: false, width: l, ellipsis: true });
  };
  const c1 = xId;
  const c2 = xId + lId * 0.62;
  const ne = `${dateFr(e.dateNaissance)} à ${e.lieuNaissance}`;
  champ('Né(e) le', 'Born on', ne, c1, y + 20, lId * 0.6);
  champ('Sexe', 'Gender', e.sexe === 'F' ? 'F' : 'M', c1, y + 31, 60);
  champ('Redoublant', 'Repeater', ins.redoublant ? 'Oui / Yes' : 'Non / No', c1 + 90, y + 31, 80);
  champ('Parent / tuteur', 'Guardian', [e.parentNom, e.parentTelephone].filter(Boolean).join(' · ') || '—', c1, y + 42, lId * 0.6);
  champ('Matricule', 'Reg. no', e.matricule, c2, y + 5, lId * 0.38);
  champ('Mat. national', 'National ID', e.matriculeNational ?? '—', c2, y + 16, lId * 0.38);
  champ('Classe', 'Class', classe.nom, c2, y + 27, lId * 0.38);
  champ('Effectif', 'Enrolment', String(classes), c2, y + 38, lId * 0.38);
  champ(
    'Prof. principal',
    'Class master',
    classe.profPrincipal ? `${classe.profPrincipal.prenom} ${classe.profPrincipal.nom}` : '—',
    c2,
    y + 49,
    lId * 0.38,
  );
  y += hId + 5;

  // ---- Tableau des notes ----
  const rappelsPeriodes = ctx.rappels.map((x) => x.periode);
  const cols = colonnes(p, rappelsPeriodes);
  const xs: number[] = [];
  cols.reduce((x, c) => (xs.push(x), x + c.l), X0);
  const col = (cle: string) => cols.findIndex((c) => c.cle === cle);

  const hBas = 88 + 6 + 74 + 16; // blocs du bas + signatures + pied
  const nbLignes = resultats.matieres.length + resultats.groupes.length;
  const hEntete = 20;
  const dispo = A4.hauteur - y - hBas - hEntete - 6;
  const h = Math.max(11, Math.min(17, dispo / Math.max(nbLignes, 1)));
  const taille = h < 13 ? 6.2 : 6.8;

  // En-têtes de colonnes
  cols.forEach((c, i) => {
    cadre(doc, xs[i], y, c.l, hEntete, COULEURS.entete);
    ligne(doc, c.fr, xs[i] + 2, y + 4, c.l - 4, { police: 'Helvetica-Bold', taille: 6.3, align: c.align === 'left' ? 'left' : 'center' });
    ligne(doc, c.en, xs[i] + 2, y + 11.5, c.l - 4, {
      police: 'Helvetica-Oblique',
      taille: 5.4,
      couleur: COULEURS.gris,
      align: c.align === 'left' ? 'left' : 'center',
    });
  });
  y += hEntete;

  const cellule = (i: number, s: string, opts: { gras?: boolean; couleur?: string } = {}) => {
    const c = cols[i];
    ligne(doc, s, xs[i] + 2, y + (h - taille) / 2, c.l - 4, {
      taille,
      police: opts.gras ? 'Helvetica-Bold' : 'Helvetica',
      couleur: opts.couleur,
      align: c.align === 'left' ? 'left' : 'center',
    });
  };

  const indexMatiere = new Map(resultats.matieres.map((s, i) => [s.matiere.id, i]));
  resultats.groupes.forEach((g, gi) => {
    const statsGroupe = resultats.matieres.filter((s) => s.matiere.groupe.id === g.id);
    for (const s of statsGroupe) {
      const l = r.matieres[indexMatiere.get(s.matiere.id)!];
      cols.forEach((c, i) => cadre(doc, xs[i], y, c.l, h));
      ligneMatiere(s, l);
      y += h;
    }
    // Sous-total du groupe
    const lg = r.groupes.find((x) => x.groupeId === g.id)!;
    const iCoef = col('coef');
    const iTotal = col('total');
    const largeurLibelle = xs[iCoef] - X0;
    cadre(doc, X0, y, largeurLibelle, h, COULEURS.groupe);
    cadre(doc, xs[iCoef], y, cols[iCoef].l, h, COULEURS.groupe);
    cadre(doc, xs[iTotal], y, cols[iTotal].l, h, COULEURS.groupe);
    cadre(doc, xs[iTotal + 1], y, X0 + L - xs[iTotal + 1], h, COULEURS.groupe);
    ligne(doc, `Total groupe ${gi + 1} / Group ${gi + 1} total : ${g.nom}`, X0 + 3, y + (h - taille) / 2, largeurLibelle - 6, {
      police: 'Helvetica-Bold',
      taille,
    });
    cellule(iCoef, String(lg.coefficient), { gras: true });
    cellule(iTotal, nombre(lg.total), { gras: true });
    ligne(
      doc,
      `Moyenne / Average : ${lg.moyenne === null ? '—' : `${nombre(lg.moyenne)} / 20`}`,
      xs[iTotal + 1] + 4,
      y + (h - taille) / 2,
      X0 + L - xs[iTotal + 1] - 8,
      { police: 'Helvetica-Bold', taille },
    );
    y += h;
  });

  function ligneMatiere(s: StatMatiere, l: LigneMatiere) {
    const m = s.matiere;
    // Matière : nom, puis nom anglais et professeur en petit
    const iM = col('matiere');
    const sousTitre = [m.nomEn, m.professeur].filter(Boolean).join(' · ');
    if (sousTitre && h >= 13) {
      ligne(doc, m.nom, xs[iM] + 2, y + 1.6, cols[iM].l - 4, { police: 'Helvetica-Bold', taille });
      ligne(doc, sousTitre, xs[iM] + 2, y + 1.6 + taille + 0.8, cols[iM].l - 4, { police: 'Helvetica-Oblique', taille: 5.2, couleur: COULEURS.gris });
    } else {
      cellule(iM, m.nom, { gras: true });
    }
    if (!s.evaluee) {
      const iN = col('note');
      cellule(iN, '—');
      const iC = col('competence') >= 0 ? col('competence') : col('coef');
      if (col('competence') >= 0) cellule(iC, "Pas d'évaluation / No exam", { couleur: COULEURS.gris });
      cellule(col('coef'), String(m.coefficient), { couleur: COULEURS.gris });
      return;
    }
    if (col('competence') >= 0) {
      const iC = col('competence');
      bloc(doc, ctx.competences.get(m.id) ?? '', xs[iC] + 2, y + 1.5, cols[iC].l - 4, h - 2, { taille: 5.4 });
    }
    rappelsPeriodes.forEach((rp, k) => {
      const v = l.detail[k];
      cellule(col(`d-${rp}`), v === null || v === undefined ? '—' : nombre(v));
    });
    cellule(col('note'), nombre(l.note), { gras: true, couleur: l.note! < 10 ? '#a3261b' : COULEURS.encre });
    cellule(col('coef'), String(m.coefficient));
    cellule(col('total'), nombre(l.total));
    cellule(col('rang'), formatRang(l.rang));
    cellule(col('moycl'), nombre(s.moyenne));
    cellule(col('reussite'), pourcent(s.tauxReussite));
    cellule(col('grade'), l.grade ?? '', { gras: true });
    cellule(col('extrema'), `${nombre(s.min)} – ${nombre(s.max)}`);
  }

  y += 6;

  // ---- Blocs du bas : discipline, travail de l'élève, profil de la classe ----
  const hb = 88;
  const l1 = 150;
  const l3 = 160;
  const l2 = L - l1 - l3 - 8;
  const xB2 = X0 + l1 + 4;
  const xB3 = xB2 + l2 + 4;
  const titreBloc = (s: string, x: number, l: number) => {
    cadre(doc, x, y, l, 12, COULEURS.entete);
    ligne(doc, s, x, y + 3, l, { police: 'Helvetica-Bold', taille: 6.6, align: 'center' });
  };
  const rangee = (x: number, l: number, yy: number, lib: string, val: string, opts: { gras?: boolean; lv?: number } = {}) => {
    const lv = opts.lv ?? 42;
    doc.save().lineWidth(0.3).moveTo(x, yy + 10.4).lineTo(x + l, yy + 10.4).stroke(COULEURS.traitFin).restore();
    ligne(doc, lib, x + 3, yy + 2.6, l - lv - 6, { taille: 6.2 });
    ligne(doc, val, x + l - lv - 3, yy + 2.3, lv, { taille: opts.gras ? 7.6 : 6.6, police: opts.gras ? 'Helvetica-Bold' : 'Helvetica', align: 'right' });
  };

  // Discipline : laissée vide en V1, remplie à la main.
  cadre(doc, X0, y, l1, hb);
  titreBloc('Discipline / Conduct', X0, l1);
  [
    'Absences non justifiées (h)',
    'Absences justifiées (h)',
    'Retards / Late',
    'Consignes (h) / Detention',
    'Avertissement / Warning',
    'Blâme / Reprimand',
    'Exclusion (jours / days)',
  ].forEach((lib, i) => rangee(X0, l1, y + 13 + i * 10.6, lib, ''));

  // Travail de l'élève
  cadre(doc, xB2, y, l2, hb);
  titreBloc("Travail de l'élève / Student's performance", xB2, l2);
  const lGauche = l2 * 0.52;
  const yT = y + 13;
  rangee(xB2, lGauche, yT, 'Total des points / Total', nombre(r.totalPoints));
  rangee(xB2, lGauche, yT + 10.6, 'Total des coef. / Coef', String(r.totalCoef));
  rangee(xB2, lGauche, yT + 21.2, 'Moyenne / Average', r.moyenne === null ? '—' : `${nombre(r.moyenne)}/20`, { gras: true, lv: 46 });
  rangee(xB2, lGauche, yT + 31.8, 'Rang / Rank', r.rang ? `${formatRang(r.rang)} / ${classesAvecMoyenne}` : '—', { gras: true });
  ctx.rappels.forEach((rp, k) => {
    const er = rp.resultats.eleves.find((x) => x.inscriptionId === inscriptionId);
    const [fr] = libelleCourt(rp.periode);
    rangee(
      xB2,
      lGauche,
      yT + 42.4 + k * 10.6,
      fr,
      er?.moyenne === null || !er ? '—' : `${nombre(er.moyenne)} (${formatRang(er.rang)})`,
      { lv: 58 },
    );
  });
  // Cotes de compétence, la cote obtenue est cochée
  const xC = xB2 + lGauche;
  const lC = l2 - lGauche;
  doc.save().lineWidth(0.5).moveTo(xC, y + 12).lineTo(xC, y + hb).stroke(COULEURS.trait).restore();
  const cotes = [...donnees.baremes.cotes].sort((a, b) => b.min - a.min);
  cotes.forEach((c, i) => {
    const yy = yT + i * 12.4;
    const coche = r.cote === c.libelle;
    cadre(doc, xC + 4, yy + 2.5, 7, 7, coche ? COULEURS.accent : undefined, COULEURS.trait);
    if (coche) ligne(doc, 'X', xC + 4, yy + 3.2, 7, { police: 'Helvetica-Bold', taille: 6, couleur: '#ffffff', align: 'center' });
    ligne(doc, c.libelle, xC + 14, yy + 2.6, 26, { police: 'Helvetica-Bold', taille: 6.4 });
    ligne(doc, sansPrefixe(c.libelleLong), xC + 38, yy + 3, lC - 41, { taille: 5.2, couleur: COULEURS.gris });
  });

  // Profil de la classe
  const pf = resultats.profil;
  cadre(doc, xB3, y, l3, hb);
  titreBloc('Profil de la classe / Class profile', xB3, l3);
  rangee(xB3, l3, yT, 'Moyenne générale / Class average', nombre(pf.moyenneGenerale), { gras: true });
  rangee(xB3, l3, yT + 10.6, 'Min – Max', pf.min === null ? '—' : `${nombre(pf.min)} – ${nombre(pf.max)}`, { lv: 58 });
  rangee(xB3, l3, yT + 21.2, 'Nombre de moyennes / Passes', String(pf.nombreMoyennes));
  rangee(xB3, l3, yT + 31.8, 'Taux de réussite / Pass rate', pourcent(pf.tauxReussite));
  rangee(xB3, l3, yT + 42.4, 'Élèves classés / Ranked', String(classesAvecMoyenne));
  rangee(xB3, l3, yT + 53, 'Écart-type / Std deviation', nombre(pf.ecartType));
  y += hb + 6;

  // ---- Signatures ----
  const hs = 72;
  const ls = [190, 105, 122, L - 190 - 105 - 122];
  const titresSig = [
    ["Appréciation du travail de l'élève", 'Points forts et points à améliorer'],
    ['Visa du parent / tuteur', "Parent's signature"],
    ['Professeur principal', 'Class master'],
    ["Le Chef d'établissement", 'The Principal'],
  ];
  let xs2 = X0;
  ls.forEach((l, i) => {
    cadre(doc, xs2, y, l, hs);
    ligne(doc, titresSig[i][0], xs2 + 3, y + 3, l - 6, { police: 'Helvetica-Bold', taille: 6.5 });
    ligne(doc, titresSig[i][1], xs2 + 3, y + 11, l - 6, { police: 'Helvetica-Oblique', taille: 5.6, couleur: COULEURS.gris });
    xs2 += l;
  });
  if (classe.profPrincipal) {
    ligne(doc, `${classe.profPrincipal.prenom} ${classe.profPrincipal.nom}`, X0 + ls[0] + ls[1] + 3, y + 21, ls[2] - 6, { taille: 6.6 });
  }
  if (p === 'A') {
    ligne(doc, 'Décision du conseil de classe / Class council decision :', X0 + 3, y + hs - 22, ls[0] - 6, { police: 'Helvetica-Bold', taille: 6 });
    ligne(doc, 'Admis(e) en classe supérieure  /  Redouble  /  Exclu(e)', X0 + 3, y + hs - 12, ls[0] - 6, { taille: 6, couleur: COULEURS.gris });
  }
  y += hs;

  // ---- Pied ----
  const bas = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  ligne(
    doc,
    `${etab.nomFr} · ${classe.nom} · ${e.nom} ${e.prenoms} · édité le ${dateFr(new Date())}`,
    X0,
    A4.hauteur - 13,
    L,
    { taille: 5.4, couleur: COULEURS.gris },
  );
  doc.page.margins.bottom = bas;
}
