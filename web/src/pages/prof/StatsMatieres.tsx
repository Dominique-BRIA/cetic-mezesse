import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { classeNote, note, pourcent, rang } from '../../lib/format';
import type { CodePeriode, Matiere, Rang, Resume, Sexe } from '../../lib/types';
import { Carte, Chargement, Champ, ChoixPeriode, Erreur, Indicateur, Page, Vide } from '../../components/ui';
import { Evolution, ParSexe, Repartition } from '../../components/Graphiques';

export interface StatsMatiere {
  matiere: { id: string; nom: string; coefficient: number; classe: { nom: string } };
  resume: Resume & { evaluee: boolean };
  repartition: { tranche: string; effectif: number }[];
  grades: { grade: string; effectif: number }[];
  parSexe: { sexe: Sexe; effectif: number; moyenne: number | null; tauxReussite: number | null }[];
  evolution: { periode: string; moyenne: number | null; tauxReussite: number | null; evaluee: boolean }[];
  eleves: { inscriptionId: string; nom: string; prenoms: string; sexe: Sexe; note: number; rang: Rang; grade: string }[];
}

export default function StatsMatieres() {
  const { annee } = useApp();
  const matieres = useQuery({ queryKey: ['matieres', 'miennes', annee?.id], queryFn: () => api<Matiere[]>('/matieres') });
  const [choix, setChoix] = useState('');
  const [periode, setPeriode] = useState<CodePeriode>('S1');
  const matiereId = choix || matieres.data?.[0]?.id || '';

  return (
    <Page titre="Statistiques de mes matières" description="Résultats d'une matière dans une classe, pour la période choisie.">
      {matieres.isLoading ? (
        <Chargement />
      ) : !matieres.data?.length ? (
        <Vide titre="Aucune matière ne vous est attribuée" />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Champ libelle="Matière et classe" className="min-w-[18rem] flex-1">
              <select className="champ" value={matiereId} onChange={(e) => setChoix(e.target.value)}>
                {matieres.data.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom} · {m.classe.nom}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Période">
              <ChoixPeriode valeur={periode} changer={setPeriode} />
            </Champ>
          </div>
          <StatistiquesMatiere matiereId={matiereId} periode={periode} />
        </>
      )}
    </Page>
  );
}

export function StatistiquesMatiere({ matiereId, periode }: { matiereId: string; periode: CodePeriode }) {
  const q = useQuery({
    queryKey: ['stats-matiere', matiereId, periode],
    queryFn: () => api<StatsMatiere>(`/statistiques/matiere?matiereId=${matiereId}&periode=${periode}`),
    enabled: Boolean(matiereId),
  });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Erreur erreur={q.error} />;
  const s = q.data!;
  if (!s.resume.evaluee) return <Vide titre="Pas encore de notes sur cette période">Les statistiques apparaîtront après la saisie.</Vide>;
  const r = s.resume;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur libelle="Moyenne de la classe" valeur={note(r.moyenne)} accent detail={`sur ${r.effectif} élèves`} />
        <Indicateur libelle="Taux de réussite" valeur={pourcent(r.tauxReussite)} detail={`${r.reussis} à 10 ou plus`} />
        <Indicateur libelle="Note min – max" valeur={`${note(r.min)} – ${note(r.max)}`} />
        <Indicateur libelle="Écart-type" valeur={note(r.ecartType)} detail="dispersion des notes" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Répartition des notes">
          <Repartition donnees={s.repartition} />
        </Carte>
        <Carte titre="Évolution de la moyenne sur les séquences">
          <Evolution donnees={s.evolution.map((e) => ({ periode: e.periode, moyenne: e.evaluee ? e.moyenne : null }))} />
        </Carte>
        <Carte titre="Filles et garçons">
          <ParSexe donnees={s.parSexe} />
        </Carte>
        <Carte titre="Grades obtenus" sansMarge>
          <table className="tableau">
            <thead>
              <tr>
                <th>Grade</th>
                <th className="text-right">Élèves</th>
                <th className="text-right">Part</th>
              </tr>
            </thead>
            <tbody>
              {s.grades.map((g) => (
                <tr key={g.grade}>
                  <td className="font-semibold">{g.grade}</td>
                  <td className="text-right tabular-nums">{g.effectif}</td>
                  <td className="text-right tabular-nums text-encre-2">{pourcent(r.effectif ? (g.effectif / r.effectif) * 100 : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      </div>
      <Carte titre="Notes des élèves, de la meilleure à la plus faible" sansMarge>
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="tableau">
            <thead>
              <tr>
                <th className="w-16">Rang</th>
                <th>Élève</th>
                <th>Sexe</th>
                <th className="text-right">Note</th>
                <th className="text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {s.eleves.map((e) => (
                <tr key={e.inscriptionId}>
                  <td className="tabular-nums">{rang(e.rang)}</td>
                  <td className="font-medium">
                    {e.nom} {e.prenoms}
                  </td>
                  <td className="text-encre-2">{e.sexe}</td>
                  <td className={`text-right font-semibold tabular-nums ${classeNote(e.note)}`}>{note(e.note)}</td>
                  <td className="text-center font-semibold">{e.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>
    </div>
  );
}
