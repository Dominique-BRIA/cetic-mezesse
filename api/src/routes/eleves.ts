import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { Prisma, Sexe, StatutInscription } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles, session } from '../lib/auth';
import { anneeDe } from '../lib/annee';
import { texte, texteOptionnel } from '../lib/validation';
import { conflit, introuvable, invalide } from '../lib/erreurs';
import { nouveauMatricule } from '../lib/matricule';
import { deposer, lire } from '../lib/stockage';
import { consigner } from '../lib/decisions';

export const eleves = Router();

const televersement = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

const champsEleve = {
  matriculeNational: texteOptionnel(40),
  nom: texte(80).transform((v) => v.toUpperCase()),
  prenoms: texte(120),
  sexe: z.enum(['M', 'F']),
  dateNaissance: z.coerce.date({ message: 'date invalide' }),
  lieuNaissance: texte(80),
  parentNom: texteOptionnel(120),
  parentTelephone: texteOptionnel(30),
  parentAdresse: texteOptionnel(200),
};

// Champs de la fiche qu'une désapprobation remet en l'état (services/annulation.ts).
const fiche = (e: Prisma.EleveGetPayload<object>) => ({
  matriculeNational: e.matriculeNational,
  nom: e.nom,
  prenoms: e.prenoms,
  sexe: e.sexe,
  dateNaissance: e.dateNaissance,
  lieuNaissance: e.lieuNaissance,
  parentNom: e.parentNom,
  parentTelephone: e.parentTelephone,
  parentAdresse: e.parentAdresse,
});

const inclureInscription = {
  classe: { select: { id: true, nom: true, niveau: true } },
  annee: { select: { id: true, libelle: true } },
} as const;

// Liste des élèves d'une année. Par défaut les actifs ; ?statut=RENVOYE ou TOUS.
eleves.get('/', roles(...DIRECTION), async (req, res) => {
  const anneeId = await anneeDe(req);
  const statut = (req.query.statut as string | undefined) ?? 'ACTIF';
  const classeId = req.query.classeId as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const inscriptions = await prisma.inscription.findMany({
    where: {
      anneeId,
      ...(statut === 'TOUS' ? {} : { statut: statut as StatutInscription }),
      ...(classeId ? { classeId } : {}),
      ...(q
        ? {
            eleve: {
              OR: [
                { nom: { contains: q, mode: 'insensitive' } },
                { prenoms: { contains: q, mode: 'insensitive' } },
                { matricule: { contains: q, mode: 'insensitive' } },
                { matriculeNational: { contains: q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    },
    include: {
      eleve: true,
      ...inclureInscription,
      renvois: { orderBy: { creeLe: 'desc' }, take: 1, include: { par: { select: { nom: true, prenom: true } } } },
    },
    orderBy: [{ classe: { niveau: 'asc' } }, { eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
  });
  res.json(inscriptions);
});

// Modèle de fichier pour l'import en masse.
eleves.get('/modele-import', roles('SURVEILLANT_GENERAL'), async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Élèves');
  ws.columns = COLONNES_IMPORT.map((c) => ({ header: c, key: c, width: 22 }));
  ws.addRow(['MBALLA', 'Jean Pierre', 'M', '14/03/2011', 'Sangmélima', 'Non', '', 'MBALLA Paul', '699000000', 'Mezesse']);
  ws.getRow(1).font = { bold: true };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="modele-import-eleves.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

eleves.get('/:id', roles(...DIRECTION), async (req, res) => {
  const e = await prisma.eleve.findUnique({
    where: { id: String(req.params.id) },
    include: {
      inscriptions: {
        include: {
          ...inclureInscription,
          renvois: {
            orderBy: { creeLe: 'desc' },
            include: {
              par: { select: { nom: true, prenom: true } },
              reintegrePar: { select: { nom: true, prenom: true } },
            },
          },
        },
        orderBy: { annee: { libelle: 'desc' } },
      },
    },
  });
  if (!e) throw introuvable('Élève');
  res.json(e);
});

// Création : le SG et le Proviseur. L'élève est inscrit directement dans une classe de l'année.
eleves.post('/', roles(...DIRECTION), async (req, res) => {
  const { classeId, redoublant, ...data } = z
    .object({ ...champsEleve, classeId: z.string().min(1), redoublant: z.boolean().default(false) })
    .parse(req.body);
  const anneeId = await anneeDe(req);
  const cree = await prisma.$transaction(async (tx) => {
    const { annee, prefixe, classe } = await contexte(tx, anneeId, classeId);
    const matricule = await nouveauMatricule(tx, prefixe, annee.libelle);
    const e = await tx.eleve.create({
      data: { ...data, matricule, inscriptions: { create: { anneeId, classeId, redoublant } } },
    });
    await consigner(
      req,
      {
        domaine: 'SCOLARITE',
        action: 'eleve.inscrire',
        annulation: { eleveId: e.id },
        libelle: `Inscription de ${e.nom} ${e.prenoms} (${e.matricule}) en ${classe.nom}${redoublant ? ', redoublant' : ''}`,
        lien: `/eleves/${e.id}`,
      },
      tx,
    );
    return e;
  });
  res.status(201).json(cree);
});

async function contexte(tx: Prisma.TransactionClient, anneeId: string, classeId: string) {
  const classe = await tx.classe.findUnique({ where: { id: classeId }, include: { annee: true } });
  if (!classe || classe.anneeId !== anneeId) throw invalide("Cette classe n'appartient pas à l'année choisie.");
  const etab = await tx.etablissement.findUnique({ where: { id: 1 } });
  return { annee: classe.annee, prefixe: etab?.prefixeMatricule ?? 'CTM', classe };
}

eleves.put('/:id', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const id = String(req.params.id);
  const { classeId, redoublant, ...data } = z
    .object({ ...champsEleve, classeId: z.string().optional(), redoublant: z.boolean().optional() })
    .parse(req.body);
  const anneeId = await anneeDe(req);
  await prisma.$transaction(async (tx) => {
    const avantFiche = await tx.eleve.findUniqueOrThrow({ where: { id } });
    const e = await tx.eleve.update({ where: { id }, data });
    const ins = await tx.inscription.findUnique({
      where: { eleveId_anneeId: { eleveId: id, anneeId } },
      include: { classe: { select: { nom: true } } },
    });
    const changements: string[] = [];
    if (ins && (classeId !== undefined || redoublant !== undefined)) {
      if (classeId && classeId !== ins.classeId) {
        if (await tx.note.count({ where: { inscriptionId: ins.id } })) {
          throw conflit("L'élève a déjà des notes dans sa classe : le changement de classe n'est plus possible.");
        }
        const { classe } = await contexte(tx, anneeId, classeId);
        changements.push(`changement de classe : ${ins.classe.nom} → ${classe.nom}`);
      }
      if (redoublant !== undefined && redoublant !== ins.redoublant) {
        changements.push(redoublant ? 'déclaré redoublant' : 'ne redouble plus');
      }
      await tx.inscription.update({
        where: { id: ins.id },
        data: { classeId: classeId ?? ins.classeId, redoublant: redoublant ?? ins.redoublant },
      });
    }
    await consigner(
      req,
      {
        domaine: 'SCOLARITE',
        action: 'eleve.modifier',
        annulation: {
          eleveId: id,
          inscriptionId: ins?.id ?? null,
          avant: { ...fiche(avantFiche), classeId: ins?.classeId ?? null, redoublant: ins?.redoublant ?? null },
          apres: {
            ...fiche(e),
            classeId: (classeId || ins?.classeId) ?? null,
            redoublant: redoublant ?? ins?.redoublant ?? null,
          },
        },
        libelle: `Modification de la fiche de ${e.nom} ${e.prenoms}${changements.length ? ` : ${changements.join(', ')}` : ''}`,
        lien: `/eleves/${id}`,
      },
      tx,
    );
  });
  res.json(await prisma.eleve.findUnique({ where: { id } }));
});

// Photo d'identité (affichée sur le bulletin).
eleves.post('/:id/photo', roles(...DIRECTION), televersement.single('photo'), async (req, res) => {
  const id = String(req.params.id);
  const f = req.file;
  if (!f) throw invalide('Aucun fichier reçu.');
  if (!['image/jpeg', 'image/png'].includes(f.mimetype)) throw invalide('Photo en JPEG ou PNG uniquement.');
  const e = await prisma.eleve.findUniqueOrThrow({ where: { id } });
  const cle = `eleves/${id}-${Date.now()}.${f.mimetype === 'image/png' ? 'png' : 'jpg'}`;
  await deposer(cle, f.buffer, f.mimetype);
  await prisma.eleve.update({ where: { id }, data: { photoCle: cle } });
  await consigner(req, {
    domaine: 'SCOLARITE',
    action: 'eleve.photo',
    annulation: { eleveId: id, avantCle: e.photoCle, apresCle: cle },
    libelle: `${e.photoCle ? 'Remplacement' : 'Ajout'} de la photo de ${e.nom} ${e.prenoms}`,
    lien: `/eleves/${id}`,
  });
  res.json({ photoCle: cle });
});

eleves.get('/:id/photo', roles(...DIRECTION), async (req, res) => {
  const e = await prisma.eleve.findUnique({ where: { id: String(req.params.id) }, select: { photoCle: true } });
  const contenu = e?.photoCle ? await lire(e.photoCle) : null;
  if (!contenu) throw introuvable('Photo');
  res.setHeader('Content-Type', e!.photoCle!.endsWith('.png') ? 'image/png' : 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(contenu);
});

// ---------- Import en masse ----------

const COLONNES_IMPORT = [
  'Nom',
  'Prénoms',
  'Sexe (M/F)',
  'Date de naissance (JJ/MM/AAAA)',
  'Lieu de naissance',
  'Redoublant (Oui/Non)',
  'Matricule national',
  'Parent / tuteur',
  'Téléphone parent',
  'Adresse parent',
];

function texteCellule(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('text' in v) return String(v.text);
    if ('result' in v) return String(v.result ?? '');
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
  }
  return String(v).trim();
}

function dateCellule(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return v;
  const t = texteCellule(v);
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    return d.getUTCDate() === Number(m[1]) ? d : null;
  }
  const iso = new Date(t);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

eleves.post('/import', roles('SURVEILLANT_GENERAL'), televersement.single('fichier'), async (req, res) => {
  const f = req.file;
  if (!f) throw invalide('Aucun fichier reçu.');
  const classeId = z.string().min(1, 'classe obligatoire').parse(req.body.classeId);
  const anneeId = await anneeDe(req);

  const wb = new ExcelJS.Workbook();
  const estCsv = f.originalname.toLowerCase().endsWith('.csv');
  let ws: ExcelJS.Worksheet;
  if (estCsv) {
    const { Readable } = await import('node:stream');
    ws = await wb.csv.read(Readable.from(f.buffer), { parserOptions: { delimiter: detecterSeparateur(f.buffer) } });
  } else {
    await wb.xlsx.load(f.buffer as unknown as ArrayBuffer);
    ws = wb.worksheets[0];
  }
  if (!ws) throw invalide('Le fichier ne contient aucune feuille.');

  const erreurs: string[] = [];
  const lignes: (z.infer<typeof ligneSchema> & { ligne: number })[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return; // en-têtes
    const c = (i: number) => row.getCell(i).value;
    if (!texteCellule(c(1)) && !texteCellule(c(2))) return; // ligne vide
    const brut = {
      nom: texteCellule(c(1)),
      prenoms: texteCellule(c(2)),
      sexe: texteCellule(c(3)).toUpperCase().slice(0, 1),
      dateNaissance: dateCellule(c(4)),
      lieuNaissance: texteCellule(c(5)),
      redoublant: /^o|^y|^1/i.test(texteCellule(c(6))),
      matriculeNational: texteCellule(c(7)) || null,
      parentNom: texteCellule(c(8)) || null,
      parentTelephone: texteCellule(c(9)) || null,
      parentAdresse: texteCellule(c(10)) || null,
    };
    const r = ligneSchema.safeParse(brut);
    if (r.success) lignes.push({ ...r.data, ligne: n });
    else erreurs.push(`Ligne ${n} : ${r.error.issues.map((i) => `${String(i.path[0])} ${i.message}`).join(', ')}`);
  });
  if (erreurs.length) throw invalide(`Import refusé, aucun élève créé.\n${erreurs.slice(0, 15).join('\n')}`);
  if (!lignes.length) throw invalide('Aucun élève trouvé dans le fichier.');

  await prisma.$transaction(
    async (tx) => {
      const { annee, prefixe, classe } = await contexte(tx, anneeId, classeId);
      const eleveIds: string[] = [];
      for (const { ligne: _, redoublant, ...data } of lignes) {
        const matricule = await nouveauMatricule(tx, prefixe, annee.libelle);
        const e = await tx.eleve.create({
          data: { ...data, sexe: data.sexe as Sexe, matricule, inscriptions: { create: { anneeId, classeId, redoublant } } },
        });
        eleveIds.push(e.id);
      }
      await consigner(
        req,
        {
          domaine: 'SCOLARITE',
          action: 'eleve.importer',
          libelle: `Import de ${lignes.length} élève(s) en ${classe.nom} (fichier ${f.originalname})`,
          lien: `/eleves?classe=${classeId}`,
          annulation: { eleveIds },
        },
        tx,
      );
    },
    { timeout: 60_000 },
  );
  res.status(201).json({ message: `${lignes.length} élève(s) importé(s).`, nombre: lignes.length });
});

const ligneSchema = z.object({
  ...champsEleve,
  sexe: z.enum(['M', 'F'], { message: 'doit valoir M ou F' }),
  dateNaissance: z.date({ message: 'date invalide (JJ/MM/AAAA)' }),
  redoublant: z.boolean(),
});

function detecterSeparateur(contenu: Buffer): string {
  const premiere = contenu.toString('utf8').split(/\r?\n/)[0] ?? '';
  return (premiere.match(/;/g)?.length ?? 0) > (premiere.match(/,/g)?.length ?? 0) ? ';' : ',';
}

// ---------- Renvoi et réintégration (Proviseur) ----------

eleves.post('/inscriptions/:id/renvoyer', roles('PROVISEUR'), async (req, res) => {
  const id = String(req.params.id);
  const { motif, date } = z.object({ motif: texte(500), date: z.coerce.date() }).parse(req.body);
  const ins = await prisma.inscription.findUniqueOrThrow({ where: { id } });
  if (ins.statut === 'RENVOYE') throw conflit('Cet élève est déjà renvoyé.');
  await prisma.$transaction([
    prisma.inscription.update({ where: { id }, data: { statut: 'RENVOYE' } }),
    prisma.renvoi.create({ data: { inscriptionId: id, motif, date, parId: session(req).id } }),
  ]);
  res.json({ message: 'Élève renvoyé.' });
});

eleves.post('/inscriptions/:id/reintegrer', roles('PROVISEUR'), async (req, res) => {
  const id = String(req.params.id);
  const { motif } = z.object({ motif: texteOptionnel(500) }).parse(req.body);
  const ins = await prisma.inscription.findUniqueOrThrow({
    where: { id },
    include: { renvois: { where: { reintegreLe: null }, orderBy: { creeLe: 'desc' }, take: 1 } },
  });
  if (ins.statut !== 'RENVOYE') throw conflit("Cet élève n'est pas renvoyé.");
  await prisma.$transaction([
    prisma.inscription.update({ where: { id }, data: { statut: 'ACTIF' } }),
    ...ins.renvois.map((r) =>
      prisma.renvoi.update({
        where: { id: r.id },
        data: { reintegreLe: new Date(), reintegreParId: session(req).id, motifReintegration: motif },
      }),
    ),
  ]);
  res.json({ message: 'Élève réintégré.' });
});

// ---------- Réinscription d'une année sur l'autre (SG) ----------

eleves.post('/reinscrire', roles('SURVEILLANT_GENERAL'), async (req, res) => {
  const { eleveIds, classeId, redoublant } = z
    .object({ eleveIds: z.array(z.string()).min(1), classeId: z.string().min(1), redoublant: z.boolean() })
    .parse(req.body);
  const classe = await prisma.classe.findUniqueOrThrow({ where: { id: classeId }, include: { annee: { select: { libelle: true } } } });
  const deja = await prisma.inscription.findMany({
    where: { anneeId: classe.anneeId, eleveId: { in: eleveIds } },
    select: { eleveId: true },
  });
  const aInscrire = eleveIds.filter((id) => !deja.some((d) => d.eleveId === id));
  const creees = await prisma.inscription.createManyAndReturn({
    data: aInscrire.map((eleveId) => ({ eleveId, classeId, anneeId: classe.anneeId, redoublant })),
    select: { id: true },
  });
  if (aInscrire.length) {
    await consigner(req, {
      domaine: 'SCOLARITE',
      action: 'eleve.reinscrire',
      annulation: { inscriptionIds: creees.map((c) => c.id) },
      libelle: `Réinscription de ${aInscrire.length} élève(s) en ${classe.nom} pour ${classe.annee.libelle}${
        redoublant ? ', comme redoublants' : ''
      }`,
      lien: `/eleves?classe=${classeId}`,
    });
  }
  res.json({
    message: `${aInscrire.length} élève(s) inscrit(s) en ${classe.nom}.${
      deja.length ? ` ${deja.length} déjà inscrit(s) cette année, ignoré(s).` : ''
    }`,
  });
});
