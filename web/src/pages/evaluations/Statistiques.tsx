import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { classeNote, note, pourcent, rang } from '../../lib/format';
import type { Classe, CodePeriode, Matiere, Profil, Rang, Resume, Sexe } from '../../lib/types';
import { Carte, Chargement, Champ, ChoixPeriode, Erreur, Indicateur, Page, Vide } from '../../components/ui';
import { BarresHorizontales, Evolution, ParSexe, Repartition } from '../../components/Graphiques';
import { StatistiquesMatiere } from '../prof/StatsMatieres';

type Vue = 'etablissement' | 'classe' | 'matiere';

export interface StatsEtablissement {
  totaux: { eleves: number; renvoyes: number; classes: number; enseignants: number; filles: number; garcons: number };
  resume: Resume;
  repartition: { tranche: string; effectif: number }[];
  parSexe: { sexe: Sexe; effectif: number; moyenne: number | null; tauxReussite: number | null }[];
  premier: EleveClasse[];
  dernier: EleveClasse[];
  premiereClasse: (Profil & { nom: string }) | null;
  derniereClasse: (Profil & { nom: string }) | null;
  classes: (Profil & { id: string; nom: string; rang: Rang | null })[];
  matieres: { nom: string; classes: number; moyenne: number; tauxReussite: number }[];
  classement: (EleveClasse & { rang: Rang; rangClasse: Rang | null })[];
}

interface EleveClasse {
  inscriptionId: string;
  eleveId: string;
  matricule: string;
  nom: string;
  prenoms: string;
  sexe: Sexe;
  moyenne: number;
  classe: { id: string; nom: string };
}

export default function Statistiques() {
  const [vue, setVue] = useState<Vue>('etablissement');
  const [periode, setPeriode] = useState<CodePeriode>('S1');
  return (
    <Page titre="Statistiques" description="Résultats de l'établissement, d'une classe ou d'une matière sur la période choisie.">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex rounded border border-bord p-0.5" role="tablist">
          {(
            [
              ['etablissement', 'Établissement'],
              ['classe', 'Par classe'],
              ['matiere', 'Par matière'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vue === v}
              onClick={() => setVue(v)}
              className={clsx('rounded px-3 py-1.5 text-sm font-semibold', vue === v ? 'bg-primaire-pale text-primaire' : 'text-encre-2 hover:text-encre')}
            >
              {l}
            </button>
          ))}
        </div>
        <Champ libelle="Période" className="ml-auto">
          <ChoixPeriode valeur={periode} changer={setPeriode} />
        </Champ>
      </div>
      {vue === 'etablissement' && <VueEtablissement periode={periode} />}
      {vue === 'classe' && <VueClasse periode={periode} />}
      {vue === 'matiere' && <VueMatiere periode={periode} />}
    </Page>
  );
}

function VueEtablissement({ periode }: { periode: CodePeriode }) {
  const { annee } = useApp();
  const q = useQuery({
    queryKey: ['stats-etab', annee?.id, periode],
    queryFn: () => api<StatsEtablissement>(`/statistiques/etablissement?periode=${periode}`),
  });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Erreur erreur={q.error} />;
  const s = q.data!;
  if (!s.resume.effectif) return <Vide titre="Pas encore de notes sur cette période" />;
  const eleve = (e?: EleveClasse) => (e ? `${e.nom} ${e.prenoms}` : '—');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur libelle="Moyenne générale" valeur={note(s.resume.moyenne)} accent detail={`${s.resume.effectif} élèves classés`} />
        <Indicateur libelle="Taux de réussite" valeur={pourcent(s.resume.tauxReussite)} detail={`${s.resume.reussis} élèves à 10 ou plus`} />
        <Indicateur libelle="Moyenne min – max" valeur={`${note(s.resume.min)} – ${note(s.resume.max)}`} />
        <Indicateur libelle="Écart-type" valeur={note(s.resume.ecartType)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Extreme titre="Premier de l'établissement" ton="haut" lignes={s.premier.map((e) => [eleve(e), `${e.classe.nom} · ${note(e.moyenne)}`])} />
        <Extreme titre="Dernier de l'établissement" ton="bas" lignes={s.dernier.map((e) => [eleve(e), `${e.classe.nom} · ${note(e.moyenne)}`])} />
        <Extreme
          titre="Première classe"
          ton="haut"
          lignes={s.premiereClasse ? [[s.premiereClasse.nom, `moyenne ${note(s.premiereClasse.moyenneGenerale)} · ${pourcent(s.premiereClasse.tauxReussite)}`]] : []}
        />
        <Extreme
          titre="Dernière classe"
          ton="bas"
          lignes={s.derniereClasse ? [[s.derniereClasse.nom, `moyenne ${note(s.derniereClasse.moyenneGenerale)} · ${pourcent(s.derniereClasse.tauxReussite)}`]] : []}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Répartition des moyennes générales">
          <Repartition donnees={s.repartition} />
        </Carte>
        <Carte titre="Filles et garçons">
          <ParSexe donnees={s.parSexe} />
        </Carte>
      </div>

      <Carte titre="Classes" sansMarge>
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead>
              <tr>
                <th className="w-16">Rang</th>
                <th>Classe</th>
                <th className="text-right">Effectif</th>
                <th className="text-right">Moyenne</th>
                <th className="text-right">Min – Max</th>
                <th className="text-right">Moyennes</th>
                <th className="text-right">Réussite</th>
              </tr>
            </thead>
            <tbody>
              {s.classes.map((c) => (
                <tr key={c.id}>
                  <td className="tabular-nums">{rang(c.rang)}</td>
                  <td className="font-medium">{c.nom}</td>
                  <td className="text-right tabular-nums">{c.effectif}</td>
                  <td className={clsx('text-right font-semibold tabular-nums', classeNote(c.moyenneGenerale))}>{note(c.moyenneGenerale)}</td>
                  <td className="text-right tabular-nums text-encre-2">
                    {note(c.min)} – {note(c.max)}
                  </td>
                  <td className="text-right tabular-nums">{c.nombreMoyennes}</td>
                  <td className="text-right tabular-nums">{pourcent(c.tauxReussite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>

      <Carte titre="Moyenne par matière, toutes classes confondues">
        <BarresHorizontales donnees={s.matieres.map((m) => ({ nom: m.nom, valeur: m.moyenne }))} />
      </Carte>
    </div>
  );
}

function Extreme({ titre, ton, lignes }: { titre: string; ton: 'haut' | 'bas'; lignes: [string, string][] }) {
  return (
    <div className={clsx('rounded-lg border bg-surface px-4 py-3', ton === 'haut' ? 'border-l-4 border-bord border-l-succes' : 'border-l-4 border-bord border-l-danger')}>
      <div className="text-xs font-semibold uppercase tracking-wide text-encre-2">{titre}</div>
      {lignes.length ? (
        lignes.map(([a, b]) => (
          <div key={a} className="mt-1">
            <div className="font-bold">{a}</div>
            <div className="text-sm text-encre-2">{b}</div>
          </div>
        ))
      ) : (
        <div className="mt-1 text-encre-3">—</div>
      )}
    </div>
  );
}

interface StatsClasse {
  classe: { id: string; nom: string };
  profil: Profil;
  repartition: { tranche: string; effectif: number }[];
  parSexe: { sexe: Sexe; effectif: number; moyenne: number | null; tauxReussite: number | null }[];
  matieres: { id: string; nom: string; coefficient: number; professeur: string | null; evaluee: boolean; moyenne: number | null; tauxReussite: number | null; min: number | null; max: number | null; ecartType: number | null }[];
  evolution: { periode: string; moyenne: number | null; tauxReussite: number | null }[];
  classement: { inscriptionId: string; nom: string; prenoms: string; sexe: Sexe; moyenne: number; rang: Rang }[];
}

function VueClasse({ periode }: { periode: CodePeriode }) {
  const { annee } = useApp();
  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [choix, setChoix] = useState('');
  const classeId = choix || classes.data?.[0]?.id || '';
  const q = useQuery({
    queryKey: ['stats-classe', classeId, periode],
    queryFn: () => api<StatsClasse>(`/statistiques/classe?classeId=${classeId}&periode=${periode}`),
    enabled: Boolean(classeId),
  });
  return (
    <div className="space-y-4">
      <Champ libelle="Classe" className="max-w-xs">
        <select className="champ" value={classeId} onChange={(e) => setChoix(e.target.value)}>
          {classes.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </Champ>
      {q.isLoading ? (
        <Chargement />
      ) : q.error ? (
        <Erreur erreur={q.error} />
      ) : q.data && q.data.profil.moyenneGenerale === null ? (
        <Vide titre="Pas encore de notes sur cette période" />
      ) : q.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicateur libelle="Moyenne de la classe" valeur={note(q.data.profil.moyenneGenerale)} accent detail={`${q.data.profil.effectif} élèves`} />
            <Indicateur libelle="Taux de réussite" valeur={pourcent(q.data.profil.tauxReussite)} detail={`${q.data.profil.nombreMoyennes} moyennes`} />
            <Indicateur libelle="Moyenne min – max" valeur={`${note(q.data.profil.min)} – ${note(q.data.profil.max)}`} />
            <Indicateur libelle="Écart-type" valeur={note(q.data.profil.ecartType)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Carte titre="Évolution de la moyenne de classe">
              <Evolution donnees={q.data.evolution} />
            </Carte>
            <Carte titre="Répartition des moyennes">
              <Repartition donnees={q.data.repartition} />
            </Carte>
            <Carte titre="Moyenne par matière">
              <BarresHorizontales donnees={q.data.matieres.map((m) => ({ nom: m.nom, valeur: m.evaluee ? m.moyenne : null }))} />
            </Carte>
            <Carte titre="Filles et garçons">
              <ParSexe donnees={q.data.parSexe} />
            </Carte>
          </div>
          <Carte titre="Matières" sansMarge>
            <div className="overflow-x-auto">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Matière</th>
                    <th className="hidden md:table-cell">Enseignant</th>
                    <th className="text-right">Coef</th>
                    <th className="text-right">Moyenne</th>
                    <th className="text-right">Min – Max</th>
                    <th className="text-right">Écart-type</th>
                    <th className="text-right">Réussite</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.matieres.map((m) => (
                    <tr key={m.id}>
                      <td className="font-medium">{m.nom}</td>
                      <td className="hidden text-encre-2 md:table-cell">{m.professeur ?? '—'}</td>
                      <td className="text-right tabular-nums">{m.coefficient}</td>
                      {m.evaluee ? (
                        <>
                          <td className={clsx('text-right font-semibold tabular-nums', classeNote(m.moyenne))}>{note(m.moyenne)}</td>
                          <td className="text-right tabular-nums text-encre-2">
                            {note(m.min)} – {note(m.max)}
                          </td>
                          <td className="text-right tabular-nums text-encre-2">{note(m.ecartType)}</td>
                          <td className="text-right tabular-nums">{pourcent(m.tauxReussite)}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="text-right text-xs text-encre-3">
                          Pas d'évaluation
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>
        </>
      ) : null}
    </div>
  );
}

function VueMatiere({ periode }: { periode: CodePeriode }) {
  const { annee } = useApp();
  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [classeChoix, setClasseChoix] = useState('');
  const classeId = classeChoix || classes.data?.[0]?.id || '';
  const matieres = useQuery({
    queryKey: ['matieres', annee?.id, classeId],
    queryFn: () => api<Matiere[]>(`/matieres?classeId=${classeId}`),
    enabled: Boolean(classeId),
  });
  const [matiereChoix, setMatiereChoix] = useState('');
  const matiereId = matieres.data?.some((m) => m.id === matiereChoix) ? matiereChoix : matieres.data?.[0]?.id ?? '';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Champ libelle="Classe" className="w-56">
          <select className="champ" value={classeId} onChange={(e) => setClasseChoix(e.target.value)}>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Matière" className="min-w-[16rem]">
          <select className="champ" value={matiereId} onChange={(e) => setMatiereChoix(e.target.value)}>
            {matieres.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </Champ>
      </div>
      {matiereId && <StatistiquesMatiere matiereId={matiereId} periode={periode} />}
    </div>
  );
}
