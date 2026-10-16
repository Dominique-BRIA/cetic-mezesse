import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { classeNote, libellePeriode, note, rang } from '../../lib/format';
import type { CodePeriode } from '../../lib/types';
import { Carte, Chargement, Champ, ChoixPeriode, Erreur, Page, Vide } from '../../components/ui';
import type { StatsEtablissement } from './Statistiques';

export default function Classement() {
  const { annee } = useApp();
  const [periode, setPeriode] = useState<CodePeriode>('S1');
  const [classe, setClasse] = useState('');
  const [filtre, setFiltre] = useState('');
  const q = useQuery({
    queryKey: ['stats-etab', annee?.id, periode],
    queryFn: () => api<StatsEtablissement>(`/statistiques/etablissement?periode=${periode}`),
  });
  const total = q.data?.classement.length ?? 0;
  const dernierRang = q.data?.classement[total - 1]?.rang.rang;
  const lignes = (q.data?.classement ?? []).filter(
    (e) => (!classe || e.classe.id === classe) && `${e.nom} ${e.prenoms} ${e.matricule}`.toLowerCase().includes(filtre.toLowerCase()),
  );

  return (
    <Page titre="Classement général" description="Tous les élèves de l'établissement classés par moyenne générale, toutes classes confondues.">
      <div className="flex flex-wrap items-end gap-3">
        <Champ libelle="Période">
          <ChoixPeriode valeur={periode} changer={setPeriode} />
        </Champ>
        <Champ libelle="Classe" className="w-48">
          <select className="champ" value={classe} onChange={(e) => setClasse(e.target.value)}>
            <option value="">Toutes</option>
            {q.data?.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Rechercher" className="min-w-[14rem] flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-3" />
            <input className="champ pl-9" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Nom ou matricule" />
          </div>
        </Champ>
      </div>
      <Carte sansMarge titre={`${libellePeriode(periode)} · ${total} élèves classés`}>
        {q.isLoading ? (
          <div className="px-4">
            <Chargement />
          </div>
        ) : q.error ? (
          <div className="p-4">
            <Erreur erreur={q.error} />
          </div>
        ) : !lignes.length ? (
          <Vide titre="Aucun élève classé" />
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th className="w-20">Rang</th>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th className="hidden sm:table-cell">Rang en classe</th>
                  <th className="text-right">Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((e) => {
                  const premier = e.rang.rang === 1;
                  const dernier = e.rang.rang === dernierRang && total > 1;
                  return (
                    <tr key={e.inscriptionId} className={clsx(premier && 'bg-succes/5', dernier && 'bg-danger/5')}>
                      <td className="font-semibold tabular-nums">
                        {rang(e.rang)}
                        {premier && <span className="ml-1.5 text-xs font-normal text-succes">premier</span>}
                        {dernier && <span className="ml-1.5 text-xs font-normal text-danger">dernier</span>}
                      </td>
                      <td>
                        <Link to={`/eleves/${e.eleveId}`} className="lien">
                          {e.nom} {e.prenoms}
                        </Link>
                      </td>
                      <td>{e.classe.nom}</td>
                      <td className="hidden tabular-nums text-encre-2 sm:table-cell">{rang(e.rangClasse)}</td>
                      <td className={clsx('text-right font-bold tabular-nums', classeNote(e.moyenne))}>{note(e.moyenne)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
    </Page>
  );
}
