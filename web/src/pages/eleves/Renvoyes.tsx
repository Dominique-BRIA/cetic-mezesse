import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { date } from '../../lib/format';
import type { Inscription } from '../../lib/types';
import { Carte, Chargement, Erreur, Page, Vide } from '../../components/ui';
import { Reintegration } from './FicheEleve';

export default function Renvoyes() {
  const { a, annee } = useApp();
  const q = useQuery({ queryKey: ['eleves', annee?.id, 'renvoyes'], queryFn: () => api<Inscription[]>('/eleves?statut=RENVOYE') });
  const [choix, setChoix] = useState<Inscription | null>(null);

  return (
    <Page titre="Élèves renvoyés" description={`Élèves retirés de la liste principale en ${annee?.libelle ?? ''}. Seul le Proviseur peut les réintégrer.`}>
      <Carte sansMarge>
        {q.isLoading ? (
          <div className="px-4">
            <Chargement />
          </div>
        ) : q.error ? (
          <div className="p-4">
            <Erreur erreur={q.error} />
          </div>
        ) : !q.data?.length ? (
          <Vide titre="Aucun élève renvoyé cette année" />
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Renvoyé le</th>
                  <th>Motif</th>
                  <th className="hidden md:table-cell">Décidé par</th>
                  {a('PROVISEUR') && <th />}
                </tr>
              </thead>
              <tbody>
                {q.data.map((i) => {
                  const r = i.renvois[0];
                  return (
                    <tr key={i.id}>
                      <td>
                        <Link className="lien" to={`/eleves/${i.eleve.id}`}>
                          {i.eleve.nom} {i.eleve.prenoms}
                        </Link>
                        <div className="text-xs tabular-nums text-encre-3">{i.eleve.matricule}</div>
                      </td>
                      <td>{i.classe.nom}</td>
                      <td className="tabular-nums">{date(r?.date)}</td>
                      <td className="max-w-xs text-encre-2">{r?.motif}</td>
                      <td className="hidden text-encre-2 md:table-cell">{r ? `${r.par.prenom} ${r.par.nom}` : '—'}</td>
                      {a('PROVISEUR') && (
                        <td className="text-right">
                          <button type="button" className="bouton-secondaire py-1.5" onClick={() => setChoix(i)}>
                            Réintégrer
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
      {choix && <Reintegration inscriptionId={choix.id} nom={`${choix.eleve.nom} ${choix.eleve.prenoms}`} fermer={() => setChoix(null)} />}
    </Page>
  );
}
