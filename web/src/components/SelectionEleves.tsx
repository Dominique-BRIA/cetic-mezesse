import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../lib/api';
import { useApp } from '../lib/contexte';
import type { Classe, Inscription } from '../lib/types';
import { Champ } from './ui';

// Choix des élèves pour un document (bulletins, cartes) : des classes entières ou quelques élèves.
export function useSelectionEleves() {
  const { annee } = useApp();
  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [mode, setMode] = useState<'classes' | 'eleves'>('classes');
  const [classesChoisies, setClassesChoisies] = useState<Set<string>>(new Set());
  const [classeEleves, setClasseEleves] = useState('');
  const [elevesChoisis, setElevesChoisis] = useState<Set<string>>(new Set());
  const eleves = useQuery({
    queryKey: ['eleves', annee?.id, classeEleves, ''],
    queryFn: () => api<Inscription[]>(`/eleves?classeId=${classeEleves}&q=`),
    enabled: Boolean(classeEleves),
  });
  const nombre =
    mode === 'classes'
      ? (classes.data ?? []).filter((c) => classesChoisies.has(c.id)).reduce((s, c) => s + c._count.inscriptions, 0)
      : elevesChoisis.size;
  // Corps envoyé à l'API : { classeIds } ou { inscriptionIds }.
  const corps = mode === 'classes' ? { classeIds: [...classesChoisies].sort() } : { inscriptionIds: [...elevesChoisis].sort() };
  return {
    classes,
    eleves,
    mode,
    setMode,
    classesChoisies,
    setClassesChoisies,
    classeEleves,
    setClasseEleves,
    elevesChoisis,
    setElevesChoisis,
    nombre,
    corps,
  };
}

export type SelectionEleves = ReturnType<typeof useSelectionEleves>;

function basculer(s: Set<string>, id: string, maj: (s: Set<string>) => void) {
  const n = new Set(s);
  if (n.has(id)) n.delete(id);
  else n.add(id);
  maj(n);
}

export function ModeSelection({ sel }: { sel: SelectionEleves }) {
  return (
    <div className="inline-flex rounded border border-bord p-0.5" role="tablist">
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
          aria-selected={sel.mode === v}
          onClick={() => sel.setMode(v)}
          className={clsx('rounded px-3 py-1.5 text-sm font-semibold', sel.mode === v ? 'bg-primaire-pale text-primaire' : 'text-encre-2 hover:text-encre')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function ChoixEleves({ sel }: { sel: SelectionEleves }) {
  const { classes, eleves } = sel;
  if (sel.mode === 'classes') {
    return (
      <fieldset>
        <legend className="etiquette">Classes</legend>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {classes.data?.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded border border-bord px-3 py-2 text-sm hover:bg-surface-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={sel.classesChoisies.has(c.id)}
                onChange={() => basculer(sel.classesChoisies, c.id, sel.setClassesChoisies)}
              />
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
              sel.setClassesChoisies(sel.classesChoisies.size === classes.data.length ? new Set() : new Set(classes.data.map((c) => c.id)))
            }
          >
            {sel.classesChoisies.size === classes.data.length ? 'Aucune' : "Tout l'établissement"}
          </button>
        )}
      </fieldset>
    );
  }
  return (
    <div className="space-y-3">
      <Champ libelle="Classe" className="max-w-xs">
        <select
          className="champ"
          value={sel.classeEleves}
          onChange={(e) => (sel.setClasseEleves(e.target.value), sel.setElevesChoisis(new Set()))}
        >
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
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={sel.elevesChoisis.has(i.id)}
                onChange={() => basculer(sel.elevesChoisis, i.id, sel.setElevesChoisis)}
              />
              {i.eleve.nom} {i.eleve.prenoms}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
