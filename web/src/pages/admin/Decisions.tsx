import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import type { Decision, DomaineDecision, PageDecisions } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Etat, Indicateur, Modale, Page, Vide } from '../../components/ui';

const DOMAINES: Record<DomaineDecision, string> = {
  ORGANISATION: 'Organisation',
  SCOLARITE: 'Scolarité',
  ADMINISTRATION: 'Administration',
};

const STATUTS = [
  { code: '', libelle: 'Toutes les décisions' },
  { code: 'EN_DELAI', libelle: 'Encore désapprouvables' },
  { code: 'APPROUVEE', libelle: 'Approuvées' },
  { code: 'DESAPPROUVEE', libelle: 'Désapprouvées' },
];

const JOUR = 24 * 60 * 60 * 1000;

function dateHeure(d: string): string {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function delaiRestant(limite: string): string {
  const jours = Math.ceil((new Date(limite).getTime() - Date.now()) / JOUR);
  return jours <= 1 ? 'dernier jour' : `encore ${jours} jours`;
}

export default function Decisions() {
  const [domaine, setDomaine] = useState('');
  const [statut, setStatut] = useState('');
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [choix, setChoix] = useState<Decision | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setRecherche(saisie.trim()), 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const q = useInfiniteQuery({
    queryKey: ['decisions', domaine, statut, recherche],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams();
      if (domaine) p.set('domaine', domaine);
      if (statut) p.set('statut', statut);
      if (recherche) p.set('q', recherche);
      if (pageParam) p.set('apres', pageParam);
      return api<PageDecisions>(`/decisions?${p}`, { annee: false });
    },
    getNextPageParam: (d) => d.suivant ?? undefined,
  });
  const premiere = q.data?.pages[0];
  const lignes = q.data?.pages.flatMap((p) => p.decisions) ?? [];
  const semaines = (premiere?.delaiJours ?? 28) / 7;

  return (
    <Page
      titre="Décisions prises"
      description={`Décisions du Surveillant Général sur l'organisation, la scolarité et l'administration. Elles sont approuvées d'office ; vous pouvez en désapprouver une pendant ${semaines} semaines, après quoi elle reste approuvée.`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Indicateur
          libelle="Encore désapprouvables"
          valeur={premiere?.totaux.enDelai ?? '…'}
          detail={`Décisions approuvées de moins de ${semaines} semaines`}
          accent
        />
        <Indicateur libelle="Désapprouvées" valeur={premiere?.totaux.desapprouvees ?? '…'} detail="Depuis la mise en service" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Rechercher</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-3" />
          <input
            className="champ pl-8"
            placeholder="Rechercher une classe, un élève, une matière…"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
          />
        </label>
        <select className="champ w-auto" value={domaine} onChange={(e) => setDomaine(e.target.value)} aria-label="Domaine">
          <option value="">Tous les domaines</option>
          {Object.entries(DOMAINES).map(([code, libelle]) => (
            <option key={code} value={code}>
              {libelle}
            </option>
          ))}
        </select>
        <select className="champ w-auto" value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Statut">
          {STATUTS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.libelle}
            </option>
          ))}
        </select>
      </div>

      <Carte sansMarge>
        {q.isLoading ? (
          <div className="px-4">
            <Chargement />
          </div>
        ) : q.error ? (
          <div className="p-4">
            <Erreur erreur={q.error} />
          </div>
        ) : !lignes.length ? (
          <Vide titre="Aucune décision">
            {domaine || statut || recherche
              ? 'Aucune décision ne correspond à ces filtres.'
              : 'Les décisions du Surveillant Général apparaîtront ici dès qu’il modifiera la plateforme.'}
          </Vide>
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Décision</th>
                  <th className="hidden lg:table-cell">Par</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lignes.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap align-top tabular-nums text-encre-2">{dateHeure(d.creeLe)}</td>
                    <td className="max-w-xl align-top">
                      <div className="text-xs font-semibold uppercase tracking-wide text-encre-3">{DOMAINES[d.domaine]}</div>
                      <div>{d.libelle}</div>
                      {d.lien && (
                        <Link className="lien text-xs" to={d.lien}>
                          Voir
                        </Link>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap align-top text-encre-2 lg:table-cell">
                      {d.auteur.prenom} {d.auteur.nom}
                    </td>
                    <td className="align-top">
                      <Statut d={d} />
                    </td>
                    <td className="whitespace-nowrap text-right align-top">
                      <Arbitrer d={d} choisir={setChoix} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lignes.length > 0 && (
          <ul className="divide-y divide-bord md:hidden">
            {lignes.map((d) => (
              <li key={d.id} className="space-y-2 px-4 py-3 text-sm">
                <div className="text-xs text-encre-3">
                  <span className="font-semibold uppercase tracking-wide">{DOMAINES[d.domaine]}</span> · {dateHeure(d.creeLe)} ·{' '}
                  {d.auteur.prenom} {d.auteur.nom}
                </div>
                <div>
                  {d.libelle}
                  {d.lien && (
                    <Link className="lien ml-2 text-xs" to={d.lien}>
                      Voir
                    </Link>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <Statut d={d} />
                  <Arbitrer d={d} choisir={setChoix} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {q.hasNextPage && (
          <div className="border-t border-bord px-4 py-3 text-center">
            <button type="button" className="bouton-secondaire" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
              {q.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
              Afficher les décisions plus anciennes
            </button>
          </div>
        )}
      </Carte>
      {choix && <Arbitrage decision={choix} fermer={() => setChoix(null)} />}
    </Page>
  );
}

function Statut({ d }: { d: Decision }) {
  if (d.statut === 'APPROUVEE') return <Etat ton="succes">Approuvée</Etat>;
  return (
    <div className="max-w-xs">
      <Etat ton="danger">Désapprouvée</Etat>
      <div className="mt-1 text-xs text-encre-2">
        {d.motifDesapprobation}
        {d.desapprouveeLe && <span className="text-encre-3"> · {dateHeure(d.desapprouveeLe)}</span>}
      </div>
      <div className="mt-1 text-xs text-encre-3">{d.annulee ? `Action annulée : ${d.effet}` : 'Action non annulée automatiquement.'}</div>
    </div>
  );
}

function Arbitrer({ d, choisir }: { d: Decision; choisir: (d: Decision) => void }) {
  if (d.statut === 'DESAPPROUVEE') return null;
  if (!d.modifiable) return <span className="whitespace-nowrap text-xs text-encre-3">Délai écoulé</span>;
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" className="bouton-secondaire py-1.5" onClick={() => choisir(d)}>
        Désapprouver
      </button>
      <span className="text-xs text-encre-3">{delaiRestant(d.limite)}</span>
    </div>
  );
}

// Désapprouver défait l'action du SG ; c'est définitif.
function Arbitrage({ decision, fermer }: { decision: Decision; fermer: () => void }) {
  const client = useQueryClient();
  const [motif, setMotif] = useState('');
  const envoi = useMutation({
    mutationFn: () => api<Decision>(`/decisions/${decision.id}/desapprouver`, { methode: 'POST', corps: { motif }, annee: false }),
    onSuccess: (d) => {
      toast.success(d.annulee ? `Décision désapprouvée. ${d.effet}` : 'Décision désapprouvée.');
      // L'action défaite peut toucher n'importe quelle page : on recharge tout.
      client.invalidateQueries();
      fermer();
    },
  });
  return (
    <Modale
      titre="Désapprouver la décision"
      ouverte
      fermer={fermer}
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-danger" disabled={!motif.trim() || envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Désapprouver
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {envoi.error ? <Erreur erreur={envoi.error} /> : null}
        <div className="rounded border border-bord bg-surface-2 px-3 py-2.5">
          <div className="text-xs text-encre-2">
            {DOMAINES[decision.domaine]} · {decision.auteur.prenom} {decision.auteur.nom} · {dateHeure(decision.creeLe)}
          </div>
          <div className="mt-0.5">{decision.libelle}</div>
        </div>
        <p className="font-semibold">
          {decision.effetPrevu ?? "Cette décision sera marquée désapprouvée, sans que l'action soit défaite automatiquement."}
        </p>
        <Champ libelle="Motif" aide="Obligatoire. La désapprobation est définitive.">
          <textarea className="champ min-h-[5rem]" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={500} autoFocus />
        </Champ>
      </div>
    </Modale>
  );
}
