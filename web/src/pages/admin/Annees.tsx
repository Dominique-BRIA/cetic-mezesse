import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Loader2, Lock, LockOpen, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import type { Sequence } from '../../lib/types';
import { Carte, Champ, Erreur, Etat, Modale, Page } from '../../components/ui';

export default function Annees() {
  const { a, annees, annee, choisirAnnee } = useApp();
  const client = useQueryClient();
  const sg = a('SURVEILLANT_GENERAL');
  const [creation, setCreation] = useState(false);

  const basculer = useMutation({
    mutationFn: (s: Sequence) => api(`/annees/sequences/${s.id}`, { methode: 'PATCH', corps: { saisieOuverte: !s.saisieOuverte }, annee: false }),
    onSuccess: (_r, s) => {
      toast.success(`Saisie de la séquence ${s.numero} ${s.saisieOuverte ? 'fermée' : 'ouverte'}.`);
      client.invalidateQueries({ queryKey: ['annees'] });
      client.invalidateQueries({ queryKey: ['avancement'] });
    },
    onError: (e) => toast.error(e.message),
  });
  const activer = useMutation({
    mutationFn: (id: string) => api(`/annees/${id}/activer`, { methode: 'POST', annee: false }),
    onSuccess: () => {
      toast.success('Année activée.');
      client.invalidateQueries({ queryKey: ['annees'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Page
      titre="Années et séquences"
      description="L'année en cours est celle que voient les professeurs. La saisie des notes s'ouvre et se ferme séquence par séquence."
      actions={
        sg && (
          <button type="button" className="bouton-primaire" onClick={() => setCreation(true)}>
            <Plus className="h-4 w-4" /> Nouvelle année
          </button>
        )
      }
    >
      {annee && (
        <Carte titre={`Séquences de ${annee.libelle}`}>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((t) => (
              <div key={t}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-encre-2">Trimestre {t}</div>
                <ul className="space-y-2">
                  {annee.sequences
                    .filter((s) => s.trimestre === t)
                    .map((s) => (
                      <li
                        key={s.id}
                        className={clsx(
                          'flex items-center justify-between gap-3 rounded border px-3 py-2.5',
                          s.saisieOuverte ? 'border-primaire/50 bg-primaire-pale/50' : 'border-bord',
                        )}
                      >
                        <div>
                          <div className="font-semibold">Séquence {s.numero}</div>
                          {s.saisieOuverte ? <Etat ton="succes">Saisie ouverte</Etat> : <Etat ton="neutre">Saisie fermée</Etat>}
                        </div>
                        {sg && (
                          <button
                            type="button"
                            className={s.saisieOuverte ? 'bouton-secondaire py-1.5' : 'bouton-primaire py-1.5'}
                            disabled={basculer.isPending}
                            onClick={() => basculer.mutate(s)}
                          >
                            {s.saisieOuverte ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                            {s.saisieOuverte ? 'Fermer' : 'Ouvrir'}
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-encre-2">
            Une séquence fermée ne peut plus être modifiée par les professeurs. Vous pouvez la rouvrir à tout moment pour une
            correction.
          </p>
        </Carte>
      )}

      <Carte titre="Années scolaires" sansMarge>
        <table className="tableau">
          <thead>
            <tr>
              <th>Année</th>
              <th className="text-right">Classes</th>
              <th className="text-right">Inscriptions</th>
              <th>État</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {annees.map((x) => (
              <tr key={x.id}>
                <td className="font-semibold tabular-nums">{x.libelle}</td>
                <td className="text-right tabular-nums">{x._count.classes}</td>
                <td className="text-right tabular-nums">{x._count.inscriptions}</td>
                <td>{x.active ? <Etat ton="succes">En cours</Etat> : <Etat ton="neutre">Archivée</Etat>}</td>
                <td className="whitespace-nowrap text-right">
                  {x.id !== annee?.id && (
                    <button type="button" className="bouton-discret" onClick={() => choisirAnnee(x.id)}>
                      Consulter
                    </button>
                  )}
                  {sg && !x.active && (
                    <button
                      type="button"
                      className="bouton-secondaire py-1.5"
                      onClick={() => confirm(`Faire de ${x.libelle} l'année en cours ?`) && activer.mutate(x.id)}
                    >
                      Rendre active
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
      {creation && <NouvelleAnnee fermer={() => setCreation(false)} />}
    </Page>
  );
}

function NouvelleAnnee({ fermer }: { fermer: () => void }) {
  const { annees, choisirAnnee } = useApp();
  const client = useQueryClient();
  const derniere = annees[0];
  const debut = derniere ? Number(derniere.libelle.slice(0, 4)) + 1 : new Date().getFullYear();
  const [libelle, setLibelle] = useState(`${debut}-${debut + 1}`);
  const [copier, setCopier] = useState(derniere?.id ?? '');
  const [activer, setActiver] = useState(false);
  const envoi = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/annees', { methode: 'POST', corps: { libelle, copierDepuisId: copier || null, activer }, annee: false }),
    onSuccess: async (r) => {
      toast.success(`Année ${libelle} créée.`);
      await client.invalidateQueries({ queryKey: ['annees'] });
      choisirAnnee(r.id);
      fermer();
    },
  });
  return (
    <Modale
      titre="Nouvelle année scolaire"
      ouverte
      fermer={fermer}
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {envoi.error ? <Erreur erreur={envoi.error} /> : null}
        <Champ libelle="Libellé" aide="Les six séquences et les trois trimestres sont créés automatiquement.">
          <input className="champ" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="2027-2028" />
        </Champ>
        <Champ libelle="Reprendre l'organisation de" aide="Classes, groupes, matières, coefficients et enseignants. Les élèves se réinscrivent ensuite.">
          <select className="champ" value={copier} onChange={(e) => setCopier(e.target.value)}>
            <option value="">Ne rien reprendre</option>
            {annees.map((x) => (
              <option key={x.id} value={x.id}>
                {x.libelle}
              </option>
            ))}
          </select>
        </Champ>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={activer} onChange={(e) => setActiver(e.target.checked)} />
          En faire l'année en cours immédiatement
        </label>
      </div>
    </Modale>
  );
}
