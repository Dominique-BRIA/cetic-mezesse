import type { Prisma } from '@prisma/client';
import { conflit } from '../lib/erreurs';
import { numeroSuivant, renommerGroupe } from '../lib/classes';
import { notifierOuvertureSequence } from '../lib/notifications';

// Désapprouver une décision du SG défait son action (RG-30). Chaque décision garde dans
// `annulation` de quoi revenir en arrière ; ce module applique ce retour, dans la même
// transaction que la désapprobation. Une annulation devenue impossible lève un conflit
// qui explique pourquoi, et la décision reste approuvée.

type Tx = Prisma.TransactionClient;
type Valeurs = Record<string, unknown>;

// Ce que la désapprobation fera, affiché au Proviseur avant de confirmer.
export const EFFETS: Record<string, string> = {
  'classe.creer': 'La classe sera supprimée.',
  'classe.modifier': 'La classe reprendra ses valeurs précédentes.',
  'classe.supprimer': 'La classe sera recréée avec ses matières.',
  'specialite.creer': 'La spécialité sera supprimée.',
  'specialite.modifier': 'La spécialité reprendra son ancien nom, et ses classes aussi.',
  'specialite.supprimer': 'La spécialité sera recréée.',
  'groupe.creer': 'Le groupe de matières sera supprimé.',
  'groupe.modifier': 'Le groupe de matières reprendra ses valeurs précédentes.',
  'groupe.supprimer': 'Le groupe de matières sera recréé.',
  'matiere.creer': 'La matière sera supprimée.',
  'matiere.modifier': 'La matière reprendra ses valeurs précédentes.',
  'matiere.supprimer': 'La matière sera recréée, sans les notes effacées avec elle.',
  'enseignant.creer': "Le compte sera supprimé, ou seulement désactivé si l'enseignant a déjà saisi des notes.",
  'enseignant.modifier': 'Le compte reprendra ses valeurs précédentes.',
  'enseignant.desactiver': 'Le compte sera réactivé.',
  'enseignant.reactiver': 'Le compte sera de nouveau désactivé.',
  'enseignant.reinitialiser': "L'ancien mot de passe sera rétabli.",
  'eleve.inscrire': "L'élève sera retiré de la plateforme.",
  'eleve.modifier': 'La fiche de l’élève reprendra ses valeurs précédentes.',
  'eleve.photo': "L'ancienne photo sera remise.",
  'eleve.importer': 'Les élèves importés seront retirés de la plateforme.',
  'eleve.reinscrire': 'Ces réinscriptions seront retirées.',
  'annee.creer': "L'année scolaire sera supprimée.",
  'annee.activer': "L'année qui était en cours le redeviendra.",
  'sequence.ouvrir': 'La saisie des notes sera refermée.',
  'sequence.fermer': 'La saisie des notes sera rouverte.',
  'etablissement.modifier': "Les informations de l'établissement reprendront leurs valeurs précédentes.",
  'bareme.modifier': "L'ancien barème sera rétabli.",
};

export interface Resultat {
  effet: string;
  fichiersASupprimer?: string[]; // à retirer du stockage une fois la transaction validée
}

const norme = (v: unknown) => JSON.stringify(v instanceof Date ? v.toISOString() : (v ?? null));
const egal = (a: unknown, b: unknown) => norme(a) === norme(b);

// Ne remet que les champs encore tels que la décision les avait laissés :
// une modification faite depuis, par une autre décision, n'est pas écrasée.
function aRestaurer(actuel: Valeurs, avant: Valeurs, apres: Valeurs): Valeurs {
  const r: Valeurs = {};
  for (const k of Object.keys(avant)) {
    if (!egal(avant[k], apres[k]) && egal(actuel[k], apres[k])) r[k] = avant[k];
  }
  return r;
}

const vide = (v: Valeurs) => Object.keys(v).length === 0;
const RIEN = { effet: 'Rien à défaire : les valeurs ont été modifiées depuis par une autre décision.' };

export async function annuler(tx: Tx, action: string, a: Valeurs): Promise<Resultat> {
  switch (action) {
    // ---------- Classes ----------
    case 'classe.creer': {
      const c = await tx.classe.findUnique({ where: { id: a.classeId as string }, include: { _count: { select: { inscriptions: true } } } });
      if (!c) return { effet: 'La classe avait déjà été supprimée.' };
      if (c._count.inscriptions) throw conflit(`${c.nom} a maintenant ${c._count.inscriptions} élève(s) inscrit(s) : retirez-les avant de désapprouver.`);
      await tx.classe.delete({ where: { id: c.id } });
      await renommerGroupe(tx, c.anneeId, c.niveau, c.specialiteId);
      return { effet: `${c.nom} a été supprimée.` };
    }
    case 'classe.modifier': {
      const c = await tx.classe.findUnique({ where: { id: a.classeId as string } });
      if (!c) throw conflit("Cette classe n'existe plus.");
      const data = aRestaurer(c, a.avant as Valeurs, a.apres as Valeurs);
      if (vide(data)) return RIEN;
      const niveau = (data.niveau as number | undefined) ?? c.niveau;
      const specialiteId = 'specialiteId' in data ? (data.specialiteId as string | null) : c.specialiteId;
      const deplacee = niveau !== c.niveau || specialiteId !== c.specialiteId;
      if (specialiteId && !(await tx.specialite.count({ where: { id: specialiteId } }))) throw conflit("L'ancienne spécialité n'existe plus.");
      await tx.classe.update({
        where: { id: c.id },
        data: { ...data, ...(deplacee ? { numero: await numeroSuivant(tx, c.anneeId, niveau, specialiteId) } : {}) },
      });
      if (deplacee) {
        await renommerGroupe(tx, c.anneeId, c.niveau, c.specialiteId);
        await renommerGroupe(tx, c.anneeId, niveau, specialiteId);
      }
      const apres = await tx.classe.findUniqueOrThrow({ where: { id: c.id } });
      return { effet: `${apres.nom} a repris ses valeurs précédentes.` };
    }
    case 'classe.supprimer': {
      const groupes = await tx.groupeMatiere.findMany({ where: { id: { in: a.groupeIds as string[] } }, select: { id: true } });
      const existants = new Set(groupes.map((g) => g.id));
      const matieres = (a.matieres as Valeurs[]).filter((m) => existants.has(m.groupeId as string));
      const prof = a.profPrincipalId ? await tx.utilisateur.count({ where: { id: a.profPrincipalId as string } }) : 0;
      if (a.specialiteId && !(await tx.specialite.count({ where: { id: a.specialiteId as string } }))) {
        throw conflit("La spécialité de cette classe n'existe plus : recréez-la d'abord.");
      }
      const profs = new Set(
        (await tx.utilisateur.findMany({ where: { id: { in: matieres.map((m) => m.professeurId as string).filter(Boolean) } }, select: { id: true } })).map(
          (u) => u.id,
        ),
      );
      const c = await tx.classe.create({
        data: {
          anneeId: a.anneeId as string,
          niveau: a.niveau as number,
          specialiteId: (a.specialiteId as string | null) ?? null,
          numero: a.numero as number,
          nom: `…${a.anneeId}-${Date.now()}`,
          profPrincipalId: prof ? (a.profPrincipalId as string) : null,
          groupes: { connect: groupes },
          matieres: {
            create: matieres.map((m) => ({
              nom: m.nom as string,
              nomEn: (m.nomEn as string | null) ?? null,
              coefficient: m.coefficient as number,
              ordre: m.ordre as number,
              groupeId: m.groupeId as string,
              professeurId: profs.has(m.professeurId as string) ? (m.professeurId as string) : null,
            })),
          },
        },
      });
      await renommerGroupe(tx, c.anneeId, c.niveau, c.specialiteId);
      const finale = await tx.classe.findUniqueOrThrow({ where: { id: c.id } });
      const perdues = (a.matieres as unknown[]).length - matieres.length;
      return { effet: `${finale.nom} a été recréée avec ${matieres.length} matière(s)${perdues ? ` (${perdues} dont le groupe n'existe plus)` : ''}.` };
    }

    // ---------- Spécialités ----------
    case 'specialite.creer': {
      const s = await tx.specialite.findUnique({ where: { id: a.id as string }, include: { _count: { select: { classes: true } } } });
      if (!s) return { effet: 'La spécialité avait déjà été supprimée.' };
      if (s._count.classes) throw conflit(`La spécialité ${s.nom} est maintenant portée par ${s._count.classes} classe(s) : changez-les d'abord.`);
      await tx.specialite.delete({ where: { id: s.id } });
      return { effet: `La spécialité ${s.nom} a été supprimée.` };
    }
    case 'specialite.modifier': {
      const s = await tx.specialite.findUnique({ where: { id: a.id as string } });
      if (!s) throw conflit("Cette spécialité n'existe plus.");
      const data = aRestaurer(s, a.avant as Valeurs, a.apres as Valeurs);
      if (vide(data)) return RIEN;
      await tx.specialite.update({ where: { id: s.id }, data });
      const groupes = await tx.classe.findMany({ where: { specialiteId: s.id }, distinct: ['anneeId', 'niveau'], select: { anneeId: true, niveau: true } });
      for (const g of groupes) await renommerGroupe(tx, g.anneeId, g.niveau, s.id);
      return { effet: `La spécialité a repris le nom ${(data.nom as string | undefined) ?? s.nom}.` };
    }
    case 'specialite.supprimer': {
      const s = await tx.specialite.create({ data: { nom: a.nom as string, nomEn: (a.nomEn as string | null) ?? null } });
      return { effet: `La spécialité ${s.nom} a été recréée.` };
    }

    // ---------- Groupes de matières ----------
    case 'groupe.creer': {
      const g = await tx.groupeMatiere.findUnique({ where: { id: a.id as string }, include: { _count: { select: { matieres: true } } } });
      if (!g) return { effet: 'Le groupe avait déjà été supprimé.' };
      if (g._count.matieres) throw conflit(`Le groupe ${g.nom} contient maintenant ${g._count.matieres} matière(s) : déplacez-les d'abord.`);
      await tx.groupeMatiere.delete({ where: { id: g.id } });
      return { effet: `Le groupe ${g.nom} a été supprimé.` };
    }
    case 'groupe.modifier': {
      const g = await tx.groupeMatiere.findUnique({ where: { id: a.id as string }, include: { classes: { select: { id: true } } } });
      if (!g) throw conflit("Ce groupe n'existe plus.");
      const tri = (ids: unknown) => [...(ids as string[])].sort();
      const actuel = { nom: g.nom, nomEn: g.nomEn, ordre: g.ordre, classeIds: tri(g.classes.map((c) => c.id)) };
      const avant = { ...(a.avant as Valeurs), classeIds: tri((a.avant as Valeurs).classeIds) };
      const apres = { ...(a.apres as Valeurs), classeIds: tri((a.apres as Valeurs).classeIds) };
      const { classeIds, ...data } = aRestaurer(actuel, avant, apres);
      if (vide(data) && !classeIds) return RIEN;
      if (classeIds) {
        const ids = (classeIds as string[]).filter(Boolean);
        const bloquantes = await tx.matiere.count({ where: { groupeId: g.id, classeId: { notIn: ids } } });
        if (bloquantes) throw conflit("Des matières de ce groupe appartiennent à des classes qu'il faudrait retirer : déplacez-les d'abord.");
        const existantes = await tx.classe.findMany({ where: { id: { in: ids } }, select: { id: true } });
        await tx.groupeMatiere.update({ where: { id: g.id }, data: { classes: { set: existantes } } });
      }
      if (!vide(data)) await tx.groupeMatiere.update({ where: { id: g.id }, data });
      return { effet: `Le groupe ${(data.nom as string | undefined) ?? g.nom} a repris ses valeurs précédentes.` };
    }
    case 'groupe.supprimer': {
      const classes = await tx.classe.findMany({ where: { id: { in: a.classeIds as string[] } }, select: { id: true } });
      const g = await tx.groupeMatiere.create({
        data: {
          anneeId: a.anneeId as string,
          nom: a.nom as string,
          nomEn: (a.nomEn as string | null) ?? null,
          ordre: a.ordre as number,
          classes: { connect: classes },
        },
      });
      return { effet: `Le groupe ${g.nom} a été recréé.` };
    }

    // ---------- Matières ----------
    case 'matiere.creer': {
      const m = await tx.matiere.findUnique({ where: { id: a.id as string }, include: { _count: { select: { notes: true } }, classe: true } });
      if (!m) return { effet: 'La matière avait déjà été supprimée.' };
      if (m._count.notes) throw conflit(`${m._count.notes} note(s) ont déjà été saisies en ${m.nom} : la matière ne peut plus être retirée automatiquement.`);
      await tx.matiere.delete({ where: { id: m.id } });
      return { effet: `La matière ${m.nom} (${m.classe.nom}) a été supprimée.` };
    }
    case 'matiere.modifier': {
      const m = await tx.matiere.findUnique({ where: { id: a.id as string } });
      if (!m) throw conflit("Cette matière n'existe plus.");
      const data = aRestaurer(m, a.avant as Valeurs, a.apres as Valeurs);
      if (vide(data)) return RIEN;
      const classeId = (data.classeId as string | undefined) ?? m.classeId;
      const groupeId = (data.groupeId as string | undefined) ?? m.groupeId;
      if (classeId !== m.classeId && (await tx.note.count({ where: { matiereId: m.id } }))) {
        throw conflit('Des notes ont été saisies depuis : la matière ne peut plus revenir dans son ancienne classe.');
      }
      if (!(await tx.groupeMatiere.count({ where: { id: groupeId, classes: { some: { id: classeId } } } }))) {
        throw conflit("L'ancien groupe n'est plus rattaché à cette classe.");
      }
      if (data.professeurId && !(await tx.utilisateur.count({ where: { id: data.professeurId as string } }))) delete data.professeurId;
      await tx.matiere.update({ where: { id: m.id }, data });
      return { effet: `La matière ${(data.nom as string | undefined) ?? m.nom} a repris ses valeurs précédentes.` };
    }
    case 'matiere.supprimer': {
      const ok = await tx.groupeMatiere.count({ where: { id: a.groupeId as string, classes: { some: { id: a.classeId as string } } } });
      if (!ok) throw conflit("La classe ou le groupe de cette matière n'existe plus.");
      const prof = a.professeurId ? await tx.utilisateur.count({ where: { id: a.professeurId as string } }) : 0;
      const m = await tx.matiere.create({
        data: {
          classeId: a.classeId as string,
          groupeId: a.groupeId as string,
          nom: a.nom as string,
          nomEn: (a.nomEn as string | null) ?? null,
          coefficient: a.coefficient as number,
          ordre: a.ordre as number,
          professeurId: prof ? (a.professeurId as string) : null,
        },
      });
      const notes = a.notes as number;
      return { effet: `La matière ${m.nom} a été recréée${notes ? ` ; ses ${notes} note(s) effacée(s) ne sont pas récupérables` : ''}.` };
    }

    // ---------- Enseignants ----------
    case 'enseignant.creer': {
      const u = await tx.utilisateur.findUnique({ where: { id: a.id as string }, include: { _count: { select: { notesSaisies: true } } } });
      if (!u) return { effet: 'Le compte avait déjà été supprimé.' };
      if (u._count.notesSaisies) {
        await tx.utilisateur.update({ where: { id: u.id }, data: { actif: false } });
        return { effet: `${u.prenom} ${u.nom} a déjà saisi des notes : son compte a été désactivé plutôt que supprimé.` };
      }
      await tx.utilisateur.delete({ where: { id: u.id } });
      return { effet: `Le compte de ${u.prenom} ${u.nom} a été supprimé.` };
    }
    case 'enseignant.modifier':
    case 'enseignant.desactiver':
    case 'enseignant.reactiver': {
      const u = await tx.utilisateur.findUnique({ where: { id: a.id as string } });
      if (!u) throw conflit("Ce compte n'existe plus.");
      const data = aRestaurer(u, a.avant as Valeurs, a.apres as Valeurs);
      if (vide(data)) return RIEN;
      await tx.utilisateur.update({ where: { id: u.id }, data });
      return { effet: `Le compte de ${u.prenom} ${u.nom} a repris ses valeurs précédentes.` };
    }
    case 'enseignant.reinitialiser': {
      const u = await tx.utilisateur.findUnique({ where: { id: a.id as string } });
      if (!u) throw conflit("Ce compte n'existe plus.");
      if (u.motDePasse !== a.apresHash) throw conflit(`${u.prenom} ${u.nom} a déjà choisi un nouveau mot de passe depuis la réinitialisation.`);
      await tx.utilisateur.update({
        where: { id: u.id },
        data: { motDePasse: a.avantHash as string, doitChangerMotDePasse: a.avantDoitChanger as boolean },
      });
      return { effet: `${u.prenom} ${u.nom} retrouve son ancien mot de passe.` };
    }

    // ---------- Élèves ----------
    case 'eleve.inscrire': {
      const e = await tx.eleve.findUnique({ where: { id: a.eleveId as string } });
      if (!e) return { effet: "L'élève avait déjà été retiré." };
      const notes = await tx.note.count({ where: { inscription: { eleveId: e.id } } });
      if (notes) throw conflit(`${e.nom} ${e.prenoms} a déjà ${notes} note(s) : l'élève ne peut plus être retiré automatiquement.`);
      await tx.eleve.delete({ where: { id: e.id } });
      return { effet: `${e.nom} ${e.prenoms} (${e.matricule}) a été retiré de la plateforme.`, fichiersASupprimer: e.photoCle ? [e.photoCle] : [] };
    }
    case 'eleve.modifier': {
      const e = await tx.eleve.findUnique({ where: { id: a.eleveId as string } });
      if (!e) throw conflit("Cet élève n'existe plus.");
      const { classeId: _c, redoublant: _r, ...avantEleve } = a.avant as Valeurs;
      const { classeId: _c2, redoublant: _r2, ...apresEleve } = a.apres as Valeurs;
      const dataEleve = aRestaurer(e, avantEleve, apresEleve);
      let dataIns: Valeurs = {};
      if (a.inscriptionId) {
        const ins = await tx.inscription.findUnique({ where: { id: a.inscriptionId as string } });
        if (ins) {
          const avant = a.avant as Valeurs;
          const apres = a.apres as Valeurs;
          dataIns = aRestaurer(ins, { classeId: avant.classeId, redoublant: avant.redoublant }, { classeId: apres.classeId, redoublant: apres.redoublant });
          if (dataIns.classeId) {
            if (await tx.note.count({ where: { inscriptionId: ins.id } })) {
              throw conflit("L'élève a des notes dans sa nouvelle classe : il ne peut plus revenir dans l'ancienne.");
            }
            if (!(await tx.classe.count({ where: { id: dataIns.classeId as string } }))) throw conflit("L'ancienne classe n'existe plus.");
          }
          if (!vide(dataIns)) await tx.inscription.update({ where: { id: ins.id }, data: dataIns });
        }
      }
      if (vide(dataEleve) && vide(dataIns)) return RIEN;
      const remis = vide(dataEleve) ? e : await tx.eleve.update({ where: { id: e.id }, data: dataEleve });
      return { effet: `La fiche de ${remis.nom} ${remis.prenoms} a repris ses valeurs précédentes.` };
    }
    case 'eleve.photo': {
      const e = await tx.eleve.findUnique({ where: { id: a.eleveId as string } });
      if (!e) throw conflit("Cet élève n'existe plus.");
      if (e.photoCle !== a.apresCle) return { effet: 'La photo a été changée depuis : rien à défaire.' };
      await tx.eleve.update({ where: { id: e.id }, data: { photoCle: (a.avantCle as string | null) ?? null } });
      return { effet: `La photo précédente de ${e.nom} ${e.prenoms} a été remise.`, fichiersASupprimer: [a.apresCle as string] };
    }
    case 'eleve.importer': {
      const ids = a.eleveIds as string[];
      const notes = await tx.note.count({ where: { inscription: { eleveId: { in: ids } } } });
      if (notes) throw conflit(`Des élèves importés ont déjà ${notes} note(s) : l'import ne peut plus être défait automatiquement.`);
      const photos = await tx.eleve.findMany({ where: { id: { in: ids }, photoCle: { not: null } }, select: { photoCle: true } });
      const { count } = await tx.eleve.deleteMany({ where: { id: { in: ids } } });
      return { effet: `${count} élève(s) importé(s) ont été retirés.`, fichiersASupprimer: photos.map((p) => p.photoCle!) };
    }
    case 'eleve.reinscrire': {
      const ids = a.inscriptionIds as string[];
      const notes = await tx.note.count({ where: { inscriptionId: { in: ids } } });
      if (notes) throw conflit(`Des élèves réinscrits ont déjà ${notes} note(s) : la réinscription ne peut plus être défaite automatiquement.`);
      const { count } = await tx.inscription.deleteMany({ where: { id: { in: ids } } });
      return { effet: `${count} réinscription(s) retirée(s).` };
    }

    // ---------- Administration ----------
    case 'annee.creer': {
      const an = await tx.anneeScolaire.findUnique({ where: { id: a.id as string }, include: { _count: { select: { inscriptions: true } } } });
      if (!an) return { effet: "L'année avait déjà été supprimée." };
      if (an._count.inscriptions) throw conflit(`L'année ${an.libelle} compte déjà ${an._count.inscriptions} inscription(s) : elle ne peut plus être supprimée.`);
      await tx.anneeScolaire.delete({ where: { id: an.id } });
      if (an.active && a.activeAvantId) {
        await tx.anneeScolaire.updateMany({ where: { id: a.activeAvantId as string }, data: { active: true } });
      }
      return { effet: `L'année ${an.libelle} a été supprimée.` };
    }
    case 'annee.activer': {
      if (!a.activeAvantId) return { effet: "Aucune année n'était en cours avant : rien à défaire." };
      const avant = await tx.anneeScolaire.findUnique({ where: { id: a.activeAvantId as string } });
      if (!avant) throw conflit("L'année qui était en cours n'existe plus.");
      await tx.anneeScolaire.updateMany({ where: { id: { not: avant.id } }, data: { active: false } });
      await tx.anneeScolaire.update({ where: { id: avant.id }, data: { active: true } });
      return { effet: `L'année ${avant.libelle} est de nouveau l'année en cours.` };
    }
    case 'sequence.ouvrir':
    case 'sequence.fermer': {
      const s = await tx.sequence.findUnique({ where: { id: a.id as string } });
      if (!s) throw conflit("Cette séquence n'existe plus.");
      if (s.saisieOuverte === a.avant) return RIEN;
      await tx.sequence.update({ where: { id: s.id }, data: { saisieOuverte: a.avant as boolean } });
      if (a.avant) await notifierOuvertureSequence(s.id, tx);
      return { effet: `La saisie de la séquence ${s.numero} est de nouveau ${a.avant ? 'ouverte' : 'fermée'}.` };
    }
    case 'etablissement.modifier': {
      const e = await tx.etablissement.findUnique({ where: { id: 1 } });
      if (!e || !a.avant) return { effet: "Il n'y avait pas d'informations à rétablir." };
      const data = aRestaurer(e, a.avant as Valeurs, a.apres as Valeurs);
      if (vide(data)) return RIEN;
      await tx.etablissement.update({ where: { id: 1 }, data });
      return { effet: "Les informations de l'établissement ont repris leurs valeurs précédentes." };
    }
    case 'bareme.modifier': {
      const type = a.type as 'GRADE' | 'COTE';
      const seuils = a.avant as { libelle: string; libelleLong: string | null; min: number }[];
      await tx.bareme.deleteMany({ where: { type } });
      await tx.bareme.createMany({ data: seuils.map((s) => ({ ...s, type })) });
      return { effet: `L'ancien barème des ${type === 'GRADE' ? 'grades' : 'cotes'} a été rétabli.` };
    }
  }
  throw conflit("Ce type de décision ne peut pas être annulé automatiquement.");
}
