import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/contexte';
import { note, pourcent } from '../lib/format';
import type { CodePeriode, Sequence } from '../lib/types';
import { Barre, Carte, Chargement, Erreur, Etat, Indicateur, Page, Vide } from '../components/ui';

export interface Avancement {
  sequences: Sequence[];
  matieres: {
    id: string;
    nom: string;
    coefficient: number;
    classe: { id: string; nom: string; niveau: number };
    professeur: { nom: string; prenom: string } | null;
    effectif: number;
    saisies: Record<string, number>;
  }[];
}

export default function TableauDeBord() {
  const { utilisateur, annee } = useApp();
  const avancement = useQuery({ queryKey: ['avancement', annee?.id], queryFn: () => api<Avancement>('/notes/avancement') });
  const ouverte = annee?.sequences.find((s) => s.saisieOuverte) ?? null;
  const salutation = `Bonjour, ${utilisateur!.prenom}`;

  if (utilisateur!.role === 'PROFESSEUR') {
    return (
      <Page
        titre={salutation}
        description={
          ouverte
            ? `La saisie de la séquence ${ouverte.numero} est ouverte.`
            : "Aucune séquence n'est ouverte à la saisie pour le moment."
        }
        actions={
          ouverte && (
            <Link to="/saisie" className="bouton-primaire">
              Saisir des notes <ArrowRight className="h-4 w-4" />
            </Link>
          )
        }
      >
        <Carte titre="Mes matières" sansMarge>
          {avancement.isLoading ? (
            <Chargement />
          ) : avancement.error ? (
            <div className="p-4">
              <Erreur erreur={avancement.error} />
            </div>
          ) : !avancement.data?.matieres.length ? (
            <Vide titre="Aucune matière ne vous est attribuée">Le Surveillant Général affecte les matières aux enseignants.</Vide>
          ) : (
            <TableAvancement donnees={avancement.data} sequence={ouverte} />
          )}
        </Carte>
      </Page>
    );
  }
  return <TableauDirection salutation={salutation} ouverte={ouverte} avancement={avancement} />;
}

function TableAvancement({ donnees, sequence }: { donnees: Avancement; sequence: Sequence | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="tableau">
        <thead>
          <tr>
            <th>Matière</th>
            <th>Classe</th>
            <th className="text-right">Coef</th>
            {donnees.sequences.map((s) => (
              <th key={s.id} className="text-center">
                S{s.numero}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {donnees.matieres.map((m) => (
            <tr key={m.id}>
              <td className="font-medium">{m.nom}</td>
              <td>{m.classe.nom}</td>
              <td className="text-right tabular-nums">{m.coefficient}</td>
              {donnees.sequences.map((s) => {
                const n = m.saisies[s.id] ?? 0;
                return (
                  <td key={s.id} className="text-center tabular-nums">
                    <span className={n === 0 ? 'text-encre-3' : n < m.effectif ? 'text-alerte' : 'text-succes'}>
                      {n}/{m.effectif}
                    </span>
                  </td>
                );
              })}
              <td className="text-right">
                {sequence && (
                  <Link className="lien text-sm" to={`/saisie?matiere=${m.id}&sequence=${sequence.id}`}>
                    Saisir
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface StatsEtab {
  totaux: { eleves: number; renvoyes: number; classes: number; enseignants: number; filles: number; garcons: number };
  resume: { moyenne: number | null; tauxReussite: number | null; effectif: number };
  premier: { nom: string; prenoms: string; moyenne: number; classe: { nom: string } }[];
  premiereClasse: { nom: string; moyenneGenerale: number } | null;
}

function TableauDirection({
  salutation,
  ouverte,
  avancement,
}: {
  salutation: string;
  ouverte: Sequence | null;
  avancement: ReturnType<typeof useQuery<Avancement>>;
}) {
  const { annee } = useApp();
  // Résultats de la dernière séquence close (ou de la première s'il n'y en a pas).
  const close = [...(annee?.sequences ?? [])].reverse().find((s) => !s.saisieOuverte && (!ouverte || s.numero < ouverte.numero));
  const periode = `S${close?.numero ?? 1}` as CodePeriode;
  const stats = useQuery({
    queryKey: ['stats-etab', annee?.id, periode],
    queryFn: () => api<StatsEtab>(`/statistiques/etablissement?periode=${periode}`),
  });

  // Avancement de la saisie de la séquence ouverte, par classe
  const parClasse = new Map<string, { nom: string; saisies: number; attendues: number; matieres: number; completes: number }>();
  if (ouverte && avancement.data) {
    for (const m of avancement.data.matieres) {
      const c = parClasse.get(m.classe.id) ?? { nom: m.classe.nom, saisies: 0, attendues: 0, matieres: 0, completes: 0 };
      const n = m.saisies[ouverte.id] ?? 0;
      c.saisies += n;
      c.attendues += m.effectif;
      c.matieres += 1;
      if (n >= m.effectif && m.effectif > 0) c.completes += 1;
      parClasse.set(m.classe.id, c);
    }
  }

  const t = stats.data?.totaux;
  return (
    <Page titre={salutation} description={`Année scolaire ${annee?.libelle ?? ''}`}>
      {stats.error ? <Erreur erreur={stats.error} /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur libelle="Élèves" valeur={t?.eleves ?? '…'} detail={t ? `${t.filles} filles · ${t.garcons} garçons` : undefined} />
        <Indicateur libelle="Classes" valeur={t?.classes ?? '…'} />
        <Indicateur libelle="Enseignants" valeur={t?.enseignants ?? '…'} />
        <Indicateur libelle="Élèves renvoyés" valeur={t?.renvoyes ?? '…'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Carte
          className="lg:col-span-3"
          titre={ouverte ? `Saisie de la séquence ${ouverte.numero}` : 'Saisie des notes'}
          actions={
            <Link to="/annees" className="lien text-sm">
              Gérer les séquences
            </Link>
          }
        >
          {!ouverte ? (
            <p className="text-sm text-encre-2">Aucune séquence n'est ouverte. Les professeurs ne peuvent pas saisir de notes.</p>
          ) : avancement.isLoading ? (
            <Chargement />
          ) : (
            <ul className="space-y-3">
              {[...parClasse.values()].map((c) => (
                <li key={c.nom}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="whitespace-nowrap font-semibold">{c.nom}</span>
                    <span className="text-encre-2">
                      {c.completes}/{c.matieres} matières complètes · {c.saisies}/{c.attendues} notes
                    </span>
                  </div>
                  <Barre valeur={c.saisies} max={c.attendues} />
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte className="lg:col-span-2" titre={`Résultats de la séquence ${periode.slice(1)}`}>
          {stats.isLoading ? (
            <Chargement />
          ) : stats.data ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-encre-2">Moyenne générale</dt>
                <dd className="font-bold tabular-nums">{note(stats.data.resume.moyenne)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-encre-2">Taux de réussite</dt>
                <dd className="font-bold tabular-nums">{pourcent(stats.data.resume.tauxReussite)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-encre-2">Premier de l'établissement</dt>
                <dd className="text-right">
                  {stats.data.premier.length ? (
                    stats.data.premier.map((p) => (
                      <div key={p.nom + p.prenoms}>
                        <span className="font-semibold">
                          {p.nom} {p.prenoms}
                        </span>{' '}
                        <span className="text-encre-2">
                          ({p.classe.nom}, {note(p.moyenne)})
                        </span>
                      </div>
                    ))
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-encre-2">Meilleure classe</dt>
                <dd className="text-right font-semibold">
                  {stats.data.premiereClasse ? `${stats.data.premiereClasse.nom} (${note(stats.data.premiereClasse.moyenneGenerale)})` : '—'}
                </dd>
              </div>
              <div className="pt-1">
                <Link to="/statistiques" className="lien">
                  Toutes les statistiques
                </Link>
              </div>
            </dl>
          ) : null}
          {stats.data && stats.data.resume.effectif === 0 && (
            <div className="mt-3">
              <Etat ton="neutre">Aucune note pour cette séquence.</Etat>
            </div>
          )}
        </Carte>
      </div>
    </Page>
  );
}
