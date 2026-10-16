import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import type { Sequence, Sexe } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Etat, Page, Vide } from '../../components/ui';

export interface Manquantes {
  sequence: Sequence;
  matieres: {
    matiere: { id: string; nom: string; classe: { id: string; nom: string }; professeur: { nom: string; prenom: string } | null };
    effectif: number;
    manquants: { inscriptionId: string; matricule: string; nom: string; prenoms: string; sexe: Sexe }[];
  }[];
}

export default function PageManquantes() {
  const { annee } = useApp();
  const sequences = annee?.sequences ?? [];
  const [sequenceId, setSequenceId] = useState(sequences.find((s) => s.saisieOuverte)?.id ?? sequences[0]?.id ?? '');
  const q = useQuery({
    queryKey: ['manquantes', sequenceId],
    queryFn: () => api<Manquantes>(`/notes/manquantes?sequenceId=${sequenceId}`),
    enabled: Boolean(sequenceId),
  });

  return (
    <Page titre="Élèves sans note" description="Pour chacune de vos matières, les élèves qui n'ont pas encore de note dans la séquence choisie.">
      <Champ libelle="Séquence" className="max-w-xs">
        <select className="champ" value={sequenceId} onChange={(e) => setSequenceId(e.target.value)}>
          {sequences.map((s) => (
            <option key={s.id} value={s.id}>
              Séquence {s.numero} {s.saisieOuverte ? '(ouverte)' : '(fermée)'}
            </option>
          ))}
        </select>
      </Champ>
      {q.isLoading ? <Chargement /> : q.error ? <Erreur erreur={q.error} /> : q.data ? <ListeManquantes donnees={q.data} /> : null}
    </Page>
  );
}

export function ListeManquantes({ donnees, avecProf }: { donnees: Manquantes; avecProf?: boolean }) {
  if (!donnees.matieres.length) return <Vide titre="Aucune matière" />;
  return (
    <div className="space-y-4">
      {donnees.matieres.map(({ matiere, effectif, manquants }) => (
        <Carte
          key={matiere.id}
          sansMarge
          titre={
            <span>
              {matiere.nom} · {matiere.classe.nom}
              {avecProf && matiere.professeur && (
                <span className="font-normal text-encre-2">
                  {' '}
                  · {matiere.professeur.prenom} {matiere.professeur.nom}
                </span>
              )}
            </span>
          }
          actions={
            manquants.length === 0 ? (
              <Etat ton="succes">Complet</Etat>
            ) : (
              <Etat ton={manquants.length === effectif ? 'neutre' : 'alerte'}>
                {manquants.length} sur {effectif} sans note
              </Etat>
            )
          }
        >
          {manquants.length === 0 ? (
            <p className="px-4 py-3 text-sm text-encre-2">Tous les élèves ont une note.</p>
          ) : (
            <>
              <ul className="max-h-72 divide-y divide-bord/70 overflow-y-auto">
                {manquants.map((e) => (
                  <li key={e.inscriptionId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="font-medium">
                      {e.nom} {e.prenoms}
                    </span>
                    <span className="tabular-nums text-encre-3">{e.matricule}</span>
                  </li>
                ))}
              </ul>
              {!avecProf && donnees.sequence.saisieOuverte && (
                <div className="border-t border-bord px-4 py-2.5">
                  <Link className="lien text-sm" to={`/saisie?matiere=${matiere.id}&sequence=${donnees.sequence.id}`}>
                    Compléter la saisie
                  </Link>
                </div>
              )}
            </>
          )}
        </Carte>
      ))}
    </div>
  );
}
