import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DIRECTION, roles } from '../lib/auth';
import { anneeDe } from '../lib/annee';
import { periode } from '../lib/validation';
import { arrondi, classer, profilDe, repartition, type CodePeriode } from '../calcul/resultats';
import { chargerBaremes, resultatsClasse, type DonneesClasse } from '../services/resultats';
import { matiereAccessible } from './notes';

export const statistiques = Router();

const SEQUENCES: CodePeriode[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

type Valeur = { sexe: 'M' | 'F'; v: number };

function parSexe(valeurs: Valeur[]) {
  return (['F', 'M'] as const).map((sexe) => {
    const v = valeurs.filter((x) => x.sexe === sexe).map((x) => x.v);
    return { sexe, ...resume(v) };
  });
}

function resume(v: number[]) {
  const p = profilDe(v.map((moyenne) => ({ moyenne })));
  return {
    effectif: v.length,
    moyenne: p.moyenneGenerale,
    min: p.min,
    max: p.max,
    tauxReussite: p.tauxReussite,
    ecartType: p.ecartType,
    reussis: p.nombreMoyennes,
  };
}

function identite(d: DonneesClasse, inscriptionId: string) {
  const i = d.inscriptions.find((x) => x.id === inscriptionId)!;
  return { inscriptionId, eleveId: i.eleveId, matricule: i.eleve.matricule, nom: i.eleve.nom, prenoms: i.eleve.prenoms, sexe: i.eleve.sexe };
}

// Statistiques d'une matière (professeur de la matière ou direction).
statistiques.get('/matiere', async (req, res) => {
  const { matiereId } = z.object({ matiereId: z.string() }).parse(req.query);
  const p = periode(req.query.periode);
  const m = await matiereAccessible(req, matiereId);
  const baremes = await chargerBaremes();
  const d = await resultatsClasse(m.classeId, p, baremes);
  const idx = d.resultats.matieres.findIndex((s) => s.matiere.id === matiereId);
  const stat = d.resultats.matieres[idx];
  const notesEleves = d.resultats.eleves
    .map((r) => ({ ...identite(d, r.inscriptionId), note: r.matieres[idx].note, rang: r.matieres[idx].rang, grade: r.matieres[idx].grade }))
    .filter((e) => e.note !== null)
    .sort((a, b) => b.note! - a.note!);

  // Évolution sur les six séquences
  const evolution = [];
  for (const s of SEQUENCES) {
    const ds = s === p ? d : await resultatsClasse(m.classeId, s, baremes);
    const st = ds.resultats.matieres.find((x) => x.matiere.id === matiereId)!;
    evolution.push({ periode: s, moyenne: st.moyenne, tauxReussite: st.tauxReussite, evaluee: st.evaluee });
  }

  const grades = baremes.grades
    .sort((a, b) => b.min - a.min)
    .map((g) => ({ grade: g.libelle, effectif: notesEleves.filter((e) => e.grade === g.libelle).length }));

  res.json({
    matiere: { id: m.id, nom: m.nom, coefficient: m.coefficient, classe: m.classe },
    periode: p,
    resume: { ...resume(notesEleves.map((e) => e.note!)), evaluee: stat.evaluee },
    repartition: repartition(notesEleves.map((e) => e.note!)),
    grades,
    parSexe: parSexe(notesEleves.map((e) => ({ sexe: e.sexe, v: e.note! }))),
    evolution,
    eleves: notesEleves,
  });
});

// Statistiques d'une classe.
statistiques.get('/classe', roles(...DIRECTION), async (req, res) => {
  const { classeId } = z.object({ classeId: z.string() }).parse(req.query);
  const p = periode(req.query.periode);
  const baremes = await chargerBaremes();
  const d = await resultatsClasse(classeId, p, baremes);
  const moyennes = d.resultats.eleves
    .filter((r) => r.moyenne !== null)
    .map((r) => ({ ...identite(d, r.inscriptionId), moyenne: r.moyenne!, rang: r.rang }))
    .sort((a, b) => b.moyenne - a.moyenne);

  const evolution = [];
  for (const s of [...SEQUENCES, 'T1', 'T2', 'T3'] as CodePeriode[]) {
    const ds = s === p ? d : await resultatsClasse(classeId, s, baremes);
    evolution.push({ periode: s, moyenne: ds.resultats.profil.moyenneGenerale, tauxReussite: ds.resultats.profil.tauxReussite });
  }

  res.json({
    classe: { id: d.classe.id, nom: d.classe.nom },
    periode: p,
    profil: d.resultats.profil,
    repartition: repartition(moyennes.map((m) => m.moyenne)),
    parSexe: parSexe(moyennes.map((m) => ({ sexe: m.sexe, v: m.moyenne }))),
    matieres: d.resultats.matieres.map((s) => ({
      id: s.matiere.id,
      nom: s.matiere.nom,
      coefficient: s.matiere.coefficient,
      professeur: s.matiere.professeur,
      evaluee: s.evaluee,
      moyenne: s.moyenne,
      tauxReussite: s.tauxReussite,
      min: s.min,
      max: s.max,
      ecartType: s.ecartType,
    })),
    evolution,
    classement: moyennes,
  });
});

// Statistiques globales et classement général de l'établissement.
statistiques.get('/etablissement', roles(...DIRECTION), async (req, res) => {
  const anneeId = await anneeDe(req);
  const p = periode(req.query.periode);
  const baremes = await chargerBaremes();
  const classes = await prisma.classe.findMany({ where: { anneeId }, orderBy: [{ niveau: 'asc' }, { nom: 'asc' }] });
  const donnees = await Promise.all(classes.map((c) => resultatsClasse(c.id, p, baremes)));

  const eleves = donnees.flatMap((d) =>
    d.resultats.eleves.map((r) => ({
      ...identite(d, r.inscriptionId),
      classe: { id: d.classe.id, nom: d.classe.nom },
      moyenne: r.moyenne,
      rangClasse: r.rang,
    })),
  );
  const avecMoyenne = eleves.filter((e) => e.moyenne !== null);
  const rangs = classer(avecMoyenne, (e) => e.moyenne);
  const classement = avecMoyenne
    .map((e) => ({ ...e, rang: rangs.get(e)! }))
    .sort((a, b) => a.rang.rang - b.rang.rang || a.nom.localeCompare(b.nom));

  const parClasse = donnees.map((d) => ({
    id: d.classe.id,
    nom: d.classe.nom,
    niveau: d.classe.niveau,
    ...d.resultats.profil,
  }));
  const classesNotees = parClasse.filter((c) => c.moyenneGenerale !== null);
  const rangsClasses = classer(classesNotees, (c) => c.moyenneGenerale);
  const classesClassees = classesNotees
    .map((c) => ({ ...c, rang: rangsClasses.get(c)! }))
    .sort((a, b) => a.rang.rang - b.rang.rang);

  // Matières communes à plusieurs classes, comparées par nom
  const parMatiere = new Map<string, { nom: string; moyennes: number[]; taux: number[] }>();
  for (const d of donnees) {
    for (const s of d.resultats.matieres) {
      if (!s.evaluee) continue;
      const cle = s.matiere.nom.toLowerCase();
      const m = parMatiere.get(cle) ?? { nom: s.matiere.nom, moyennes: [], taux: [] };
      m.moyennes.push(s.moyenne!);
      m.taux.push(s.tauxReussite!);
      parMatiere.set(cle, m);
    }
  }

  const effectifs = await prisma.inscription.groupBy({ by: ['statut'], where: { anneeId }, _count: true });
  const enseignants = await prisma.utilisateur.count({ where: { role: 'PROFESSEUR', actif: true } });

  res.json({
    periode: p,
    totaux: {
      eleves: effectifs.find((e) => e.statut === 'ACTIF')?._count ?? 0,
      renvoyes: effectifs.find((e) => e.statut === 'RENVOYE')?._count ?? 0,
      classes: classes.length,
      enseignants,
      filles: eleves.filter((e) => e.sexe === 'F').length,
      garcons: eleves.filter((e) => e.sexe === 'M').length,
    },
    resume: resume(avecMoyenne.map((e) => e.moyenne!)),
    repartition: repartition(avecMoyenne.map((e) => e.moyenne!)),
    parSexe: parSexe(avecMoyenne.map((e) => ({ sexe: e.sexe, v: e.moyenne! }))),
    premier: classement.filter((e) => e.rang.rang === 1),
    dernier: classement.length ? classement.filter((e) => e.rang.rang === classement[classement.length - 1].rang.rang) : [],
    premiereClasse: classesClassees[0] ?? null,
    derniereClasse: classesClassees.length > 1 ? classesClassees[classesClassees.length - 1] : null,
    classes: classesClassees.concat(parClasse.filter((c) => c.moyenneGenerale === null).map((c) => ({ ...c, rang: null as never }))),
    matieres: [...parMatiere.values()]
      .map((m) => ({
        nom: m.nom,
        classes: m.moyennes.length,
        moyenne: arrondi(m.moyennes.reduce((a, b) => a + b, 0) / m.moyennes.length),
        tauxReussite: arrondi(m.taux.reduce((a, b) => a + b, 0) / m.taux.length),
      }))
      .sort((a, b) => b.moyenne - a.moyenne),
    classement,
  });
});
