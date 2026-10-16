import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { FileSpreadsheet } from 'lucide-react';
import { api, telecharger } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { classeNote, libellePeriode, note, pourcent, rang } from '../../lib/format';
import type { Classe, CodePeriode, Profil, Rang } from '../../lib/types';
import { Carte, Chargement, Champ, ChoixPeriode, Erreur, Page, Vide } from '../../components/ui';
import { ListeManquantes, type Manquantes } from '../prof/Manquantes';

interface Releve {
  classe: { id: string; nom: string; annee: string };
  matieres: { id: string; nom: string; coefficient: number; groupe: string; professeur: string | null; evaluee: boolean; moyenne: number | null }[];
  eleves: { inscriptionId: string; eleveId: string; matricule: string; nom: string; prenoms: string; notes: (number | null)[]; moyenne: number | null; rang: Rang | null }[];
  profil: Profil;
}

export default function Notes() {
  const { annee } = useApp();
  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [choix, setChoix] = useState('');
  const [periode, setPeriode] = useState<CodePeriode>('S1');
  const [vue, setVue] = useState<'releve' | 'manquantes'>('releve');
  const classeId = choix || classes.data?.[0]?.id || '';
  const sequence = annee?.sequences.find((s) => `S${s.numero}` === periode);

  return (
    <Page
      titre="Notes"
      description="Relevé des notes d'une classe, moyennes et rangs, et suivi des notes qui manquent encore."
      actions={
        classeId && (
          <button
            type="button"
            className="bouton-secondaire"
            onClick={() => telecharger(`/documents/releve?classeId=${classeId}&periode=${periode}`).catch((e) => toast.error(e.message))}
          >
            <FileSpreadsheet className="h-4 w-4" /> Exporter en Excel
          </button>
        )
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <Champ libelle="Classe" className="w-56">
          <select className="champ" value={classeId} onChange={(e) => setChoix(e.target.value)}>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Période">
          <ChoixPeriode valeur={periode} changer={(p) => (setPeriode(p), !p.startsWith('S') && setVue('releve'))} />
        </Champ>
        <div className="ml-auto flex rounded border border-bord p-0.5" role="tablist">
          {(
            [
              ['releve', 'Relevé'],
              ['manquantes', 'Notes manquantes'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vue === v}
              disabled={v === 'manquantes' && !sequence}
              title={v === 'manquantes' && !sequence ? 'Choisissez une séquence' : undefined}
              onClick={() => setVue(v)}
              className={clsx('rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-40', vue === v ? 'bg-primaire-pale text-primaire' : 'text-encre-2 hover:text-encre')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {classeId && vue === 'releve' && <TableReleve classeId={classeId} periode={periode} />}
      {classeId && vue === 'manquantes' && sequence && <ManquantesClasse classeId={classeId} sequenceId={sequence.id} />}
    </Page>
  );
}

function TableReleve({ classeId, periode }: { classeId: string; periode: CodePeriode }) {
  const q = useQuery({
    queryKey: ['releve', classeId, periode],
    queryFn: () => api<Releve>(`/notes/classe?classeId=${classeId}&periode=${periode}`),
  });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Erreur erreur={q.error} />;
  const r = q.data!;
  if (!r.eleves.length) return <Vide titre="Aucun élève dans cette classe" />;
  const tries = [...r.eleves].sort((a, b) => (a.rang?.rang ?? 999) - (b.rang?.rang ?? 999) || a.nom.localeCompare(b.nom));
  return (
    <Carte
      sansMarge
      titre={`${r.classe.nom} · ${libellePeriode(periode)}`}
      actions={
        <span className="text-sm text-encre-2">
          Moyenne de classe <strong className="text-encre">{note(r.profil.moyenneGenerale)}</strong> · réussite{' '}
          <strong className="text-encre">{pourcent(r.profil.tauxReussite)}</strong>
        </span>
      }
    >
      <div className="max-h-[70vh] overflow-auto">
        <table className="tableau text-[0.82rem]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[2] w-12 bg-surface-2">Rang</th>
              <th className="sticky left-12 z-[2] min-w-[12rem] bg-surface-2">Élève</th>
              {r.matieres.map((m) => (
                <th key={m.id} className="min-w-[4.5rem] text-right normal-case tracking-normal" title={`${m.nom} · ${m.professeur ?? 'non attribuée'}`}>
                  <div className="line-clamp-2 leading-tight">{m.nom}</div>
                  <div className="font-normal text-encre-3">coef {m.coefficient}</div>
                </th>
              ))}
              <th className="text-right">Moyenne</th>
            </tr>
          </thead>
          <tbody>
            {tries.map((e) => (
              <tr key={e.inscriptionId}>
                <td className="sticky left-0 bg-surface tabular-nums">{rang(e.rang)}</td>
                <td className="sticky left-12 bg-surface">
                  <Link to={`/eleves/${e.eleveId}`} className="lien">
                    {e.nom} {e.prenoms}
                  </Link>
                </td>
                {e.notes.map((n, i) => (
                  <td key={r.matieres[i].id} className={clsx('text-right tabular-nums', classeNote(n))}>
                    {r.matieres[i].evaluee ? note(n) : ''}
                  </td>
                ))}
                <td className={clsx('text-right font-bold tabular-nums', classeNote(e.moyenne))}>{note(e.moyenne)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 bg-surface-2" />
              <td className="sticky left-12 bg-surface-2 text-xs font-semibold uppercase text-encre-2">Moyenne de classe</td>
              {r.matieres.map((m) => (
                <td key={m.id} className="bg-surface-2 text-right font-semibold tabular-nums">
                  {m.evaluee ? note(m.moyenne) : <span className="text-xs font-normal text-encre-3">non évaluée</span>}
                </td>
              ))}
              <td className="bg-surface-2 text-right font-bold tabular-nums">{note(r.profil.moyenneGenerale)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Carte>
  );
}

function ManquantesClasse({ classeId, sequenceId }: { classeId: string; sequenceId: string }) {
  const q = useQuery({
    queryKey: ['manquantes', sequenceId, classeId],
    queryFn: () => api<Manquantes>(`/notes/manquantes?sequenceId=${sequenceId}&classeId=${classeId}`),
  });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Erreur erreur={q.error} />;
  return <ListeManquantes donnees={q.data!} avecProf />;
}
