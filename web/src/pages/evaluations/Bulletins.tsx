import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { api, telecharger } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { libellePeriode } from '../../lib/format';
import type { Classe, CodePeriode, Inscription } from '../../lib/types';
import { Carte, Champ, ChoixPeriode, Erreur, Page } from '../../components/ui';

export default function Bulletins() {
  const { annee } = useApp();
  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [periode, setPeriode] = useState<CodePeriode>('S1');
  const [mode, setMode] = useState<'classes' | 'eleves'>('classes');
  const [classesChoisies, setClassesChoisies] = useState<Set<string>>(new Set());
  const [classeEleves, setClasseEleves] = useState('');
  const [elevesChoisis, setElevesChoisis] = useState<Set<string>>(new Set());
  const [classeListe, setClasseListe] = useState('');

  const eleves = useQuery({
    queryKey: ['eleves', annee?.id, classeEleves, ''],
    queryFn: () => api<Inscription[]>(`/eleves?classeId=${classeEleves}&q=`),
    enabled: Boolean(classeEleves),
  });

  const generer = useMutation({
    mutationFn: () =>
      telecharger('/documents/bulletins', {
        methode: 'POST',
        ouvrir: true,
        corps:
          mode === 'classes'
            ? { periode, classeIds: [...classesChoisies] }
            : { periode, inscriptionIds: [...elevesChoisis] },
      }),
    onError: (e) => toast.error(e.message),
  });

  const basculer = (s: Set<string>, id: string, maj: (s: Set<string>) => void) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    maj(n);
  };

  const nombre =
    mode === 'classes'
      ? (classes.data ?? []).filter((c) => classesChoisies.has(c.id)).reduce((s, c) => s + c._count.inscriptions, 0)
      : elevesChoisis.size;
  const listeId = classeListe || classes.data?.[0]?.id || '';

  return (
    <Page titre="Bulletins et listes" description="Un seul PDF, une page A4 par élève, prêt à imprimer.">
      <Carte titre="Bulletins de notes">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Champ libelle="Période">
              <ChoixPeriode valeur={periode} changer={setPeriode} />
            </Champ>
            <div className="flex rounded border border-bord p-0.5" role="tablist">
              {(
                [
                  ['classes', 'Par classes entières'],
                  ['eleves', 'Élèves choisis'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={mode === v}
                  onClick={() => setMode(v)}
                  className={clsx('rounded px-3 py-1.5 text-sm font-semibold', mode === v ? 'bg-primaire-pale text-primaire' : 'text-encre-2 hover:text-encre')}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {mode === 'classes' ? (
            <fieldset>
              <legend className="etiquette">Classes</legend>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {classes.data?.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded border border-bord px-3 py-2 text-sm hover:bg-surface-2">
                    <input type="checkbox" className="h-4 w-4" checked={classesChoisies.has(c.id)} onChange={() => basculer(classesChoisies, c.id, setClassesChoisies)} />
                    <span className="font-medium">{c.nom}</span>
                    <span className="ml-auto tabular-nums text-encre-3">{c._count.inscriptions}</span>
                  </label>
                ))}
              </div>
              {classes.data && classes.data.length > 1 && (
                <button
                  type="button"
                  className="lien mt-2 text-sm"
                  onClick={() =>
                    setClassesChoisies(classesChoisies.size === classes.data.length ? new Set() : new Set(classes.data.map((c) => c.id)))
                  }
                >
                  {classesChoisies.size === classes.data.length ? 'Aucune' : "Tout l'établissement"}
                </button>
              )}
            </fieldset>
          ) : (
            <div className="space-y-3">
              <Champ libelle="Classe" className="max-w-xs">
                <select className="champ" value={classeEleves} onChange={(e) => (setClasseEleves(e.target.value), setElevesChoisis(new Set()))}>
                  <option value="">Choisir…</option>
                  {classes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </Champ>
              {eleves.data && (
                <div className="grid max-h-72 gap-1 overflow-y-auto rounded border border-bord p-2 sm:grid-cols-2 lg:grid-cols-3">
                  {eleves.data.map((i) => (
                    <label key={i.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2">
                      <input type="checkbox" className="h-4 w-4" checked={elevesChoisis.has(i.id)} onChange={() => basculer(elevesChoisis, i.id, setElevesChoisis)} />
                      {i.eleve.nom} {i.eleve.prenoms}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {generer.error ? <Erreur erreur={generer.error} /> : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-bord pt-4">
            <span className="text-sm text-encre-2">
              {nombre ? `${nombre} bulletin(s) de ${libellePeriode(periode).toLowerCase()}` : 'Choisissez des classes ou des élèves.'}
            </span>
            <button type="button" className="bouton-primaire ml-auto" disabled={!nombre || generer.isPending} onClick={() => generer.mutate()}>
              {generer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generer.isPending ? 'Génération…' : 'Générer le PDF'}
            </button>
          </div>
        </div>
      </Carte>

      <Carte titre="Listes de classe">
        <div className="flex flex-wrap items-end gap-3">
          <Champ libelle="Classe" className="w-56">
            <select className="champ" value={listeId} onChange={(e) => setClasseListe(e.target.value)}>
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Champ>
          <button
            type="button"
            className="bouton-secondaire"
            disabled={!listeId}
            onClick={() => telecharger(`/documents/liste?classeId=${listeId}&format=pdf`, { ouvrir: true }).catch((e) => toast.error(e.message))}
          >
            <FileText className="h-4 w-4" /> Liste PDF
          </button>
          <button
            type="button"
            className="bouton-secondaire"
            disabled={!listeId}
            onClick={() => telecharger(`/documents/liste?classeId=${listeId}&format=xlsx`).catch((e) => toast.error(e.message))}
          >
            <FileSpreadsheet className="h-4 w-4" /> Liste Excel
          </button>
        </div>
      </Carte>
    </Page>
  );
}
