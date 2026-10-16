import { Router, type Response } from 'express';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles } from '../lib/auth';
import { introuvable, invalide } from '../lib/erreurs';
import { periode } from '../lib/validation';
import { lire } from '../lib/stockage';
import { formatRang, libellePeriode, PERIODES, type CodePeriode } from '../calcul/resultats';
import { chargerBaremes, resultatsClasse } from '../services/resultats';
import { dessinerBulletin } from '../pdf/bulletin';
import { dateFr, enBuffer, nouveauDocument } from '../pdf/commun';
import { listeClasse } from '../pdf/liste';

export const documents = Router();

documents.use(roles(...DIRECTION));

async function etablissement() {
  const e = await prisma.etablissement.findUnique({ where: { id: 1 } });
  if (!e) throw invalide("Renseignez d'abord les informations de l'établissement (Paramètres).");
  return e;
}

function nomFichier(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function envoyerPdf(res: Response, contenu: Buffer, nom: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nom}.pdf"`);
  res.send(contenu);
}

async function envoyerExcel(res: Response, wb: ExcelJS.Workbook, nom: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nom}.xlsx"`);
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
}

// Sous-périodes rappelées sur un bulletin : les séquences d'un trimestre, les trimestres de l'année.
function sousPeriodes(p: CodePeriode): CodePeriode[] {
  if (p === 'A') return ['T1', 'T2', 'T3'];
  if (p[0] === 'T') {
    const n = Number(p.slice(1));
    return [`S${2 * n - 1}`, `S${2 * n}`] as CodePeriode[];
  }
  return [];
}

// Bulletins d'une ou plusieurs classes, ou de quelques élèves : un seul PDF, une page par élève.
documents.post('/bulletins', async (req, res) => {
  const { classeIds, inscriptionIds } = z
    .object({ classeIds: z.array(z.string()).default([]), inscriptionIds: z.array(z.string()).default([]) })
    .parse(req.body);
  const p = periode(req.body.periode);
  if (!classeIds.length && !inscriptionIds.length) throw invalide('Choisissez au moins une classe ou un élève.');

  const etab = await etablissement();
  const baremes = await chargerBaremes();
  // Classes concernées et, pour chacune, les élèves à imprimer (tous si la classe est choisie entière).
  const choisies = inscriptionIds.length
    ? await prisma.inscription.findMany({ where: { id: { in: inscriptionIds }, statut: 'ACTIF' }, select: { id: true, classeId: true } })
    : [];
  const parClasse = new Map<string, Set<string> | 'toutes'>();
  for (const c of classeIds) parClasse.set(c, 'toutes');
  for (const i of choisies) {
    const actuel = parClasse.get(i.classeId);
    if (actuel === 'toutes') continue;
    parClasse.set(i.classeId, (actuel ?? new Set()).add(i.id));
  }

  const doc = nouveauDocument(`Bulletins – ${libellePeriode(p)}`);
  let premiere = true;
  const classes = await prisma.classe.findMany({
    where: { id: { in: [...parClasse.keys()] } },
    orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
  });
  for (const c of classes) {
    const donnees = await resultatsClasse(c.id, p, baremes);
    const rappels = [];
    for (const sp of sousPeriodes(p)) {
      rappels.push({ periode: sp, resultats: (await resultatsClasse(c.id, sp, baremes)).resultats });
    }
    const competences = new Map<string, string>();
    if (p[0] === 'S') {
      const lignes = await prisma.competenceVisee.findMany({
        where: { matiere: { classeId: c.id }, sequence: { anneeId: c.anneeId, numero: Number(p.slice(1)) } },
      });
      for (const l of lignes) competences.set(l.matiereId, l.texte);
    }
    const selection = parClasse.get(c.id)!;
    const aImprimer = donnees.inscriptions.filter((i) => selection === 'toutes' || selection.has(i.id));
    const photos = new Map<string, Buffer>();
    await Promise.all(
      aImprimer.map(async (i) => {
        if (!i.eleve.photoCle) return;
        const b = await lire(i.eleve.photoCle);
        if (b) photos.set(i.eleveId, b);
      }),
    );
    for (const i of aImprimer) {
      if (!premiere) doc.addPage();
      premiere = false;
      dessinerBulletin(doc, { etab, donnees, rappels, competences, photos }, i.id);
    }
  }
  if (premiere) throw invalide('Aucun élève actif à imprimer.');
  const nom =
    classes.length === 1 ? `bulletins-${nomFichier(classes[0].nom)}-${p}` : `bulletins-${p}-${classes.length}-classes`;
  envoyerPdf(res, await enBuffer(doc), nom);
});

async function chargerListe(classeId: string) {
  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    include: { annee: true, profPrincipal: { select: { nom: true, prenom: true } } },
  });
  if (!classe) throw introuvable('Classe');
  const inscriptions = await prisma.inscription.findMany({
    where: { classeId, statut: 'ACTIF' },
    include: { eleve: true },
    orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
  });
  return { classe, inscriptions };
}

// Liste des élèves d'une classe, en PDF ou en Excel.
documents.get('/liste', async (req, res) => {
  const { classeId, format } = z
    .object({ classeId: z.string(), format: z.enum(['pdf', 'xlsx']).default('pdf') })
    .parse(req.query);
  const { classe, inscriptions } = await chargerListe(classeId);
  const nom = `liste-${nomFichier(classe.nom)}-${classe.annee.libelle}`;
  const pp = classe.profPrincipal ? `${classe.profPrincipal.prenom} ${classe.profPrincipal.nom}` : null;

  if (format === 'pdf') {
    const etab = await etablissement();
    const doc = listeClasse(
      etab,
      { nom: classe.nom, annee: classe.annee.libelle, profPrincipal: pp },
      inscriptions.map((i) => ({ ...i.eleve, redoublant: i.redoublant })),
    );
    envoyerPdf(res, await enBuffer(doc), nom);
    return;
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(classe.nom.slice(0, 31));
  ws.addRow([`Liste des élèves – ${classe.nom} – ${classe.annee.libelle}`]).font = { bold: true, size: 13 };
  ws.addRow([`Effectif : ${inscriptions.length}${pp ? ` – Professeur principal : ${pp}` : ''}`]);
  ws.addRow([]);
  const entete = ws.addRow([
    'N°',
    'Matricule',
    'Matricule national',
    'Nom',
    'Prénoms',
    'Sexe',
    'Date de naissance',
    'Lieu de naissance',
    'Redoublant',
    'Parent / tuteur',
    'Téléphone parent',
    'Adresse parent',
  ]);
  entete.font = { bold: true };
  entete.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE7F1' } };
    c.border = { bottom: { style: 'thin' } };
  });
  inscriptions.forEach((i, k) => {
    const e = i.eleve;
    ws.addRow([
      k + 1,
      e.matricule,
      e.matriculeNational ?? '',
      e.nom,
      e.prenoms,
      e.sexe,
      dateFr(e.dateNaissance),
      e.lieuNaissance,
      i.redoublant ? 'Oui' : 'Non',
      e.parentNom ?? '',
      e.parentTelephone ?? '',
      e.parentAdresse ?? '',
    ]);
  });
  [5, 13, 18, 18, 24, 6, 16, 18, 11, 22, 16, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  await envoyerExcel(res, wb, nom);
});

// Relevé des notes d'une classe sur une période (Excel).
documents.get('/releve', async (req, res) => {
  const { classeId } = z.object({ classeId: z.string() }).parse(req.query);
  const p = periode(req.query.periode);
  const { classe, inscriptions, resultats } = await resultatsClasse(classeId, p);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${p}`);
  ws.addRow([`Relevé de notes – ${classe.nom} – ${libellePeriode(p)} – ${classe.annee.libelle}`]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const entete = ws.addRow([
    'Matricule',
    'Nom et prénoms',
    'Sexe',
    ...resultats.matieres.map((s) => `${s.matiere.nom} (coef ${s.matiere.coefficient})`),
    'Total coef',
    'Total points',
    'Moyenne',
    'Rang',
  ]);
  entete.font = { bold: true };
  entete.alignment = { wrapText: true, vertical: 'middle' };
  entete.height = 42;
  for (const r of [...resultats.eleves].sort((a, b) => (a.rang?.rang ?? 999) - (b.rang?.rang ?? 999))) {
    const i = inscriptions.find((x) => x.id === r.inscriptionId)!;
    ws.addRow([
      i.eleve.matricule,
      `${i.eleve.nom} ${i.eleve.prenoms}`,
      i.eleve.sexe,
      ...r.matieres.map((l) => (l.note === null ? '' : Math.round(l.note * 100) / 100)),
      r.totalCoef,
      Math.round(r.totalPoints * 100) / 100,
      r.moyenne === null ? '' : Math.round(r.moyenne * 100) / 100,
      formatRang(r.rang),
    ]);
  }
  ws.addRow([]);
  ws.addRow(['', 'Moyenne de la classe', '', ...resultats.matieres.map((s) => (s.moyenne === null ? '' : Math.round(s.moyenne * 100) / 100))]).font = { italic: true };
  ws.getColumn(1).width = 13;
  ws.getColumn(2).width = 30;
  for (let c = 4; c < 4 + resultats.matieres.length + 4; c++) ws.getColumn(c).width = 12;
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];
  await envoyerExcel(res, wb, `releve-${nomFichier(classe.nom)}-${p}`);
});

export const periodesDisponibles = PERIODES;
